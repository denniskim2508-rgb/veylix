import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {
    // Keep UI sounds as real files under dist/assets instead of inlining them
    // as base64 so they load/cache cleanly and stay replaceable.
    assetsInlineLimit: (filePath) => !filePath.toLowerCase().endsWith(".wav"),
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
