import test from 'node:test';
import assert from 'node:assert/strict';
import middleware from '../middleware.ts';
import { ROUTES, ALIASES, markdownPath } from '../src/routes.ts';

/**
 * Verhalten der Inhaltsaushandlung. Läuft gegen die echte Middleware-Funktion,
 * nicht gegen eine Nachbildung – der teuerste Fehler wäre hier, dass ein Browser
 * oder Crawler versehentlich Markdown bekommt.
 */

const call = (path, accept) =>
  middleware(
    new Request(`https://community-moderation.de${path}`, accept ? { headers: { accept } } : undefined),
  );

const rewriteTarget = (response) => response.headers.get('x-middleware-rewrite');

test('Browser und Crawler bekommen weiter HTML', async (t) => {
  const browser = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8';
  for (const [name, accept] of [
    ['Browser', browser],
    ['curl-Standard', '*/*'],
    ['Bot ohne Präferenz', 'text/html'],
    ['Gruppen-Wildcard text/*', 'text/*'],
    ['kein Accept-Header', undefined],
  ]) {
    await t.test(name, () => {
      const res = call('/', accept);
      assert.equal(rewriteTarget(res), null, `${name} wurde auf Markdown umgeschrieben`);
      assert.notEqual(res.status, 406);
    });
  }
});

test('Accept: text/markdown liefert die Markdown-Variante derselben URL', () => {
  // Jede Seite und jeder Alias, direkt aus der Routen-Tabelle – damit eine neue
  // Seite nicht stillschweigend ohne Markdown-Variante live geht.
  const cases = [
    ...ROUTES.map((r) => [r.path, markdownPath(r.path)]),
    ...ROUTES.filter((r) => r.path !== '/').map((r) => [r.path.slice(0, -1), markdownPath(r.path)]),
    ...ALIASES.map((a) => [a.from, markdownPath(a.to)]),
  ];
  for (const [path, target] of cases) {
    const res = call(path, 'text/markdown');
    assert.equal(new URL(rewriteTarget(res)).pathname, target, `${path} zeigt nicht auf ${target}`);
    assert.match(res.headers.get('vary') ?? '', /Accept/, `${path}: Vary fehlt`);
  }
});

test('q-Werte entscheiden, welche Variante gewinnt', () => {
  assert.equal(
    rewriteTarget(call('/', 'text/markdown;q=0.9, text/html;q=1.0')),
    null,
    'HTML mit höherem q muss HTML bleiben',
  );
  assert.ok(
    rewriteTarget(call('/', 'text/markdown;q=1.0, text/html;q=0.5')),
    'Markdown mit höherem q muss Markdown liefern',
  );
  assert.equal(
    rewriteTarget(call('/', 'text/markdown;q=0, text/html')),
    null,
    'q=0 heißt: ausdrücklich nicht akzeptiert',
  );
  assert.ok(
    rewriteTarget(call('/', 'text/markdown, text/html;q=0.9')),
    'gleiches Feld ohne q: Markdown steht vorn und gewinnt bei Gleichstand',
  );
});

test('unbekannte Pfade beantworten Markdown-Anfragen mit 404 in Markdown', async () => {
  const res = call('/gibt-es-nicht', 'text/markdown');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  const body = await res.text();
  assert.match(body, /^# 404/);
  assert.match(body, /llms\.txt/);
  assert.match(body, /sitemap-index\.xml/);
  assert.match(body, /https:\/\/community-moderation\.de\//);
});

test('nicht unterstützte Typen bekommen 406 statt der falschen Repräsentation', async () => {
  const res = call('/', 'application/pdf');
  assert.equal(res.status, 406);
  const body = await res.text();
  assert.match(body, /text\/markdown/);
  assert.match(body, /text\/html/);

  assert.notEqual(call('/', 'application/pdf, */*;q=0.1').status, 406, '*/* heißt: HTML ist okay');
});

test('406 gilt nur für Seiten, nicht für maschinenlesbare Dateien und Endpunkte', () => {
  // Ein Agent, der die Agent Card mit "Accept: application/json" holt, darf
  // niemals ein 406 bekommen – das ist der Normalfall, nicht der Sonderfall.
  for (const path of [
    '/.well-known/agent-card.json',
    '/llms.txt',
    '/llms-full.txt',
    '/sitemap-index.xml',
    '/logo.svg',
    '/a2a/v1',
    '/api/a2a',
  ]) {
    for (const accept of ['application/json', 'text/plain', 'application/pdf']) {
      const res = call(path, accept);
      assert.notEqual(res.status, 406, `${path} mit "${accept}" wurde abgelehnt`);
      assert.notEqual(res.status, 404, `${path} mit "${accept}" wurde als 404 beantwortet`);
    }
  }
});

test('Dateien werden nicht umgeschrieben', () => {
  for (const path of ['/index.md', '/llms.txt', '/sitemap-index.xml', '/logo.svg']) {
    const res = call(path, 'text/markdown');
    assert.equal(rewriteTarget(res), null, `${path} wurde umgeschrieben`);
    assert.notEqual(res.status, 404, `${path} wurde als 404 beantwortet`);
  }
});
