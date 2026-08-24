/**
 * Zentrale Seitenliste. Einzige Quelle für Sitemap, llms.txt und die Tests, die
 * prüfen, ob jede Seite auch eine Markdown-Variante und eine Aushandlungsregel
 * in vercel.json hat. Neue Seite? Nur hier eintragen.
 */

export interface Route {
  /** Pfad mit führendem und abschließendem Slash, so wie er ausgeliefert wird. */
  path: string;
  /** Kurzer Name für maschinenlesbare Indizes (llms.txt, Agent Card). */
  label: string;
  /** Ein Satz für Agenten: Was steht auf dieser Seite? */
  summary: string;
  priority: string;
  /** Fremdsprachige Pfade, unter denen dieselbe Seite erreichbar ist. */
  aliases?: string[];
}

export const ROUTES: Route[] = [
  {
    path: '/',
    label: 'Community Moderation',
    summary:
      'Hauptseite: was Community Moderation ist, welche Leistungen ausgelagert werden, rechtlicher Rahmen (DSA, NetzDG, DSGVO), Ablauf, Kosten und Selbst-Check.',
    priority: '1.0',
  },
  {
    path: '/social-media-moderation/',
    label: 'Social Media Moderation',
    summary:
      'Moderation von Kommentaren, Anzeigenkommentaren und Direktnachrichten auf Instagram, Facebook, TikTok, YouTube und LinkedIn – inklusive Reaktionszeiten und Tonalität.',
    priority: '0.8',
  },
  {
    path: '/community-management-agentur/',
    label: 'Community Management Agentur',
    summary:
      'Abgrenzung Community Management (Strategie) zu Community Moderation (Tagesgeschäft) und was eine Agentur in beiden Rollen übernimmt.',
    priority: '0.8',
  },
  {
    path: '/krisenkommunikation-social-media/',
    label: 'Krisenkommunikation Social Media',
    summary:
      'Vorgehen bei Shitstorms und eskalierenden Kommentarlagen: Schwellen, Rollen, Reaktionsmuster und Dokumentation.',
    priority: '0.8',
  },
  {
    path: '/ueber-uns/',
    label: 'Über uns',
    summary:
      'Wer hinter community-moderation.de steht: famefact / track by track GmbH aus Berlin, Team, Historie seit 2009, Arbeitsweise und Referenzen.',
    priority: '0.5',
    aliases: ['/about', '/about-us'],
  },
  {
    path: '/kontakt/',
    label: 'Kontakt',
    summary:
      'Alle Kontaktwege: WhatsApp, E-Mail, Telefon, Postanschrift, Erreichbarkeitszeiten und was wir für ein belastbares Erstgespräch brauchen.',
    priority: '0.5',
    aliases: ['/contact'],
  },
  {
    path: '/impressum/',
    label: 'Impressum',
    summary:
      'Anbieterkennzeichnung nach § 5 DDG: track by track GmbH, Geschäftsführung, Handelsregister, USt-IdNr.',
    priority: '0.2',
    aliases: ['/imprint', '/legal'],
  },
  {
    path: '/datenschutz/',
    label: 'Datenschutzerklärung',
    summary:
      'Datenschutzerklärung nach DSGVO: Hosting, Reichweitenmessung, WhatsApp-Kontakt, Selbst-Check und Betroffenenrechte.',
    priority: '0.2',
    aliases: ['/privacy', '/privacy-policy'],
  },
];

/** Pfad der Markdown-Variante einer Seite (wird beim Build aus dem HTML erzeugt). */
export function markdownPath(path: string): string {
  return `${path}index.md`;
}

/** Alle Aliase mit ihrem Ziel, für vercel.json und Tests. */
export const ALIASES: Array<{ from: string; to: string }> = ROUTES.flatMap((r) =>
  (r.aliases ?? []).map((from) => ({ from, to: r.path })),
);
