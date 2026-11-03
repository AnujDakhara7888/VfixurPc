/**
 * Static seller / company details printed on every tax invoice.
 * Override any value with an environment variable of the same name if needed.
 */
export const SELLER = {
  tradeName: process.env.INV_TRADE_NAME ?? 'Vfixurpc.com',
  website: process.env.INV_WEBSITE ?? 'https://www.vfixurpc.com',
  contactName: process.env.INV_CONTACT_NAME ?? 'Hriday Bhatia',
  address:
    process.env.INV_ADDRESS ??
    '99, Ratna Jyot Ind Est, Irla Rd, near jai ambe Chowk, Vile Parle West, Mumbai, Maharashtra 400056, Mumbai, Maharashtra (MH-27) 400056, IN',
  phone: process.env.INV_PHONE ?? '+917039552137',
  email: process.env.INV_EMAIL ?? 'accounts@vfixurpc.com',
  gstin: process.env.INV_GSTIN ?? '27FXQPB4377D1Z8',
  stateCode: process.env.INV_STATE_CODE ?? '27',
  placeOfSupply: process.env.INV_PLACE_OF_SUPPLY ?? 'Maharashtra (27)',
};

export const BANK = {
  accountHolder: process.env.INV_BANK_HOLDER ?? 'Vfixurpc.com',
  bankName: process.env.INV_BANK_NAME ?? 'Kotak Mahindra Bank',
  accountNumber: process.env.INV_BANK_ACCOUNT ?? '4650865125',
  ifsc: process.env.INV_BANK_IFSC ?? 'KKBK0000664',
  branch: process.env.INV_BANK_BRANCH ?? 'Vile Parle West',
  upiId: process.env.INV_UPI_ID ?? '0790674A0219141.bqr@kotak',
};

/**
 * UPI VPA used to build the scannable "scan & pay" QR. The QR encodes the
 * payee + the exact invoice amount, so any UPI app opens pre-filled.
 */
export const UPI_QR = {
  vpa: process.env.INV_UPI_QR_VPA ?? 'hridaybhatia2003-2@oksbi',
  payeeName: process.env.INV_UPI_QR_NAME ?? 'Hriday Bhatia',
};

export const INVOICE_TERMS = [
  'Payment: Full payment is due upon completion of service.',
  'Warranty: Warranty is provided by the respective service center as per product terms.',
  'Data Responsibility: Customers are advised to back up their data before availing any service. We are not responsible for any data loss during repair or service procedures.',
  'Service Scope: The invoice reflects only the services explicitly rendered. Any additional issues identified post-delivery will be considered a new service request.',
  'No Refund Policy: Payments once made are non-refundable. In case of dissatisfaction, corrective service will be provided within the warranty window.',
  'Jurisdiction: All disputes are subject to Mumbai jurisdiction only.',
];
