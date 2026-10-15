import { defineConfig } from "vite";

/**
 * Preloads the two font weights the first screen uses, so text paints in IBM Plex Mono at once
 * instead of swapping after the stylesheet discovers the files. Hashed names are only known after
 * bundling, so the links are added to the built index.html.
 */
function preloadFonts(weights = ["400", "500"]) {
  return {
    name: "kept-preload-fonts",
    apply: "build",
    transformIndexHtml(html, ctx) {
      const files = Object.keys(ctx.bundle || {}).filter((f) => weights.some((w) => f.includes(`latin-${w}-normal`) && f.endsWith(".woff2")));
      const tags = files.map((f) => ({ tag: "link", attrs: { rel: "preload", href: `./${f}`, as: "font", type: "font/woff2", crossorigin: "" }, injectTo: "head" }));
      return { html, tags };
    },
  };
}

/** ABIs ship without `internalType` (Solidity type names nothing at runtime reads): ~30% smaller. */
function slimAbi() {
  const strip = (x) => (Array.isArray(x) ? x.map(strip) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== "internalType").map(([k, v]) => [k, strip(v)])) : x);
  return {
    name: "kept-slim-abi",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]abi[\\/][^\\/]+\.json$/.test(id)) return null;
      return { code: JSON.stringify(strip(JSON.parse(code))), map: null };
    },
  };
}

// Relative asset paths so the static export works from any IPFS gateway path or ENS name.
export default defineConfig({
  base: "./",
  plugins: [slimAbi(), preloadFonts()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
