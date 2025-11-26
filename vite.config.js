import { defineConfig } from "vite";

export default defineConfig({
  base: "/CS559-project-fps/",
  server: {
    port: 5173,
    open: true
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  }
});
