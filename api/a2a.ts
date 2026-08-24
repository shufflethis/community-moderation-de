import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from '../src/a2a';

/**
 * Dünne Anbindung an Vercel. Alles Fachliche steht in src/a2a.ts und ist ohne
 * Laufzeitumgebung testbar. Erreichbar ist die Funktion unter /a2a/v1 und
 * /a2a/v1/message:send – siehe rewrites in vercel.json.
 */

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const raw = req.query.op;
  const op = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');

  const result = handle(req.method ?? 'GET', op, parseBody(req.body));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Jede Antwort hängt am Anfragetext – Zwischenspeichern wäre hier falsch.
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value);

  if (result.body === null) {
    res.status(result.status).end();
    return;
  }
  res.status(result.status).json(result.body);
}
