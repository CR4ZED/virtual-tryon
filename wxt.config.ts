import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Virtual Try-On',
    description: 'See yourself in clothes from any online store, using your own Gemini or OpenAI API key.',
    permissions: ['storage', 'sidePanel', 'unlimitedStorage'],
    host_permissions: ['https://*/*'],
    action: { default_title: 'Virtual Try-On' },
  },
});
