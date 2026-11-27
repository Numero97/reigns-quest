import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readdirSync, existsSync } from 'node:fs';

// Gives the game a list of the art/audio files that really exist, so missing ones just become placeholders.
function assetList() {
  const id = 'virtual:asset-list';
  return {
    name: 'asset-list',
    resolveId: (x: string) => (x === id ? '\0' + id : null),
    // while playing locally: when art or audio files are added or changed, refresh the list and reload the page
    configureServer(server: any) {
      // (the game's server already watches the public folder. Do not add it again here: that made brand-new files
      //  come through as a blank web page until the server was restarted.)
      const refresh = (file: string) => {
        if (!file.split('\\').join('/').includes('public/assets/')) return;
        const m = server.moduleGraph.getModuleById('\0' + id);
        if (m) server.moduleGraph.invalidateModule(m);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
    load: (x: string) => {
      if (x !== '\0' + id) return null;
      const out: Record<string, string[]> = {};
      for (const d of ['backgrounds', 'sprites', 'audio', 'lineart']) {
        const dir = 'public/assets/' + d;
        out[d] = existsSync(dir) ? readdirSync(dir).map(f => f.replace(/\.[^.]+$/, '')) : [];
      }
      return 'export default ' + JSON.stringify(out);
    }
  };
}

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [
    assetList(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,m4a,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        navigateFallback: 'index.html'
      },
      manifest: {
        name: "Reign's Quest",
        short_name: 'Reign',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#bcd7f5',
        theme_color: '#bcd7f5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
