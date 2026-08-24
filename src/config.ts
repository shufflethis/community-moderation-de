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

/**
 * Offizielle Profile der Betreiberin. Dienen als sameAs in JSON-LD und als
 * Entity-Block in llms.txt — identisch gepflegt wie auf famefact.com, damit
 * beide Domains dieselbe Identität belegen.
 */
export const PROFILES = [
  'https://famefact.com/',
  'https://www.linkedin.com/company/1774404/',
  'https://www.instagram.com/famefact/',
  'https://www.facebook.com/famefact/',
  'https://x.com/famefact',
];

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
