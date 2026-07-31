import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://community-moderation.de',
  output: 'static',
  build: { format: 'directory' }
});
