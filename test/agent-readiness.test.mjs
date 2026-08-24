import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * Prüft die maschinenlesbare Seite des Angebots: llms.txt, Markdown-Varianten,
 * Agent Card, 404-Wiedereinstieg, Aushandlungsregeln und Identitäts-Schema.
 * Läuft gegen dist/ – also gegen das, was tatsächlich ausgeliefert wird.
 */

const SITE = 'https://community-moderation.de';
const dist = (p) => new URL(`../dist/${p}`, import.meta.url);

async function readDist(path) {
  try {
    return await readFile(dist(path), 'utf8');
  } catch {
    assert.fail(`dist/${path} fehlt – bitte zuerst "npm run build" ausführen`);
  }
}

/** Alle Seitenpfade aus der gebauten Sitemap. */
async function sitemapPaths() {
  const xml = await readDist('sitemap-index.xml');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, ''));
}

/** Datei, unter der die Markdown-Variante eines Pfads liegt. */
const mdFileFor = (path) => (path === '/' ? 'index.md' : `${path.slice(1)}index.md`);

/** Sichtbarer Text einer gebauten Seite ohne Navigation, Footer, Skript und Stil. */
function visibleText(html) {
  const main = html.match(/<main[^>]*>([\s\S]*)<\/main>/);
  return (main ? main[1] : html)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alle JSON-LD-Blöcke einer Seite, geparst. */
function jsonLd(html) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]),
  );
}

test('llms.txt nennt Einsatzfälle, Identität, alle Seiten und die Kontaktwege', async () => {
  const llms = await readDist('llms.txt');

  assert.match(llms, /^# community moderation/, 'llms.txt beginnt mit dem H1 der Marke');
  assert.match(llms, /\n> /, 'Zusammenfassung als Blockquote fehlt');
  assert.match(llms, /## When To Use/i, 'Ohne "When to use" ist die Datei für Agenten wertlos');
  assert.match(llms, /Not a fit for:/, 'Abgrenzung fehlt – sie ist der nützlichste Teil');
  assert.match(llms, /## Entity/);
  assert.match(llms, /info@famefact\.com/);
  assert.match(llms, /\+4930403665430/);
  assert.match(llms, /491715280138/, 'WhatsApp-Nummer fehlt');
  assert.match(llms, /Schliemannstr\. 23, 10437 Berlin/);
  assert.match(llms, /Accept: text\/markdown/, 'Hinweis auf die Markdown-Variante fehlt');
  assert.match(llms, /agent-card\.json/);

  for (const path of await sitemapPaths()) {
    assert.ok(llms.includes(`${SITE}${path})`), `llms.txt verlinkt ${path} nicht`);
  }
});

test('jede Seite der Sitemap hat eine Markdown-Variante ohne HTML-Reste', async () => {
  for (const path of await sitemapPaths()) {
    const md = await readDist(mdFileFor(path));
    assert.ok(md.length > 400, `${path} liefert nur ${md.length} Zeichen Markdown`);
    assert.match(md, /^# /, `${path}: Markdown beginnt nicht mit einer H1`);
    assert.equal(
      (md.match(/^# /gm) || []).length,
      1,
      `${path}: genau eine H1 erwartet, sonst ist die Gliederung für Parser wertlos`,
    );
    assert.doesNotMatch(md, /<(div|span|section|script|style|svg|p|a|figure)\b/i, `${path}: HTML im Markdown`);
    assert.doesNotMatch(md, /\]\(\/(?!\/)/, `${path}: relativer Link im Markdown`);
    assert.match(md, new RegExp(`Quelle: ${SITE}`), `${path}: Quellangabe fehlt`);
  }
});

test('llms-full.txt enthält den Text aller Seiten', async () => {
  const full = await readDist('llms-full.txt');
  for (const path of await sitemapPaths()) {
    const md = await readDist(mdFileFor(path));
    const marker = md.split('\n')[0].replace(/^# /, '');
    assert.ok(full.includes(marker), `llms-full.txt fehlt der Abschnitt "${marker}"`);
  }
});

test('die 404-Seite führt Menschen wie Agenten zurück', async () => {
  const html = await readDist('404.html');
  const md = await readDist('404.md');

  for (const target of ['/llms.txt', '/sitemap-index.xml', '/.well-known/agent-card.json']) {
    assert.ok(html.includes(target), `404-Seite verweist nicht auf ${target}`);
  }
  assert.match(html, /404/);
  assert.ok(html.includes('# 404'), 'Der Markdown-Block im 404-Body fehlt');
  assert.match(md, /Einstiege/);
  for (const path of ['/', '/social-media-moderation/', '/kontakt/']) {
    assert.ok(md.includes(SITE + path), `404.md nennt ${path} nicht`);
  }
});

test('vercel.json handelt Markdown für jede Seite aus und setzt Vary: Accept', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const routes = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8');

  const slugs = [...routes.matchAll(/path: '\/([^']*)\/'/g)].map((m) => m[1]);
  const mdRewrites = config.rewrites.filter((r) =>
    (r.has ?? []).some((h) => h.key === 'accept' && /markdown/.test(h.value)),
  );
  assert.ok(mdRewrites.length > 0, 'keine Accept-Aushandlung konfiguriert');

  const negotiated = JSON.stringify(mdRewrites);
  assert.ok(/"source": ?"\/"/.test(negotiated), 'Startseite wird nicht ausgehandelt');
  for (const slug of slugs) {
    assert.ok(negotiated.includes(slug), `keine Markdown-Aushandlung für /${slug}/`);
  }

  const aliases = [...routes.matchAll(/aliases: \[([^\]]+)\]/g)]
    .flatMap((m) => m[1].split(','))
    .map((a) => a.trim().replace(/'/g, '').replace(/^\//, ''))
    .filter(Boolean);
  const allRewrites = JSON.stringify(config.rewrites);
  for (const alias of aliases) {
    assert.ok(allRewrites.includes(alias), `Alias /${alias} hat keine Rewrite-Regel`);
  }

  const vary = JSON.stringify(config.headers);
  assert.ok(/"key": ?"Vary"/.test(vary), 'Vary-Header fehlt');
  assert.ok(/Accept, Accept-Encoding/.test(vary), 'Vary nennt Accept nicht');
  assert.ok(/text\/markdown; charset=utf-8/.test(vary), 'Content-Type für .md fehlt');
});

test('die Startseite trägt eine vollständige Organization-Identität', async () => {
  const html = await readDist('index.html');
  const blocks = jsonLd(html);

  const org = blocks.find((b) => b['@type'] === 'Organization');
  assert.ok(org, 'kein JSON-LD vom Typ Organization – Prüfsysteme erkennen Unterklassen nicht');
  assert.equal(org.url, SITE + '/');
  assert.ok(org.name && org.description, 'name oder description fehlen');
  assert.ok(org.logo?.url?.startsWith(SITE), 'logo fehlt');
  assert.ok(Array.isArray(org.sameAs) && org.sameAs.length >= 3, 'sameAs zu dünn');
  assert.equal(org.address['@type'], 'PostalAddress');
  assert.equal(org.address.postalCode, '10437');
  assert.ok(Array.isArray(org.contactPoint) && org.contactPoint.length >= 1, 'contactPoint fehlt');
  for (const cp of org.contactPoint) {
    assert.ok(cp.contactType, 'contactPoint ohne contactType');
    assert.ok(cp.telephone || cp.email, 'contactPoint ohne Telefon oder E-Mail');
    assert.ok(cp.availableLanguage?.length, 'contactPoint ohne availableLanguage');
  }

  assert.ok(
    blocks.some((b) => b['@type'] === 'ProfessionalService'),
    'der Dienst selbst ist nicht mehr ausgezeichnet',
  );
  assert.ok(blocks.some((b) => b['@type'] === 'FAQPage'), 'FAQ-Schema fehlt');
});

test('jede Seite trägt die Organisation und verweist auf ihre Markdown-Variante', async () => {
  for (const path of await sitemapPaths()) {
    const file = path === '/' ? 'index.html' : `${path.slice(1)}index.html`;
    const html = await readDist(file);
    assert.ok(
      jsonLd(html).some((b) => b['@type'] === 'Organization'),
      `${path} trägt kein Organization-Schema`,
    );
    assert.match(
      html,
      /<link rel="alternate" type="text\/markdown"/,
      `${path} verlinkt seine Markdown-Variante nicht`,
    );
  }
});

test('die Agent Card ist gültig und zeigt auf einen erreichbaren Endpoint', async () => {
  const card = JSON.parse(await readDist('.well-known/agent-card.json'));

  assert.ok(card.name && card.description, 'name oder description fehlen');
  assert.equal(card.provider.url, SITE + '/');
  assert.match(card.documentationUrl, /llms\.txt$/);
  assert.ok(Array.isArray(card.supportedInterfaces) && card.supportedInterfaces.length >= 1);
  for (const iface of card.supportedInterfaces) {
    assert.match(iface.url, /^https:\/\//, 'Interface ohne HTTPS-URL');
    assert.ok(iface.protocolBinding, 'Interface ohne protocolBinding');
  }
  assert.ok(card.skills.length >= 3, 'zu wenige Skills, um Anfragen zu unterscheiden');
  for (const skill of card.skills) {
    assert.ok(skill.id && skill.name && skill.description, 'Skill unvollständig');
    assert.ok(skill.tags?.length && skill.examples?.length, `Skill ${skill.id} ohne Tags oder Beispiele`);
  }
});

test('die Vertrauensseiten haben echten Inhalt', async () => {
  for (const [path, needle] of [
    ['/ueber-uns/', 'track by track GmbH'],
    ['/kontakt/', 'Schliemannstr'],
    ['/datenschutz/', 'DSGVO'],
    ['/impressum/', 'HRB'],
  ]) {
    const html = await readDist(`${path.slice(1)}index.html`);
    const text = visibleText(html);
    assert.ok(text.length >= 500, `${path} hat nur ${text.length} Zeichen sichtbaren Text`);
    assert.ok(text.includes(needle), `${path} nennt "${needle}" nicht`);
  }
});

test('robots.txt bleibt offen und verweist auf die maschinenlesbaren Dateien', async () => {
  const robots = await readDist('robots.txt');
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert.doesNotMatch(robots, /^Disallow: \/$/m, 'die Seite darf nicht komplett gesperrt sein');
  assert.match(robots, /Sitemap: https:\/\/community-moderation\.de\/sitemap-index\.xml/);
  assert.match(robots, /llms\.txt/);
});
