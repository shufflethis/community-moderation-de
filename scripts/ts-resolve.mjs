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
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
