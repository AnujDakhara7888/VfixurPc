import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
let QRCode: any = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { QRCode = require('qrcode'); } catch { /* QR optional */ }
import type { InvoiceLineItem } from './invoice.entity';
import { SELLER, BANK, UPI_QR, INVOICE_TERMS } from './invoice.config';

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  createdAt?: Date;
  taxableAmount: number | string;
  cgst: number | string;
  sgst: number | string;
  roundOff: number | string;
  totalAmount: number | string;
  amountInWords?: string;
  reverseCharge?: boolean;
  placeOfSupply?: string;
  buyerName?: string;
  buyerCompany?: string;
  buyerContact?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerGstin?: string;
  buyerPan?: string;
  billingAddress?: string;
  shippingAddress?: string;
  lineItems: InvoiceLineItem[];
}

const N = (v: number | string | undefined) => Number(v ?? 0) || 0;

/** Indian-grouped money, 2 decimals, no symbol. e.g. 5300 -> "5,300.00" */
export function inr(v: number | string): string {
  const n = N(v);
  const fixed = Math.abs(n).toFixed(2);
  const [intp, dec] = fixed.split('.');
  const last3 = intp.slice(-3);
  const rest = intp.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${n < 0 ? '-' : ''}${grouped}.${dec}`;
}
const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')} - ${d.toLocaleString('en-US', { month: 'short' })} - ${d.getFullYear()}`;

const ASSET_DIR = path.join(__dirname, 'assets');
const asset = (f: string) => path.join(ASSET_DIR, f);

export async function buildInvoicePdf(inv: InvoicePdfData): Promise<Buffer> {
  // Pre-render the UPI QR (encodes payee + exact invoice amount).
  let qrBuf: Buffer | null = null;
  const total = N(inv.totalAmount);
  if (QRCode) {
    try {
      const upi = `upi://pay?pa=${UPI_QR.vpa}&pn=${encodeURIComponent(UPI_QR.payeeName)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Invoice ' + inv.invoiceNumber)}`;
      qrBuf = await QRCode.toBuffer(upi, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
    } catch { /* skip QR on failure */ }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 28 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Fonts: DejaVu supports the ₹ glyph; fall back to Helvetica + "Rs." if missing.
    let F = 'Helvetica', FB = 'Helvetica-Bold', RS = 'Rs. ';
    try {
      if (fs.existsSync(asset('DejaVuSans.ttf')) && fs.existsSync(asset('DejaVuSans-Bold.ttf'))) {
        doc.registerFont('R', asset('DejaVuSans.ttf'));
        doc.registerFont('B', asset('DejaVuSans-Bold.ttf'));
        F = 'R'; FB = 'B'; RS = '₹ ';
      }
    } catch { /* keep Helvetica */ }
    const money = (v: number | string) => `${RS}${inr(v)}`;

    const L = 28, R = 567, INK = '#0F1115', MUT = '#5B616E', LINE = '#C9CED6', ACC = '#0E7CA8';
    const items = inv.lineItems ?? [];

    const hr = (y: number, x0 = L, x1 = R, color = LINE) =>
      doc.moveTo(x0, y).lineTo(x1, y).lineWidth(0.6).strokeColor(color).stroke();
    const box = (x: number, y: number, w: number, h: number) =>
      doc.rect(x, y, w, h).lineWidth(0.7).strokeColor(LINE).stroke();
    const vline = (x: number, y0: number, y1: number) =>
      doc.moveTo(x, y0).lineTo(x, y1).lineWidth(0.6).strokeColor(LINE).stroke();

    // ── Title ──
    doc.fillColor(INK).font(FB).fontSize(13).text('Tax Invoice', L, 30, { width: R - L, align: 'center' });
    doc.font(F).fontSize(7).fillColor(MUT).text('Original for recipient', L, 32, { width: R - L, align: 'right' });

    // ── Seller / contact header ──
    let y = 52;
    const headH = 66;
    box(L, y, R - L, headH);
    const midX = 348, logoX = 470;
    doc.font(FB).fontSize(12).fillColor(ACC).text(SELLER.tradeName, L + 8, y + 7);
    doc.font(F).fontSize(6.6).fillColor(MUT).text(SELLER.address, L + 8, y + 23, { width: midX - L - 14 });
    doc.fillColor(INK).fontSize(6.6)
      .text(`Phone: ${SELLER.phone}    Email: ${SELLER.email}`, L + 8, y + 49, { width: midX - L - 14 })
      .text(`GSTIN: ${SELLER.gstin}`, L + 8, y + 57, { width: midX - L - 14 });
    doc.font(FB).fontSize(7).fillColor(INK).text('Contact Name:', midX + 8, y + 9);
    doc.font(F).text(SELLER.contactName, midX + 78, y + 9);
    doc.font(FB).text('Website:', midX + 8, y + 21);
    doc.font(F).fillColor(ACC).text(SELLER.website, midX + 78, y + 21);
    vline(midX, y, y + headH);
    vline(logoX, y, y + headH);
    if (fs.existsSync(asset('logo.png'))) {
      try { doc.image(asset('logo.png'), logoX + 8, y + 10, { fit: [88, 46] }); } catch { /* skip */ }
    } else {
      doc.font(FB).fontSize(12).fillColor(INK).text('vfixur', logoX + 10, y + 28, { continued: true }).fillColor(ACC).text('PC');
    }

    // ── Bill To / Invoice meta ──
    y += headH;
    const metaX = 322;
    const blockH = 100;
    box(L, y, R - L, blockH);
    vline(metaX, y, y + blockH);

    doc.font(FB).fontSize(8).fillColor(INK).text('Bill To', L + 8, y + 6);
    doc.font(FB).fontSize(9).text(inv.buyerCompany || inv.buyerName || '—', L + 8, y + 18, { width: metaX - L - 16 });
    const lv = (label: string, val: string, yy: number) => {
      doc.font(F).fontSize(7).fillColor(MUT).text(label, L + 8, yy, { width: 48 });
      doc.fillColor(INK).fontSize(7).text(val, L + 58, yy, { width: metaX - L - 66 });
      return doc.heightOfString(val, { width: metaX - L - 66 });
    };
    let by = y + 33;
    if (inv.buyerContact) { lv('Contact', inv.buyerContact, by); by += 11; }
    if (inv.buyerPhone) { lv('Phone', inv.buyerPhone, by); by += 11; }
    if (inv.billingAddress) { by += Math.max(11, lv('Address', inv.billingAddress, by) + 3); }
    if (inv.buyerGstin) { lv('GSTIN', inv.buyerGstin, by); by += 11; }
    if (inv.buyerPan) { lv('PAN', inv.buyerPan, by); by += 11; }

    const ml = (label: string, val: string, yy: number, strong = false) => {
      doc.font(F).fontSize(7).fillColor(MUT).text(label, metaX + 8, yy, { width: 74 });
      doc.font(strong ? FB : F).fontSize(7.5).fillColor(INK).text(val, metaX + 86, yy, { width: R - metaX - 94 });
    };
    const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : (inv.createdAt ?? new Date());
    ml('Invoice No.', inv.invoiceNumber, y + 8, true);
    ml('Invoice Date', fmtDate(invDate), y + 20);
    ml('Amount Due', money(total), y + 32, true);
    ml('Due Date', fmtDate(inv.dueDate ? new Date(inv.dueDate) : invDate), y + 44);
    ml('Reverse Charges', inv.reverseCharge ? 'Yes' : 'N', y + 56);
    if (inv.shippingAddress) {
      doc.font(FB).fontSize(7).fillColor(MUT).text('Ship To', metaX + 8, y + 70);
      doc.font(F).fontSize(6.6).fillColor(INK).text(inv.shippingAddress, metaX + 8, y + 80, { width: R - metaX - 16 });
    }

    // ── Items table ──
    y += blockH;
    const tableTop = y;
    const cols = [L, 52, 196, 252, 296, 352, 416, 442, 488, 528, R];
    const heads = ['No', 'Item/Description', 'HSN/SAC', 'Qty UoM', 'Price', 'Taxable', '%', 'CGST', 'SGST', 'Amount'];
    const al: ('left' | 'right' | 'center')[] = ['left', 'left', 'center', 'center', 'right', 'right', 'center', 'right', 'right', 'right'];
    const hH = 18;
    doc.rect(L, y, R - L, hH).fillColor('#0F1F35').fill();
    doc.font(FB).fontSize(6.4).fillColor('#FFFFFF');
    heads.forEach((h, i) => doc.text(h, cols[i] + 3, y + 6, { width: cols[i + 1] - cols[i] - 6, align: al[i] }));
    y += hH;

    items.forEach((raw, idx) => {
      const it = {
        ...raw,
        quantity: N(raw.quantity), taxableValue: N(raw.taxableValue),
        cgst: N(raw.cgst), sgst: N(raw.sgst), amount: N(raw.amount), taxRate: N(raw.taxRate),
      };
      const descH = Math.max(20, (it.itemName ? 2 : 1) * 9 + 7);
      const cy = y + 4;
      const unitGross = it.quantity ? it.amount / it.quantity : it.amount;
      const cells = ['', '', it.hsnSac, `${it.quantity} ${it.unit}`, inr(unitGross), inr(it.taxableValue), `${it.taxRate}%`, inr(it.cgst), inr(it.sgst), inr(it.amount)];
      doc.font(F).fontSize(7).fillColor(INK).text(String(idx + 1), cols[0] + 3, cy, { width: cols[1] - cols[0] - 6 });
      cells.forEach((val, i) => {
        if (i <= 1) return;
        doc.font(F).fontSize(7).fillColor(INK).text(val, cols[i] + 3, cy, { width: cols[i + 1] - cols[i] - 6, align: al[i] });
      });
      if (it.itemName) {
        doc.font(FB).fontSize(7).fillColor(INK).text(it.itemName, cols[1] + 3, cy, { width: cols[2] - cols[1] - 6 });
        doc.font(F).fontSize(6.2).fillColor(MUT).text(it.description, cols[1] + 3, cy + 9, { width: cols[2] - cols[1] - 6 });
      } else {
        doc.font(F).fontSize(7).fillColor(INK).text(it.description, cols[1] + 3, cy, { width: cols[2] - cols[1] - 6 });
      }
      hr(y + descH);
      y += descH;
    });

    // totals row
    doc.font(FB).fontSize(7).fillColor(INK);
    doc.text(`@${N(items[0]?.taxRate) || 18}%`, cols[1] + 3, y + 4);
    doc.text('Total', cols[3] + 3, y + 4, { width: cols[5] - cols[3] - 6, align: 'right' });
    doc.text(inr(inv.taxableAmount), cols[5] + 3, y + 4, { width: cols[6] - cols[5] - 6, align: 'right' });
    doc.text(inr(inv.cgst), cols[7] + 3, y + 4, { width: cols[8] - cols[7] - 6, align: 'right' });
    doc.text(inr(inv.sgst), cols[8] + 3, y + 4, { width: cols[9] - cols[8] - 6, align: 'right' });
    doc.text(inr(inv.totalAmount), cols[9] + 3, y + 4, { width: cols[10] - cols[9] - 6, align: 'right' });
    y += 16;

    box(L, tableTop, R - L, y - tableTop);
    for (let i = 1; i < cols.length - 1; i++) vline(cols[i], tableTop, y);

    // ── Summary ──
    y += 10;
    const sumX = 352;
    doc.font(FB).fontSize(7.5).fillColor(INK).text('Total in words', L, y);
    doc.font(F).fontSize(7.5).fillColor(MUT).text(`${RS}${inv.amountInWords ?? ''}`, L, y + 11, { width: sumX - L - 12 });

    const totQty = items.reduce((s, i) => s + N(i.quantity), 0);
    const sl = (label: string, val: string, yy: number, strong = false) => {
      doc.font(F).fontSize(7.5).fillColor(MUT).text(label, sumX, yy, { width: 120 });
      doc.font(strong ? FB : F).fontSize(7.5).fillColor(INK).text(val, sumX + 110, yy, { width: R - sumX - 110, align: 'right' });
    };
    sl('Total Items / Qty', `${items.length} / ${totQty} ${items[0]?.unit ?? 'PC'}`, y);
    sl('Total Taxable Value', money(inv.taxableAmount), y + 12);
    sl('Total Tax Amount', money(N(inv.cgst) + N(inv.sgst)), y + 24);
    sl('Rounded Off', money(inv.roundOff), y + 36);
    hr(y + 50, sumX, R);
    sl('Total Value (in figure)', money(inv.totalAmount), y + 54, true);

    // ── Bank + QR + signature ──
    y += 78;
    const bankH = 104;
    box(L, y, R - L, bankH);
    vline(sumX, y, y + bankH);
    const bk = (label: string, val: string, yy: number) =>
      doc.font(FB).fontSize(6.8).fillColor(INK).text(label, L + 8, yy, { continued: true }).font(F).fillColor(MUT).text(` ${val}`);
    doc.font(FB).fontSize(7.5).fillColor(INK).text('Payment details', L + 8, y + 7);
    bk('Account Holder:', BANK.accountHolder, y + 20);
    bk('Bank:', BANK.bankName, y + 31);
    bk('A/C No:', BANK.accountNumber, y + 42);
    bk('IFSC:', BANK.ifsc, y + 53);
    bk('Branch:', BANK.branch, y + 64);
    bk('UPI ID:', BANK.upiId, y + 75);
    // QR
    if (qrBuf) {
      const qx = sumX - 96, qy = y + 16;
      try { doc.image(qrBuf, qx, qy, { fit: [72, 72] }); } catch { /* skip */ }
      doc.font(FB).fontSize(6).fillColor(INK).text('PAYMENT QR CODE', qx - 6, qy + 74, { width: 84, align: 'center' });
      doc.font(F).fontSize(5.6).fillColor(MUT).text('Scan to pay the invoice amount', qx - 10, qy + 82, { width: 92, align: 'center' });
    }
    doc.font(F).fontSize(7).fillColor(MUT).text('For ' + SELLER.tradeName, sumX + 8, y + 14, { width: R - sumX - 16, align: 'right' });
    doc.fontSize(6.8).text('Authorised Signatory', sumX + 8, y + 84, { width: R - sumX - 16, align: 'right' });

    // ── Terms ──
    y += bankH + 12;
    doc.font(FB).fontSize(7.5).fillColor(INK).text('Terms & Conditions', L, y);
    doc.font(F).fontSize(6.4).fillColor(MUT);
    let ty = y + 12;
    INVOICE_TERMS.forEach((t, i) => {
      const line = `${i + 1}. ${t}`;
      doc.text(line, L, ty, { width: R - L });
      ty += doc.heightOfString(line, { width: R - L }) + 2;
    });

    doc.end();
  });
}
