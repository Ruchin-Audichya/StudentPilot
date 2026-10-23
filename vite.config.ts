import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
  host: "127.0.0.1",
  port: 5173,
  proxy: { '/api/jobs': 'http://127.0.0.1:8787' },
  },
  plugins: [
  react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
