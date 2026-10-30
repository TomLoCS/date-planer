import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' damit der Build auch in einem Unterordner läuft (z. B. GitHub Pages).
export default defineConfig({
  plugins: [react()],
  base: './',
});
