import type { APIRoute } from 'astro';

export const GET: APIRoute = () => new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://community-moderation.de/</loc></url>
  <url><loc>https://community-moderation.de/community-management-agentur/</loc></url>
  <url><loc>https://community-moderation.de/social-media-moderation/</loc></url>
  <url><loc>https://community-moderation.de/krisenkommunikation-social-media/</loc></url>
</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
