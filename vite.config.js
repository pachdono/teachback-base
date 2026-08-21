import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // host: true exposes the dev server on your local network,
  // so you can open it on a phone using the laptop's IP.
  server: { host: true, port: 5174 },
});
