import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-ui": ["recharts", "html5-qrcode", "qrcode.react"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
});
