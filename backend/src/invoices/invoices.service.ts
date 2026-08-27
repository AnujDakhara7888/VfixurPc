import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Invoice, InvoiceLineItem } from './invoice.entity';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { QuoteItem } from '../quotes/quote-item.entity';
import { User } from '../users/user.entity';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { SELLER } from './invoice.config';
import { amountInWords } from './number-to-words';
import { buildInvoicePdf } from './invoice-pdf';

const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class InvoicesService {
  private readonly s3?: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(ServiceRequest) private srRepo: Repository<ServiceRequest>,
    @InjectRepository(QuoteItem) private quoteItemRepo: Repository<QuoteItem>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', '');
    const key = this.config.get<string>('AWS_ACCESS_KEY_ID', '');
    // Only construct an S3 client when credentials are actually configured —
    // invoices work fully (build + download) without S3.
    if (this.bucket && key) {
      this.s3 = new S3Client({
        region: this.config.get<string>('AWS_REGION', 'ap-south-1'),
        credentials: {
          accessKeyId: key,
          secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
        },
      });
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.invoiceRepo.count();
    return `Vfx-${count + 1}`;
  }

  async generateAndStore(serviceRequestId: string, dto: GenerateInvoiceDto = {}): Promise<Invoice> {
    const sr = await this.srRepo.findOne({
      where: { id: serviceRequestId },
      relations: { customer: true, device: true },
    });
    if (!sr) throw new NotFoundException('Service request not found');

    const quoteItems = await this.quoteItemRepo.find({ where: { serviceRequestId } });
    if (!quoteItems.length) throw new NotFoundException('Add a quote before generating an invoice');

    // Build the frozen line-item snapshot with per-line GST.
    const lineItems: InvoiceLineItem[] = quoteItems.map((q) => {
      const taxRate = +q.taxRate;
      const taxableValue = r2(q.quantity * +q.unitPrice);
      const cgst = r2((taxableValue * taxRate) / 200);
      const sgst = r2((taxableValue * taxRate) / 200);
      return {
        itemName: q.itemName || undefined,
        description: q.description,
        hsnSac: q.hsnSac || '998713',
        unit: q.unit || 'PC',
        quantity: q.quantity,
        unitPrice: +q.unitPrice,
        taxRate,
        taxableValue,
        cgst,
        sgst,
        amount: r2(taxableValue + cgst + sgst),
      };
    });

    const taxableAmount = r2(lineItems.reduce((s, i) => s + i.taxableValue, 0));
    const cgst = r2(lineItems.reduce((s, i) => s + i.cgst, 0));
    const sgst = r2(lineItems.reduce((s, i) => s + i.sgst, 0));
    const grandRaw = taxableAmount + cgst + sgst;
    const totalAmount = Math.round(grandRaw);
    const roundOff = r2(totalAmount - grandRaw);

    const c = sr.customer;
    const invoiceNumber = await this.generateInvoiceNumber();
    const today = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();

    const invoice = this.invoiceRepo.create({
      serviceRequestId,
      invoiceNumber,
      invoiceDate: today.toISOString().slice(0, 10),
      dueDate: dto.dueDate ?? today.toISOString().slice(0, 10),
      taxableAmount,
      cgst,
      sgst,
      roundOff,
      totalAmount,
      amountInWords: amountInWords(totalAmount),
      reverseCharge: dto.reverseCharge ?? false,
      placeOfSupply: SELLER.placeOfSupply,
      buyerName: dto.buyerName ?? c?.name ?? '',
      buyerCompany: dto.buyerCompany ?? '',
      buyerContact: dto.buyerContact ?? c?.name ?? '',
      buyerPhone: dto.buyerPhone ?? c?.phone ?? '',
      buyerEmail: dto.buyerEmail ?? c?.email ?? '',
      buyerGstin: dto.buyerGstin ?? '',
      buyerPan: dto.buyerPan ?? '',
      billingAddress: dto.billingAddress ?? sr.pickupAddress ?? '',
      shippingAddress: dto.shippingAddress ?? dto.billingAddress ?? sr.pickupAddress ?? '',
      lineItems,
    });

    const saved = await this.invoiceRepo.save(invoice);

    // Best-effort archival to S3 (skipped silently when not configured).
    if (this.s3) {
      try {
        const buf = await buildInvoicePdf(saved);
        const key = `invoices/${invoiceNumber}.pdf`;
        await this.s3.send(new PutObjectCommand({
          Bucket: this.bucket, Key: key, Body: buf, ContentType: 'application/pdf',
        }));
        saved.pdfS3Url = `s3://${this.bucket}/${key}`;
        await this.invoiceRepo.save(saved);
      } catch { /* archival is optional */ }
    }

    return saved;
  }

  /** Rebuild the PDF on demand from the frozen invoice snapshot. */
  async renderPdfById(invoiceId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const buffer = await buildInvoicePdf(invoice);
    return { buffer, fileName: `${invoice.invoiceNumber}.pdf` };
  }

  async findByServiceRequest(serviceRequestId: string) {
    return this.invoiceRepo.find({ where: { serviceRequestId }, order: { createdAt: 'DESC' } });
  }

  async findAll() {
    const rows = await this.invoiceRepo.find({
      order: { createdAt: 'DESC' },
      relations: { serviceRequest: true },
    });
    // Shape for the admin list (subtotal/total/customer name).
    return rows.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      serviceRequest: i.serviceRequest ? { id: i.serviceRequest.id, ticketNumber: i.serviceRequest.serviceRequestNumber } : undefined,
      customer: { name: i.buyerCompany || i.buyerName },
      subtotal: +i.taxableAmount,
      cgst: +i.cgst,
      sgst: +i.sgst,
      total: +i.totalAmount,
      createdAt: i.createdAt,
    }));
  }
}
