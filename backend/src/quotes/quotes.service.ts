import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QuoteItem } from './quote-item.entity';
import { CreateQuoteDto } from './dto/quote.dto';
import { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { StatusHistory } from '../service-requests/entities/status-history.entity';
import { ServiceRequestStatus } from '../common/enums';

const DIAGNOSIS_FEE = 500; // INR incl. GST
const GST_RATE = 18; // 9% CGST + 9% SGST

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(QuoteItem) private quoteItemRepo: Repository<QuoteItem>,
    @InjectRepository(ServiceRequest) private srRepo: Repository<ServiceRequest>,
    private dataSource: DataSource,
  ) {}

  async createQuote(serviceRequestId: string, dto: CreateQuoteDto) {
    return this.dataSource.transaction(async (em) => {
      // Clear existing quote items for this SR
      await em.delete(QuoteItem, { serviceRequestId });

      const items: QuoteItem[] = [];

      for (const item of dto.items) {
        const taxRate = item.taxRate ?? GST_RATE;
        const total = item.quantity * item.unitPrice;
        const qi = em.create(QuoteItem, {
          serviceRequestId,
          itemName: item.itemName?.trim() || undefined,
          description: item.description,
          hsnSac: item.hsnSac?.trim() || '998713',
          unit: item.unit?.trim() || 'PC',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total,
          taxRate,
        });
        items.push(await em.save(qi));
      }

      // Add diagnosis fee line item if requested
      if (dto.includeDiagnosisFee) {
        const diagBase = +(DIAGNOSIS_FEE / 1.18).toFixed(2);
        const qi = em.create(QuoteItem, {
          serviceRequestId,
          description: 'Diagnosis Fee',
          quantity: 1,
          unitPrice: diagBase,
          total: diagBase,
          taxRate: GST_RATE,
        });
        items.push(await em.save(qi));
      }

      const sr = await em.findOne(ServiceRequest, { where: { id: serviceRequestId } });
      if (!sr) throw new NotFoundException('Service request not found');

      const fromStatus = sr.status;
      await em.update(ServiceRequest, serviceRequestId, {
        status: ServiceRequestStatus.QUOTATION_SHARED,
      });

      const history = em.create(StatusHistory, {
        serviceRequestId,
        fromStatus,
        toStatus: ServiceRequestStatus.QUOTATION_SHARED,
        notes: 'Quote shared with customer',
      });
      await em.save(history);

      return items;
    });
  }

  async getQuote(serviceRequestId: string) {
    const items = await this.quoteItemRepo.find({ where: { serviceRequestId } });
    if (!items.length) throw new NotFoundException('No quote found for this service request');

    const taxableAmount = items.reduce((sum, i) => sum + +i.total, 0);
    const totalGst = items.reduce((sum, i) => sum + +i.total * (+i.taxRate / 100), 0);
    const cgst = +(totalGst / 2).toFixed(2);
    const sgst = +(totalGst / 2).toFixed(2);
    const grandTotal = +(taxableAmount + totalGst).toFixed(2);

    return { items, taxableAmount, cgst, sgst, grandTotal };
  }
}
