import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, cpSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(fileURLToPath(import.meta.url));
const assetsRoot = resolve(frontendRoot, 'assets');
const contentTypes = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
};

function staticAssets() {
  return {
    name: 'static-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (request, response, next) => {
        let pathname;
        try {
          const requestUrl = new URL(request.url, 'http://localhost');
          // Vite turns image imports into JavaScript modules. Let Vite handle
          // those requests instead of returning the raw image bytes.
          if (requestUrl.searchParams.has('import') || requestUrl.searchParams.has('url')) {
            next(); return;
          }
          pathname = decodeURIComponent(requestUrl.pathname);
        }
        catch { next(); return; }
        const filePath = resolve(assetsRoot, `.${pathname}`);
        if (!filePath.startsWith(`${assetsRoot}${sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          next(); return;
        }
        response.setHeader('Content-Type', contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream');
        createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      cpSync(assetsRoot, resolve(frontendRoot, 'dist/assets'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), staticAssets()],
  // Listen on the LAN too, so phones and emulators can open the dev server by the machine's IP.
  server: { host: true }
});
