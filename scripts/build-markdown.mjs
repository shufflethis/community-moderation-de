/**
 * Erzeugt nach dem Astro-Build zu jeder HTML-Seite eine Markdown-Variante
 * (dist/<pfad>/index.md) und fasst alles in dist/llms-full.txt zusammen.
 *
 * Warum aus dem gebauten HTML und nicht aus einer zweiten Quelle: Eine handgepflegte
 * Markdown-Kopie driftet garantiert. So ist das HTML die einzige Wahrheit, und die
 * Markdown-Variante kann nie etwas anderes behaupten als die Seite selbst.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const SITE = 'https://community-moderation.de';

/** Baut den Turndown-Konverter mit den Regeln, die dieses Markup braucht. */
function createTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    hr: '---',
  });

  // Layout-Elemente ohne Textwert fliegen raus, sonst stehen leere Zeilen im Markdown.
  td.remove(['script', 'style', 'noscript', 'svg', 'iframe']);

  // Blöcke, die im HTML nur die Markdown-Fassung spiegeln (z. B. auf der 404-Seite),
  // gehören nicht in die Markdown-Datei – dort wären sie eine Dublette.
  td.addRule('markdownMirror', {
    filter: (node) => node.hasAttribute && node.hasAttribute('data-markdown-mirror'),
    replacement: () => '',
  });

  // <span> trägt hier Labels ("Nutzer · 21:47") und Logo-Listen. Ohne Trenner
  // klebt der Span-Text am Nachbarn: "VattenfallCASIOREWE".
  td.addRule('span', {
    filter: 'span',
    replacement: (content, node) => {
      const text = content.trim();
      if (!text) return '';
      // Trenner nur dort, wo tatsächlich ein Nachbar klebt – sonst entstehen
      // führende Leerzeichen, die Markdown als Einrückung liest.
      return `${node.previousSibling ? ' ' : ''}${text}${node.nextSibling ? ' ' : ''}`;
    },
  });

  // Das FAQ-Akkordeon ist im HTML <details>/<summary>. Als Fließtext wäre die Frage
  // von der Antwort nicht mehr unterscheidbar – als Überschrift schon.
  td.addRule('details', {
    filter: 'details',
    replacement: (_content, node) => {
      const summary = node.querySelector('summary');
      const question = summary ? summary.textContent.trim() : '';
      const rest = Array.from(node.childNodes)
        .filter((n) => n.nodeName.toLowerCase() !== 'summary')
        .map((n) => (n.textContent || '').trim())
        .filter(Boolean)
        .join('\n\n');
      return `\n\n### ${question}\n\n${rest}\n\n`;
    },
  });

  // <figcaption> als kursive Bildunterschrift statt als eigener Absatz ohne Bezug.
  td.addRule('figcaption', {
    filter: 'figcaption',
    replacement: (content) => (content.trim() ? `\n\n_${content.trim()}_\n\n` : ''),
  });

  return td;
}

/** Alle .html-Dateien unterhalb von dist/. */
async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

const pick = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : '';
};

/** URL-Pfad, unter dem eine dist-Datei ausgeliefert wird. */
function urlPathOf(file) {
  const rel = relative(DIST, file).split('\\').join('/');
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '/404';
  return '/' + rel.replace(/index\.html$/, '');
}

function toMarkdown(td, html, urlPath) {
  const title = pick(html, /<title>([\s\S]*?)<\/title>/);
  const description = pick(html, /<meta\s+name="description"\s+content="([^"]*)"/);
  const canonical = pick(html, /<link\s+rel="canonical"\s+href="([^"]*)"/) || SITE + urlPath;

  const main = pick(html, /<main[^>]*>([\s\S]*)<\/main>/);
  if (!main) throw new Error(`kein <main> in ${urlPath}`);

  const body = td
    .turndown(main)
    // Relative Links und Bilder absolut machen – die Markdown-Datei wird auch
    // außerhalb des Seitenkontexts gelesen.
    .replace(/\]\(\/(?!\/)/g, `](${SITE}/`)
    // Alles eine Ebene tiefer: Das Dokument hat oben bereits eine H1 (den Titel).
    // Zwei H1 in einer Datei machen die Gliederung für Parser unbrauchbar.
    .replace(/^(#{1,5}) /gm, '#$1 ')
    // Doppelte Leerzeichen im Satz zusammenziehen – Einrückungen am Zeilenanfang
    // bleiben stehen, sie tragen in Markdown Bedeutung (Listenfortsetzung).
    .replace(/(\S)[ \t]{2,}/g, '$1 ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const head = [
    `# ${title.replace(/\s*\|.*$/, '').trim()}`,
    '',
    description ? `> ${description}` : '',
    '',
    `- Quelle: ${canonical}`,
    `- Kontakt: info@famefact.com · +49 30 403 665 430 · WhatsApp +49 171 5280138`,
    `- Weitere Einstiege: ${SITE}/llms.txt`,
    '',
    '---',
    '',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');

  return `${head}\n${body}\n`;
}

const td = createTurndown();
const files = await htmlFiles(DIST);
const written = new Map();

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const urlPath = urlPathOf(file);
  const md = toMarkdown(td, html, urlPath);
  const target = file.replace(/\.html$/, '.md');
  await writeFile(target, md, 'utf8');
  written.set(urlPath, md);
}

// llms-full.txt in der Reihenfolge der Sitemap: Startseite zuerst, Rechtstexte zuletzt.
const sitemap = await readFile(join(DIST, 'sitemap-index.xml'), 'utf8');
const order = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, ''));

const fullParts = order
  .filter((path) => written.has(path))
  .map((path) => written.get(path).trim());

const missing = order.filter((path) => !written.has(path));
if (missing.length) throw new Error(`Sitemap-Pfade ohne Markdown-Variante: ${missing.join(', ')}`);

await writeFile(
  join(DIST, 'llms-full.txt'),
  `# community moderation — vollständiger Inhalt\n\n> Alle Seiten von ${SITE} als Markdown, in der Reihenfolge der Sitemap. Kurzfassung und Einsatzfälle: ${SITE}/llms.txt\n\n${fullParts.join('\n\n---\n\n')}\n`,
  'utf8',
);

console.log(
  `[markdown] ${written.size} Seiten konvertiert (${[...written.keys()].join(', ')}) + llms-full.txt`,
);
