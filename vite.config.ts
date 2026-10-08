import { defineConfig } from "vite";

/**
 * Dev server proxy target: the local decoder's `--write-json` HTTP server.
 * dump1090-fa and readsb both serve `/data/*.json` on port 8080 by default,
 * so `npm run dev` works out of the box with an unmodified decoder.
 * Override with `DUMP1090_URL=http://other-host:8080 npm run dev`.
 */
const decoderUrl = process.env.DUMP1090_URL ?? "http://localhost:8080";

export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/data": {
        target: decoderUrl,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
