/**
 * A2A-Einstieg für Agenten, die menschliche Community Moderation suchen.
 *
 * Bewusst regelbasiert: Der Endpunkt ordnet eine Anfrage ein, sagt ehrlich, ob
 * sie passt, benennt die fehlenden Angaben und übergibt an einen Menschen.
 * Er speichert nichts, verschickt nichts und braucht keine Zugangsdaten – die
 * Vermittlung ist automatisierbar, die Moderation nicht.
 */
// .js-Endung, weil diese Datei in der Vercel-Funktion landet – siehe api/a2a.ts.
import { SITE, EMAIL, PHONE, PHONE_LABEL, WHATSAPP_NUMBER, wa } from './config.js';

export const A2A_PATH = '/a2a/v1';
export const AGENT_CARD_PATH = '/.well-known/agent-card.json';

export interface HandlerResult {
  status: number;
  body: unknown;
  /** Zusätzliche Header, z. B. Allow bei 405. */
  headers?: Record<string, string>;
}

interface Signal {
  /** Skill-ID aus der Agent Card. */
  skill: string;
  pattern: RegExp;
}

const CHANNELS: Array<[string, RegExp]> = [
  ['Instagram', /instagram|insta\b|reels?\b/i],
  ['Facebook', /facebook|meta\b|fb\b/i],
  ['TikTok', /tiktok/i],
  ['YouTube', /youtube|shorts\b/i],
  ['LinkedIn', /linkedin/i],
  ['X/Twitter', /\bx\.com|twitter|\bx\b(?=\s*(kanal|account|profil))/i],
  ['Reddit', /reddit|subreddit/i],
  ['Discord', /discord/i],
  ['Foren', /\bforum|foren\b|community-plattform/i],
  ['Twitch', /twitch/i],
  ['Pinterest', /pinterest/i],
  ['App-Store-Bewertungen', /app.?store|play.?store|bewertungen|reviews?\b/i],
];

const COVERAGE: Array<[string, RegExp]> = [
  ['Abende', /abend|evening|nachts?\b|night|nach feierabend|after hours|out.?of.?hours/i],
  ['Wochenende', /wochenend|weekend|samstag|sonntag|saturday|sunday/i],
  ['Feiertage', /feiertag|holiday/i],
  ['rund um die Uhr', /24\s?\/\s?7|rund um die uhr|around the clock/i],
  ['Werktags', /werktag|business hours|mo\W?-\W?fr|montag bis freitag/i],
];

const LANGUAGES: Array<[string, RegExp]> = [
  ['Deutsch', /deutsch|german|de-DE|\bdach\b/i],
  ['Englisch', /englisch|english/i],
  ['Französisch', /franz(ö|oe)sisch|french/i],
  ['Spanisch', /spanisch|spanish/i],
  ['Italienisch', /italienisch|italian/i],
  ['Niederländisch', /niederl(ä|ae)ndisch|dutch/i],
  ['Polnisch', /polnisch|polish/i],
  ['Türkisch', /t(ü|ue)rkisch|turkish/i],
];

const SIGNALS: Signal[] = [
  {
    skill: 'community-crisis-response',
    pattern: /shitstorm|krise|krisen|eskaliert|eskalation|brigading|welle von kommentaren|crisis|backlash|rückruf|recall/i,
  },
  {
    skill: 'dsa-netzdg-moderation-compliance',
    pattern: /\bdsa\b|digital services act|netzdg|hate ?speech|hassrede|rechtswidrig|strafbar|illegal content|jugendschutz|meldepflicht|dokumentationspflicht|compliance/i,
  },
  {
    skill: 'moderation-playbook-and-netiquette',
    pattern: /netiquette|leitfaden|playbook|regelwerk|guidelines?|schulung|training|antwortbibliothek|tonalität|tone of voice|dokumentation übergeben|inhouse holen|in.?house/i,
  },
  {
    skill: 'out-of-hours-comment-coverage',
    pattern: /abend|wochenend|feiertag|nachts?\b|24\s?\/\s?7|evening|weekend|night|out.?of.?hours|after hours|schicht/i,
  },
  {
    skill: 'human-community-moderation-dach',
    pattern: /moderation|moderieren|kommentare?|kommentarspalte|direktnachricht|\bdms?\b|community|postfach|social customer care|comments?\b|messages?\b/i,
  },
];

/** Anfragen, für die wir nicht die Richtigen sind – lieber vorher sagen. */
const OUT_OF_SCOPE: Array<[string, RegExp]> = [
  [
    'vollautomatische Moderation ohne Menschen',
    /vollautomat|ohne menschen|nur\s+(ki|ai)\b|ai.?only|fully automated|automatisch moderieren lassen|bot soll (das )?moderieren/i,
  ],
  [
    'Content-Produktion und Kampagnen statt Moderation',
    /content.?produktion|kampagnen(management|betreuung)|redaktionsplan erstellen|social ads|performance marketing|google ads/i,
  ],
  ['Trust & Safety in Marktplatz-Größenordnung', /marktplatz|marketplace|trust ?(&|and) ?safety|user generated content plattform/i],
  ['Webentwicklung', /website (bauen|entwickeln)|web development|shop entwickeln/i],
];

export interface Intake {
  channels: string[];
  coverage: string[];
  languages: string[];
  volume: string | null;
  urgent: boolean;
  approvalMentioned: boolean;
  skills: string[];
  outOfScope: string[];
}

/** Monatsvolumen aus dem Text ziehen, z. B. "30.000 Kommentare im Monat". */
function extractVolume(text: string): string | null {
  const match = text.match(
    /(\d{1,3}(?:[.,]\d{3})+|\d+\s?k\b|\d{2,7})\s*(?:\+\s*)?(kommentare|nachrichten|messages|comments|dms|anfragen)/i,
  );
  return match ? `${match[1].trim()} ${match[2].toLowerCase()}` : null;
}

const collect = (text: string, table: Array<[string, RegExp]>) =>
  table.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);

export function analyse(text: string): Intake {
  return {
    channels: collect(text, CHANNELS),
    coverage: collect(text, COVERAGE),
    languages: collect(text, LANGUAGES),
    volume: extractVolume(text),
    urgent: /sofort|dringend|heute (abend|noch)|jetzt gerade|asap|urgent|right now|tonight|läuft gerade/i.test(text),
    approvalMentioned: /freigabe|abnahme|approval|abstimmung|vier.?augen/i.test(text),
    skills: SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.skill),
    outOfScope: collect(text, OUT_OF_SCOPE),
  };
}

export type Fit = 'yes' | 'unclear' | 'no';

export function assessFit(intake: Intake): Fit {
  if (intake.outOfScope.length && !intake.skills.includes('human-community-moderation-dach')) return 'no';
  if (intake.outOfScope.length && intake.skills.length <= 1) return 'no';
  if (intake.skills.length || intake.channels.length) return 'yes';
  return 'unclear';
}

/** Was für eine belastbare Einschätzung noch fehlt – dieselben Punkte wie auf /kontakt/. */
export function missingFacts(intake: Intake): string[] {
  const missing: string[] = [];
  if (!intake.channels.length) missing.push('channels: which channels, including ad accounts');
  if (!intake.volume) missing.push('volume: rough number of messages per month');
  if (!intake.coverage.length) missing.push('coverage: weekdays only, evenings, weekends, holidays');
  if (!intake.languages.length) missing.push('languages: which languages moderation must answer in');
  if (!intake.approvalMentioned) missing.push('approvals: who signs off internally and how fast');
  return missing;
}

/**
 * Sprache der Antwort. Gezählt wird, nicht geraten: Wörter wie "moderation" oder
 * "community" gibt es in beiden Sprachen und taugen nicht als Merkmal.
 * Bei Gleichstand gewinnt Deutsch – das ist die Sprache der Seite.
 */
const GERMAN_MARKERS = /\b(und|oder|wir|uns|unser|unsere|nicht|für|ist|sind|brauchen|suchen|können|möchten|haben|bitte|euch|dass|abends|wochenende|kanäle|schnell)\b/gi;
const ENGLISH_MARKERS = /\b(we|our|need|want|looking|the|and|for|with|please|you|are|can|would|should|hours|weekend|channels)\b/gi;

const isGerman = (text: string) =>
  (text.match(GERMAN_MARKERS) ?? []).length >= (text.match(ENGLISH_MARKERS) ?? []).length;

function summary(intake: Intake, fit: Fit, missing: string[], german: boolean): string {
  const understood = [
    intake.channels.length && (german ? `Kanäle: ${intake.channels.join(', ')}` : `channels: ${intake.channels.join(', ')}`),
    intake.coverage.length && (german ? `Abdeckung: ${intake.coverage.join(', ')}` : `coverage: ${intake.coverage.join(', ')}`),
    intake.volume && (german ? `Volumen: ${intake.volume}` : `volume: ${intake.volume}`),
    intake.languages.length && (german ? `Sprachen: ${intake.languages.join(', ')}` : `languages: ${intake.languages.join(', ')}`),
    intake.urgent && (german ? 'Dringlichkeit: sofort' : 'urgency: immediate'),
  ]
    .filter(Boolean)
    .join(' · ');

  const head = german
    ? {
        yes: 'Ja, das ist unser Fall. community moderation ist der Moderationsdienst von famefact aus Berlin – Menschen moderieren eure Kommentare und Direktnachrichten im vereinbarten Zeitfenster, inklusive Abenden und Wochenenden.',
        unclear:
          'Möglicherweise passend. Aus der Anfrage geht noch nicht hervor, ob es um laufende Moderation geht. community moderation übernimmt Kommentare, Direktnachrichten und Eskalationen auf euren eigenen Kanälen – mit Menschen, nicht mit einem Modell.',
        no: `Dafür sind wir nicht die Richtigen: ${intake.outOfScope.join(', ')}. community moderation macht menschliche Moderation auf eigenen Kanälen. Das übrige Leistungsspektrum liegt bei famefact.com.`,
      }[fit]
    : {
        yes: 'Yes, this is a fit. community moderation is the moderation service of famefact, Berlin — people moderate your comments and direct messages inside an agreed coverage window, including evenings and weekends.',
        unclear:
          'Possibly a fit. The request does not yet say whether this is about ongoing moderation. community moderation handles comments, direct messages and escalations on your own channels — with people, not a model.',
        no: `Not a fit: ${intake.outOfScope.join(', ')}. community moderation does human moderation on owned channels. The wider service portfolio sits at famefact.com.`,
      }[fit];

  const parts = [head];
  if (understood) parts.push(german ? `Verstanden: ${understood}.` : `Understood: ${understood}.`);
  if (fit !== 'no' && missing.length) {
    parts.push(
      german
        ? `Für eine belastbare Preisspanne fehlen noch: ${missing.join('; ')}.`
        : `Still needed for a reliable price range: ${missing.join('; ')}.`,
    );
  }
  parts.push(
    german
      ? `Weiter mit einem Menschen: ${EMAIL}, WhatsApp +${WHATSAPP_NUMBER}, Telefon ${PHONE_LABEL}. ${intake.urgent ? 'Bei laufender Eskalation ist WhatsApp der schnellste Weg. ' : ''}Diese Antwort ist regelbasiert, es wurde nichts gespeichert.`
      : `Continue with a human: ${EMAIL}, WhatsApp +${WHATSAPP_NUMBER}, phone ${PHONE}. ${intake.urgent ? 'For a live escalation, WhatsApp is the fastest route. ' : ''}This reply is rule-based and nothing was stored.`,
  );
  return parts.join(' ');
}

/** Text aus einer A2A-Message ziehen – akzeptiert die üblichen Schreibweisen. */
export function textOf(message: unknown): string {
  const parts = (message as { parts?: unknown })?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => {
      const p = part as { text?: unknown; kind?: string; type?: string; data?: unknown };
      if (typeof p?.text === 'string') return p.text;
      if (p?.data && typeof p.data === 'object') return JSON.stringify(p.data);
      return '';
    })
    .join('\n')
    .trim();
}

const uuid = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `msg-${Math.abs(Date.now() ^ 0x5f3759df).toString(36)}`;

/** Die eigentliche Antwort: eine A2A-Message mit Text- und Datenteil. */
export function buildReply(message: unknown): Record<string, unknown> {
  const text = textOf(message);
  const intake = analyse(text);
  const fit = assessFit(intake);
  const missing = missingFacts(intake);
  const german = !text || isGerman(text);
  const contextId = (message as { contextId?: unknown })?.contextId;

  const brief = [
    text ? `Anfrage: ${text.slice(0, 400)}` : '',
    intake.channels.length ? `Kanäle: ${intake.channels.join(', ')}` : '',
    intake.coverage.length ? `Abdeckung: ${intake.coverage.join(', ')}` : '',
    intake.volume ? `Volumen: ${intake.volume}` : '',
    intake.languages.length ? `Sprachen: ${intake.languages.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    kind: 'message',
    role: 'agent',
    messageId: uuid(),
    ...(typeof contextId === 'string' ? { contextId } : {}),
    parts: [
      { kind: 'text', text: summary(intake, fit, missing, german) },
      {
        kind: 'data',
        data: {
          fit,
          matchedSkills: intake.skills,
          outOfScope: intake.outOfScope,
          understood: {
            channels: intake.channels,
            coverage: intake.coverage,
            languages: intake.languages,
            volume: intake.volume,
            urgent: intake.urgent,
          },
          missing,
          humanInTheLoop: true,
          dataRetention: 'none',
          contact: {
            email: EMAIL,
            phone: PHONE,
            whatsapp: `https://wa.me/${WHATSAPP_NUMBER}`,
            whatsappPrefilled: wa(
              `Hallo famefact, Anfrage über einen Agenten zur Community Moderation. ${brief}`.slice(0, 900),
            ),
            contactPage: `${SITE}/kontakt/`,
            languages: ['de', 'en'],
            areaServed: ['DE', 'AT', 'CH'],
          },
          links: {
            site: `${SITE}/`,
            llmsTxt: `${SITE}/llms.txt`,
            llmsFullTxt: `${SITE}/llms-full.txt`,
            agentCard: `${SITE}${AGENT_CARD_PATH}`,
            markdown: `${SITE}/index.md`,
            cases: 'https://famefact.com/a2a/cases.json',
          },
        },
      },
    ],
  };
}

export function serviceIndex(): Record<string, unknown> {
  return {
    type: 'communityModerationA2AServiceIndex',
    agentCardUrl: `${SITE}${AGENT_CARD_PATH}`,
    description:
      'A2A entry point for hiring human community moderation in German-speaking markets. Send a message describing channels, volume, coverage window and languages; the reply assesses fit and hands over to the human team.',
    endpoints: [
      { method: 'GET', url: `${SITE}${A2A_PATH}`, description: 'This service index.' },
      { method: 'GET', url: `${SITE}${AGENT_CARD_PATH}`, description: 'Public A2A agent card.' },
      {
        method: 'POST',
        url: `${SITE}${A2A_PATH}/message:send`,
        description:
          'HTTP+JSON message endpoint. Body: {"message":{"role":"user","parts":[{"kind":"text","text":"..."}],"messageId":"...","kind":"message"}}. JSON-RPC 2.0 with method "message/send" is accepted at the base URL.',
      },
    ],
    humanContact: { email: EMAIL, phone: PHONE, whatsapp: `https://wa.me/${WHATSAPP_NUMBER}` },
    notes: [
      'Moderation is done by named people. This endpoint qualifies and hands over, it does not moderate.',
      'Nothing is stored: the request is analysed in memory and the response is generated from it.',
      'Portfolio evidence of the operator is available at https://famefact.com/a2a/cases.json',
    ],
  };
}

function error(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return { status, body: { error: { code: status, status: code, message, ...extra } } };
}

/**
 * Routing für alles unterhalb von /a2a/v1.
 * `op` ist das Pfadsegment hinter der Version ("" oder "message:send").
 */
export function handle(method: string, op: string, body: unknown): HandlerResult {
  const verb = method.toUpperCase();
  const operation = op.replace(/^\/+|\/+$/g, '');

  if (verb === 'OPTIONS') return { status: 204, body: null };

  if (operation === '' || operation === 'index') {
    if (verb === 'GET') return { status: 200, body: serviceIndex() };
    if (verb !== 'POST') return { ...error(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST.'), headers: { Allow: 'GET, POST, OPTIONS' } };

    // JSON-RPC 2.0 an der Basis-URL – so sprechen die meisten A2A-Clients.
    const rpc = body as { jsonrpc?: string; id?: unknown; method?: string; params?: { message?: unknown } };
    if (rpc?.jsonrpc || rpc?.method) {
      if (rpc.method !== 'message/send' && rpc.method !== 'message:send') {
        return {
          status: 200,
          body: {
            jsonrpc: '2.0',
            id: rpc.id ?? null,
            error: { code: -32601, message: `Method not found: ${rpc.method}. Supported: message/send.` },
          },
        };
      }
      const message = rpc.params?.message;
      if (!textOf(message)) {
        return {
          status: 200,
          body: {
            jsonrpc: '2.0',
            id: rpc.id ?? null,
            error: { code: -32602, message: 'params.message.parts must contain at least one text part.' },
          },
        };
      }
      return { status: 200, body: { jsonrpc: '2.0', id: rpc.id ?? null, result: buildReply(message) } };
    }

    return handle('POST', 'message:send', body);
  }

  if (operation === 'message:send' || operation === 'message-send' || operation === 'message') {
    if (verb !== 'POST') {
      return { ...error(405, 'METHOD_NOT_ALLOWED', 'Use POST with a message body.'), headers: { Allow: 'POST, OPTIONS' } };
    }
    const message = (body as { message?: unknown })?.message ?? body;
    if (!textOf(message)) {
      return error(400, 'INVALID_ARGUMENT', 'message.parts must contain at least one text part.', {
        expected: {
          message: { role: 'user', kind: 'message', messageId: 'string', parts: [{ kind: 'text', text: 'string' }] },
        },
        documentation: `${SITE}/llms.txt`,
      });
    }
    return { status: 200, body: buildReply(message) };
  }

  return error(404, 'NOT_FOUND', `Unknown operation "${operation}".`, { endpoints: serviceIndex().endpoints });
}
