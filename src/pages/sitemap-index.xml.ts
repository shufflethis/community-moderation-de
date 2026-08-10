import type { APIRoute } from 'astro';

const BASE = 'https://community-moderation.de';

const pages: Array<{ path: string; priority: string }> = [
  { path: '/', priority: '1.0' },
  { path: '/social-media-moderation/', priority: '0.8' },
  { path: '/community-management-agentur/', priority: '0.8' },
  { path: '/krisenkommunikation-social-media/', priority: '0.8' },
  { path: '/impressum/', priority: '0.2' },
  { path: '/datenschutz/', priority: '0.2' },
];

export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map((p) => `  <url><loc>${BASE}${p.path}</loc><priority>${p.priority}</priority></url>`)
  .join('\n')}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
