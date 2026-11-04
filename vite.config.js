import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project beneath /<repository-name>/.
  // Local development and non-Pages builds stay at the domain root.
  base: process.env.GITHUB_PAGES === 'true' ? '/bulsu-pos-inventory/' : '/',
  plugins: [react()],
})
