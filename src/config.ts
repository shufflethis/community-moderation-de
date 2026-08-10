/** Zentrale Kontakt- und Firmendaten. Nur hier ändern. */

/** WhatsApp-Nummer, ausschließlich für WhatsApp — nicht als Telefonnummer ausschreiben. */
export const WHATSAPP_NUMBER = '491715280138';

/** Baut einen wa.me-Deeplink mit vorbefülltem Text. */
export function wa(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const SITE = 'https://community-moderation.de';
export const EMAIL = 'info@famefact.com';
export const PHONE = '+4930403665430';
export const PHONE_LABEL = '030 403 665 430';

export const COMPANY = {
  legal: 'track by track GmbH',
  brand: 'famefact',
  street: 'Schliemannstr. 23',
  zip: '10437',
  city: 'Berlin',
  ceo: 'Tobias Sander',
  court: 'Amtsgericht Berlin-Charlottenburg',
  hrb: 'HRB 129805 B',
  vat: 'DE814954842',
};
