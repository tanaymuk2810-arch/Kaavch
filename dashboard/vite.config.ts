import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// KAAVACH_HTTPS=1 enables self-signed HTTPS (needed for phone cameras over
// LAN — browsers block getUserMedia on plain http:// except localhost).
const useHttps = process.env.KAAVACH_HTTPS === "1";

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: { port: 5173 },
});