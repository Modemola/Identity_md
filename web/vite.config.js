import { defineConfig } from "vite";

// Relative asset paths so the static export works from any IPFS gateway path or ENS name.
export default defineConfig({
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
