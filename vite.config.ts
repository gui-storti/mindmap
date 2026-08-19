import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000,
    chunkSizeWarningLimit: 1200,
  },
});
