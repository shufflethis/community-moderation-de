import { rewrite, next } from '@vercel/functions';
// Ohne Dateiendung: So und nur so löst der Vercel-Bundler den Import auf.
// Für node --test schließt scripts/ts-resolve.mjs dieselbe Lücke.
import { ROUTES, ALIASES, markdownPath } from './src/routes';

/**
 * Inhaltsaushandlung nach acceptmarkdown.com.
 *
 * Warum Middleware und nicht `rewrites` in vercel.json: Rewrites greifen erst,
 * wenn das Dateisystem nichts gefunden hat. Für "/" gibt es aber eine index.html,
 * also käme eine Rewrite-Regel dort nie zum Zug. Routing Middleware läuft vor
 * Cache und Dateisystem und ist damit die einzige Stelle, an der dieselbe URL
 * je nach Accept-Header zwei Repräsentationen ausliefern kann.
 */

/** Seitenpfad (immer mit Slash am Ende) -> Markdown-Datei. */
const MARKDOWN_BY_PATH = new Map<string, string>([
  ...ROUTES.map((r) => [r.path, markdownPath(r.path)] as [string, string]),
  ...ALIASES.map((a) => [`${a.from}/`, markdownPath(a.to)] as [string, string]),
]);

const VARY = 'Accept, Accept-Encoding';

interface AcceptEntry {
  type: string;
  q: number;
}

function parseAccept(header: string): AcceptEntry[] {
  return header
    .split(',')
    .map((part) => {
      const [type, ...params] = part.trim().split(';');
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { type: type.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : Math.min(Math.max(q, 0), 1) };
    })
    .filter((entry) => entry.type.includes('/'));
}

/**
 * q-Wert für einen Medientyp. Die genauere Angabe gewinnt (RFC 9110):
 * "text/html" schlägt "text/*", das wiederum "*​/*" schlägt.
 *
 * Mit `exactOnly` zählen Wildcards gar nicht. Genau so wird Markdown gemessen:
 * "Accept: *​/*" schickt jeder curl-Aufruf und jeder zweite Bot, "Accept: text/*"
 * meint HTML genauso gut wie Markdown. Markdown gibt es nur, wenn es dasteht.
 */
function qualityOf(entries: AcceptEntry[], mediaType: string, exactOnly = false): number {
  const exact = entries.find((e) => e.type === mediaType);
  if (exact) return exact.q;
  if (exactOnly) return 0;
  const group = `${mediaType.split('/')[0]}/*`;
  const groupMatch = entries.filter((e) => e.type === group);
  if (groupMatch.length) return Math.max(...groupMatch.map((e) => e.q));
  const wildcard = entries.filter((e) => e.type === '*/*');
  return wildcard.length ? Math.max(...wildcard.map((e) => e.q)) : 0;
}

const SITE = 'https://community-moderation.de';

/** Kurzer Markdown-Körper für Agenten, die auf einer toten URL landen. */
function markdown404(): string {
  const pages = ROUTES.filter((r) => r.priority !== '0.2')
    .map((r) => `- [${r.label}](${SITE}${r.path}): ${r.summary}`)
    .join('\n');
  return `# 404 – Seite nicht gefunden

> Diese URL existiert auf community-moderation.de nicht.

## Einstiege

${pages}

## Maschinenlesbar

- [llms.txt](${SITE}/llms.txt): Übersicht, Einsatzfälle und Kontaktwege
- [llms-full.txt](${SITE}/llms-full.txt): vollständiger Seiteninhalt als Markdown
- [sitemap-index.xml](${SITE}/sitemap-index.xml): alle URLs
- [agent-card.json](${SITE}/.well-known/agent-card.json): A2A-Einstieg
- Kontakt: info@famefact.com
`;
}

function notAcceptable(): string {
  return `# 406 – Not Acceptable

Diese Seite wird als \`text/html\` und als \`text/markdown\` ausgeliefert.
Angefragt wurde keiner der beiden Typen.

- HTML: Accept: text/html
- Markdown: Accept: text/markdown
- Übersicht: ${SITE}/llms.txt
`;
}

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  const accept = request.headers.get('accept') ?? '';
  if (!accept) return next();

  const entries = parseAccept(accept);
  if (!entries.length) return next();

  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  const target = MARKDOWN_BY_PATH.get(path);

  const qMarkdown = qualityOf(entries, 'text/markdown', true);
  const qHtml = qualityOf(entries, 'text/html');
  const wantsMarkdown = qMarkdown > 0 && qMarkdown >= qHtml;

  if (wantsMarkdown && target) {
    return rewrite(new URL(target, url), {
      headers: { Vary: VARY, 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  // Alles, was keine Seite ist – llms.txt, agent-card.json, Bilder, /a2a –, geht
  // uns nichts an. Ein 406 für "Accept: application/json" auf der Agent Card wäre
  // genau der Fehler, den diese Middleware verhindern soll.
  if (!target) {
    const looksLikeFile = url.pathname.split('/').pop()?.includes('.');
    // Unbekannter Pfad ohne Dateiendung: Der Agent bekommt seine 404 als Markdown,
    // statt eine HTML-Seite parsen zu müssen.
    if (wantsMarkdown && !looksLikeFile) {
      return new Response(markdown404(), {
        status: 404,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: VARY },
      });
    }
    return next();
  }

  // Diese Seite gibt es nur als HTML und als Markdown – beides ausgeschlossen.
  if (qHtml === 0 && qMarkdown === 0) {
    return new Response(notAcceptable(), {
      status: 406,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: VARY },
    });
  }

  return next();
}

export const config = {
  runtime: 'edge',
  matcher: ['/((?!_astro|images|fonts|api|a2a).*)'],
};
