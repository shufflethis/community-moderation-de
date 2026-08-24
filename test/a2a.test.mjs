import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, analyse, assessFit, missingFacts, buildReply } from '../src/a2a.ts';

/**
 * Der A2A-Endpunkt qualifiziert und übergibt an Menschen. Die Tests halten
 * beides fest: dass er passende Anfragen erkennt und dass er unpassende nicht
 * beschönigt – eine falsch zugesagte Anfrage kostet mehr als eine abgelehnte.
 */

const message = (text) => ({
  role: 'user',
  kind: 'message',
  messageId: 'm-1',
  parts: [{ kind: 'text', text }],
});

const send = (text) => handle('POST', 'message:send', { message: message(text) });
const dataOf = (body) => body.parts.find((p) => p.kind === 'data').data;
const textPart = (body) => body.parts.find((p) => p.kind === 'text').text;

test('erkennt Kanäle, Abdeckung, Volumen und Sprachen aus einer echten Anfrage', () => {
  const intake = analyse(
    'Wir brauchen Moderation für Instagram und TikTok, rund 30.000 Kommentare im Monat, abends und am Wochenende, auf Deutsch und Englisch.',
  );
  assert.deepEqual(intake.channels, ['Instagram', 'TikTok']);
  assert.ok(intake.coverage.includes('Abende') && intake.coverage.includes('Wochenende'));
  assert.equal(intake.volume, '30.000 kommentare');
  assert.deepEqual(intake.languages, ['Deutsch', 'Englisch']);
  assert.ok(intake.skills.includes('human-community-moderation-dach'));
  assert.ok(intake.skills.includes('out-of-hours-comment-coverage'));
  assert.equal(assessFit(intake), 'yes');
});

test('ordnet Spezialfälle den richtigen Skills zu', () => {
  assert.ok(analyse('Unsere Kommentarspalte eskaliert gerade, Shitstorm').skills.includes('community-crisis-response'));
  assert.ok(analyse('Wir müssen Hate Speech nach DSA dokumentieren').skills.includes('dsa-netzdg-moderation-compliance'));
  assert.ok(
    analyse('Wir brauchen eine Netiquette und einen Leitfaden für das eigene Team').skills.includes(
      'moderation-playbook-and-netiquette',
    ),
  );
});

test('sagt bei unpassenden Anfragen ab, statt sie zu beschönigen', () => {
  const { body } = send('Wir wollen unsere Kommentare vollautomatisch ohne Menschen moderieren lassen.');
  assert.equal(dataOf(body).fit, 'no');
  assert.match(textPart(body), /nicht die Richtigen/i);

  const ads = send('Wir suchen jemanden für Google Ads und Performance Marketing.');
  assert.equal(dataOf(ads.body).fit, 'no');
});

test('benennt die fehlenden Angaben statt nach einem Termin zu fragen', () => {
  const { body } = send('Wir brauchen Community Moderation.');
  const data = dataOf(body);
  assert.equal(data.fit, 'yes');
  assert.equal(data.missing.length, 5, 'ohne Angaben fehlen alle fünf Punkte');
  assert.ok(data.missing.some((m) => m.startsWith('channels')));

  const full = dataOf(
    send(
      'Instagram und LinkedIn, ca. 4000 Nachrichten pro Monat, werktags und am Wochenende, deutsch, Freigabe läuft über unser Social-Media-Team.',
    ).body,
  );
  assert.deepEqual(full.missing, [], 'vollständige Anfrage darf nichts mehr vermissen');
});

test('die Antwort ist eine gültige A2A-Message mit Kontaktweg', () => {
  const { status, body } = send('Wir brauchen abends Moderation für Instagram.');
  assert.equal(status, 200);
  assert.equal(body.kind, 'message');
  assert.equal(body.role, 'agent');
  assert.ok(body.messageId);
  assert.equal(body.parts.length, 2);

  const data = dataOf(body);
  assert.equal(data.humanInTheLoop, true);
  assert.equal(data.dataRetention, 'none');
  assert.match(data.contact.email, /@famefact\.com$/);
  assert.match(data.contact.whatsappPrefilled, /^https:\/\/wa\.me\/491715280138\?text=/);
  assert.ok(data.contact.whatsappPrefilled.length < 1400, 'WhatsApp-Deeplink darf nicht ausufern');
  assert.match(data.links.llmsTxt, /llms\.txt$/);
});

test('antwortet auf Deutsch oder Englisch, je nach Anfrage', () => {
  assert.match(textPart(send('Wir brauchen Moderation für Instagram.').body), /Menschen|Kanäle|Weiter mit/);
  assert.match(
    textPart(send('We need human moderation for our Instagram comments in German.').body),
    /Continue with a human/,
  );
});

test('spricht JSON-RPC 2.0 an der Basis-URL', () => {
  const { status, body } = handle('POST', '', {
    jsonrpc: '2.0',
    id: 7,
    method: 'message/send',
    params: { message: message('Moderation für TikTok gesucht.') },
  });
  assert.equal(status, 200);
  assert.equal(body.jsonrpc, '2.0');
  assert.equal(body.id, 7);
  assert.equal(body.result.kind, 'message');

  const unknown = handle('POST', '', { jsonrpc: '2.0', id: 8, method: 'tasks/get' });
  assert.equal(unknown.body.error.code, -32601);
});

test('GET auf /a2a/v1 liefert einen brauchbaren Service-Index', () => {
  const { status, body } = handle('GET', '', undefined);
  assert.equal(status, 200);
  assert.equal(body.agentCardUrl, 'https://community-moderation.de/.well-known/agent-card.json');
  assert.ok(body.endpoints.some((e) => e.method === 'POST' && e.url.endsWith('/message:send')));
  assert.ok(body.humanContact.email);
  assert.ok(body.notes.some((n) => /nothing is stored/i.test(n)));
});

test('falsche Methoden und leere Anfragen bekommen verwertbare Fehler', () => {
  const wrongMethod = handle('GET', 'message:send', undefined);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.Allow, 'POST, OPTIONS');

  const empty = handle('POST', 'message:send', { message: { parts: [] } });
  assert.equal(empty.status, 400);
  assert.ok(empty.body.error.expected, 'der Fehler zeigt die erwartete Struktur');

  assert.equal(handle('OPTIONS', 'message:send', undefined).status, 204, 'CORS-Preflight');
  assert.equal(handle('POST', 'tasks:get', {}).status, 404);
});

test('kaputte oder fremde Nutzlasten werfen nicht', () => {
  for (const payload of [null, undefined, 'kein json', 42, { message: null }, { parts: 'nope' }]) {
    const result = handle('POST', 'message:send', payload);
    assert.ok([200, 400].includes(result.status), `unerwarteter Status für ${JSON.stringify(payload)}`);
  }
  assert.ok(buildReply({ parts: [{ kind: 'data', data: { channels: ['Instagram'] } }] }).parts.length === 2);
});

test('missingFacts und assessFit bleiben konsistent zur Kontaktseite', () => {
  const intake = analyse('');
  assert.equal(assessFit(intake), 'unclear');
  assert.deepEqual(
    missingFacts(intake).map((m) => m.split(':')[0]),
    ['channels', 'volume', 'coverage', 'languages', 'approvals'],
  );
});
