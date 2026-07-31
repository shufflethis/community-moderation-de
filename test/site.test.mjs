import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = new URL('../src/pages/index.astro', import.meta.url);

test('homepage contains the German community moderation intent and LocalBusiness schema', async () => {
  const source = await readFile(page, 'utf8');
  assert.match(source, /Community Moderation/i);
  assert.match(source, /application\/ld\+json/);
  assert.match(source, /ProfessionalService/);
  assert.match(source, /famefact/i);
});

test('homepage exposes an accessible consultation CTA', async () => {
  const source = await readFile(page, 'utf8');
  assert.match(source, /Kostenlose Erstberatung/i);
  assert.match(source, /href="tel:\+4930403665430"/);
});
