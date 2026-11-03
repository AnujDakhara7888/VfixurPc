export const SUPPORT_PHONE_E164 = '+917039552137';
export const SUPPORT_PHONE_DISPLAY = '+91 70395 52137';
export const SUPPORT_WHATSAPP_NUMBER = '917039552137';

export function supportWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
