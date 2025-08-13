import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // Seu projeto já deve ter isso
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Adicione esta linha
  ],
})