import type { APIRoute } from 'astro';
import { SITE } from '../config';
import { ROUTES } from '../routes';

export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map((p) => `  <url><loc>${SITE}${p.path}</loc><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
