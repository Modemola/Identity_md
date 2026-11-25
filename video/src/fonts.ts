import { continueRender, delayRender, staticFile } from "remotion";

const weights = ["300", "400", "500", "600"];
const handle = delayRender("fonts");
const families = [
  ["IBM Plex Mono", "ibm-plex-mono"],
  ["IBM Plex Sans", "ibm-plex-sans"],
];
// KEPT 2.0: Archivo (condensed headlines, a width axis) and Inter (text), both variable
const variable: [string, string, FontFaceDescriptors][] = [
  ["Archivo", "archivo-latin-wdth.woff2", { weight: "100 900", stretch: "62% 125%" }],
  ["Inter", "inter-latin-opsz.woff2", { weight: "100 900" }],
];
Promise.all([
  ...variable.map(([family, file, desc]) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, desc);
    (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    return face.load();
  }),
  ...families.flatMap(([family, file]) => weights.map((w) => [family, file, w])).map(([family, file, w]) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}-latin-${w}-normal.woff2`)}) format("woff2")`, { weight: w });
    (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    return face.load();
  }),
])
  .then(() => continueRender(handle))
  .catch((e) => {
    console.error(e);
    continueRender(handle);
  });
