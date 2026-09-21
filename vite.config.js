import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  server: {
    host: true, // Listen on all local IPs so VR headsets (Meta Quest) can connect
    port: 3000,
    https: true
  }
});
