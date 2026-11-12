import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { getArrivals } from './server/arrivals.js';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [react(), {
      name: 'local-subway-api',
      configureServer(server) {
        server.middlewares.use('/api/arrivals', async (req, res) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          try { res.end(JSON.stringify(await getArrivals(env.SEOUL_SUBWAY_API_KEY))); }
          catch (error) { res.statusCode = 502; res.end(JSON.stringify({ error: error.message })); }
        });
      },
    }],
  };
});
