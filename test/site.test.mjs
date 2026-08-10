import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const src = (p) => new URL(`../src/${p}`, import.meta.url);
const read = (p) => readFile(src(p), 'utf8');

/**
 * Wortzahl des sichtbaren Textes einer gebauten Seite.
 * Läuft bewusst gegen dist/, weil ein Teil der Copy (FAQ) im Frontmatter liegt
 * und in der .astro-Quelle nicht als Fließtext zählbar ist.
 */
async function builtWordCount(distPath) {
  let html;
  try {
    html = await readFile(new URL(`../dist/${distPath}`, import.meta.url), 'utf8');
  } catch {
    assert.fail(`dist/${distPath} fehlt – bitte zuerst "npm run build" ausführen`);
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<head[\s\S]*?<\/head>/g, '')
    .replace(/<[^>]+>/g, ' ');
  return text.split(/\s+/).filter((w) => /[a-zäöüß]/i.test(w)).length;
}

test('Startseite trägt das Keyword, Schema und die WhatsApp-Conversion', async () => {
  const source = await read('pages/index.astro');
  assert.match(source, /Community Moderation/);
  assert.match(source, /ProfessionalService/);
  assert.match(source, /FAQPage/);
  assert.match(source, /wa\(/, 'WhatsApp-Deeplink-Helper wird verwendet');
  assert.match(source, /id="check"/, 'Selbst-Check ist vorhanden');
});

test('Startseite hat inhaltliche Tiefe für das Money-Keyword', async () => {
  const words = await builtWordCount('index.html');
  assert.ok(words >= 3900, `zu wenig sichtbarer Text auf der Startseite: ${words} Wörter`);
});

test('Selbst-Check speichert nichts und schickt das Ergebnis per wa.me', async () => {
  const source = await read('pages/index.astro');
  assert.match(source, /https:\/\/wa\.me\/' \+ waNum/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest/);
});

test('keine Requests an Drittanbieter-CDNs (Fonts werden selbst gehostet)', async () => {
  const layouts = await readdir(src('layouts'));
  const pages = await readdir(src('pages'), { recursive: true });
  const files = [
    ...layouts.map((f) => `layouts/${f}`),
    ...pages.filter((f) => f.endsWith('.astro')).map((f) => `pages/${f}`),
  ];
  for (const f of files) {
    const source = await read(f);
    assert.doesNotMatch(source, /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr|unpkg\.com/, `Drittanbieter-CDN in ${f}`);
  }
});

test('Impressum enthält die vollständige Anbieterkennzeichnung', async () => {
  const source = await read('pages/impressum/index.astro');
  assert.match(source, /COMPANY\.hrb/);
  assert.match(source, /COMPANY\.vat/);
  assert.match(source, /MStV/);
});

test('Datenschutz erklärt WhatsApp, den Selbst-Check und die Reichweitenmessung', async () => {
  const source = await read('pages/datenschutz/index.astro');
  assert.match(source, /WhatsApp Ireland/);
  assert.match(source, /Selbst-Check/);
  assert.match(source, /Vercel/);
  assert.match(source, /Plausible/);
});

test('jedes eingebundene Analytics-Skript ist auch in der Datenschutzerklärung erklärt', async () => {
  const layout = await read('layouts/BaseLayout.astro');
  const hosts = [...layout.matchAll(/<script[^>]+src="https:\/\/([^/"]+)/g)].map((m) => m[1]);
  const privacy = await read('pages/datenschutz/index.astro');
  for (const host of hosts) {
    assert.match(privacy, new RegExp(host.replace(/\./g, '\\.')), `${host} wird geladen, steht aber nicht in der Datenschutzerklärung`);
  }
});

test('WhatsApp-Nummer ist zentral gepflegt und nur für WhatsApp gesetzt', async () => {
  const source = await read('config.ts');
  assert.match(source, /WHATSAPP_NUMBER = '491715280138'/);
  assert.match(source, /PHONE = '\+4930403665430'/);
});

test('alle Unterseiten nutzen das neue Layout und verlinken zurück auf den Onepager', async () => {
  assert.match(await read('layouts/SubLayout.astro'), /href="\/"/);
  for (const slug of ['social-media-moderation', 'community-management-agentur', 'krisenkommunikation-social-media']) {
    assert.match(await read(`pages/${slug}/index.astro`), /SubLayout/, `${slug} nutzt das neue Layout nicht`);
    const built = await readFile(new URL(`../dist/${slug}/index.html`, import.meta.url), 'utf8');
    assert.match(built, /href="\/"/, `${slug} verlinkt im Build nicht auf die Startseite`);
    assert.ok(!/famefact-logo\.webp/.test(built), `${slug} nutzt noch das alte famefact-Logo`);
  }
});
