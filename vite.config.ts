import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "panel",
  base: "/panel/",
  esbuild: {
    target: "chrome69"
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3210"
    }
  },
  resolve: {
    alias: {
      "@shared": "/shared"
    }
  },
  build: {
    target: "chrome69",
    outDir: "../dist/panel",
    emptyOutDir: true
  }
});
