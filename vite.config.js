import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In sviluppo il front gira su 5173 e il server di sincronizzazione
    // su 8787: giriamo /api là dietro così il client non cambia mai URL.
    proxy: { "/api": "http://localhost:8787" },
  },
  build: { outDir: "dist" },
});
