import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  build: {
    // Build straight into the FastAPI backend's public/ dir so the server can
    // serve the SPA as its home page (see ../main.py). emptyOutDir is false
    // because public/ also holds public/upload/ — wiping it would delete every
    // uploaded model.
    outDir: "../public",
    emptyOutDir: false,
  },
});
