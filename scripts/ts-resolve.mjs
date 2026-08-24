import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * middleware.ts importiert `./src/routes` ohne Endung – so verlangt es der
 * Vercel-Bundler. Node löst endungslose Spezifizierer in ESM nicht auf. Dieser
 * Hook schließt genau diese Lücke, damit die Tests dieselbe Datei laden, die
 * später deployt wird, statt eine Kopie zu prüfen.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.')) {
      // Endungslos (middleware.ts, Vorgabe des Middleware-Bundlers) und
      // ".js" auf eine .ts-Datei (api/, Vorgabe von @vercel/node).
      const candidates = /\.[a-z]+$/i.test(specifier)
        ? [specifier.replace(/\.js$/i, '.ts')]
        : [`${specifier}.ts`];
      for (const candidate of candidates) {
        const url = new URL(candidate, context.parentURL);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
