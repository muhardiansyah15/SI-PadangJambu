import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' → hasil build memakai path relatif, jadi bisa ditayangkan
// di subfolder mana pun (GitHub Pages /SI-PadangJambu/portal/, Netlify, dll.)
export default defineConfig({
  base: './',
  plugins: [react()],
})
