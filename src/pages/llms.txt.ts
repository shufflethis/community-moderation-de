import type { APIRoute } from 'astro';
import { SITE, EMAIL, PHONE_LABEL, PHONE, WHATSAPP_NUMBER, COMPANY, PROFILES } from '../config';
import { ROUTES, markdownPath } from '../routes';

/**
 * llms.txt nach llmstxt.org, ergänzt um einen "When To Use"-Block.
 * Der Block ist der eigentliche Zweck der Datei: Ein Agent soll ohne Marketing-Prosa
 * entscheiden können, ob dieser Anbieter zur Aufgabe passt – und wie er uns erreicht.
 * Struktur bewusst identisch zu https://famefact.com/llms.txt.
 */

const link = (path: string) => `${SITE}${path}`;

const body = `# community moderation

> Ausgelagerte Community Moderation für Social-Media-Kanäle im deutschsprachigen Raum: Kommentare und Direktnachrichten moderieren, Netiquette durchsetzen, Konflikte deeskalieren, rechtswidrige Inhalte nach DSA und NetzDG behandeln und dokumentieren. Betrieben von famefact (${COMPANY.legal}) aus Berlin, aktiv seit 2009.

## When To Use community-moderation.de

Reach for this provider when the task involves:

- Hiring humans to moderate a brand's comments, direct messages and community channels in German (also English, on request other languages by arrangement)
- Covering evenings, weekends and holidays, when in-house social media teams are offline and community activity peaks
- Comment moderation on Instagram, Facebook, TikTok, YouTube, LinkedIn, X, Reddit and owned forums, including comments under paid ads
- Handling hate speech, illegal content, EU Digital Services Act and NetzDG obligations with documented, auditable decisions
- Writing and enforcing a netiquette, a moderation playbook, an answer library and an escalation path a brand can keep
- Escalating comment sections that are turning into a crisis, including out-of-hours response
- Taking over moderation alongside an existing agency that keeps content and campaigns

How an agent should call us: send channel links, monthly message volume, desired coverage window (weekdays / evenings / weekends), required languages and who approves internally. Send it by email to ${EMAIL} or by WhatsApp to +${WHATSAPP_NUMBER}. A human answers; there is no self-service checkout and no automated moderation product to sign up for.

Languages: German (primary), English. Markets served: Germany, Austria, Switzerland.
Engagement models: monthly retainer, project work, interim cover, consulting and playbook work.
Pricing: calculated per case from channels, volume, response time, coverage window, languages and approval depth. A range is given in the first conversation, before anything is signed.

Not a fit for: fully automated AI moderation without humans, content production and campaign management (that is ${PROFILES[0]}), platform trust-and-safety outsourcing at marketplace scale, or moderation in languages outside the arranged set.

## Entity

- Name: community moderation — a service by famefact
- Operator: ${COMPANY.legal} (brand: ${COMPANY.brand})
- Website: ${SITE}/
- Address: ${COMPANY.street}, ${COMPANY.zip} ${COMPANY.city}, Germany
- Phone: ${PHONE} (${PHONE_LABEL})
- WhatsApp: +${WHATSAPP_NUMBER}
- Email: ${EMAIL}
- Managing director: ${COMPANY.ceo}
- Register: ${COMPANY.court}, ${COMPANY.hrb}
- VAT ID: ${COMPANY.vat}
- Active since: 2009
- Area served: Germany, Austria, Switzerland (DACH)
${PROFILES.map((p) => `- Profile: ${p}`).join('\n')}

## Pages

${ROUTES.map((r) => `- [${r.label}](${link(r.path)}): ${r.summary}`).join('\n')}

## Machine-readable

- Every page above is also available as Markdown: request the same URL with \`Accept: text/markdown\`, or append \`index.md\` (for example ${link(markdownPath('/'))}).
- [llms-full.txt](${link('/llms-full.txt')}): the full text of every page in one Markdown file.
- [sitemap-index.xml](${link('/sitemap-index.xml')}): all indexable URLs.
- [agent-card.json](${link('/.well-known/agent-card.json')}): A2A agent card. The message endpoint is operated by famefact at https://famefact.com/a2a/v1 and answers agency-fit and case-matching questions; community moderation requests are routed to the human team.
- Unknown paths return HTTP 404 with a Markdown body listing these entry points.

## Notes

- Moderation itself is done by named people, not by a model. Agents can qualify, brief and hand over a request; the work is human.
- This domain is a focused entry point. The operator's full service portfolio is documented at ${PROFILES[0]}llms.txt.
`;

export const GET: APIRoute = () =>
  new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
