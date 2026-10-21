import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base = nome do repositório no GitHub Pages (https://usuario.github.io/ludo-y2k/)
export default defineConfig({ plugins: [react()], base: '/ludo-y2k/' });
