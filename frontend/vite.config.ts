import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiPort = env.API_BACKEND_PORT || '5000';
    return {
      define: {
        // This is just generic value for the GEMINI API key.
        // This is not used at all, and can be ignored!
        'process.env.API_KEY' : JSON.stringify('api-key-this-is-not-used-can-be-ignored!'),
      },
      server: {
      host: true,
      port: 5173,
      proxy: {
          //Target your Node.js backend
          '/api-proxy': `http://localhost:${apiPort}`,
          '/api': `http://localhost:${apiPort}`,
          '/ws-proxy': {target: `ws://localhost:${apiPort}`, ws: true},
        },
      },
      plugins: react(),
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
