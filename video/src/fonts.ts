import { continueRender, delayRender, staticFile } from "remotion";

const weights = ["300", "400", "500", "600"];
const handle = delayRender("fonts");
const families = [
  ["IBM Plex Mono", "ibm-plex-mono"],
  ["IBM Plex Sans", "ibm-plex-sans"],
];
Promise.all(
  families.flatMap(([family, file]) => weights.map((w) => [family, file, w])).map(([family, file, w]) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}-latin-${w}-normal.woff2`)}) format("woff2")`, { weight: w });
    (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    return face.load();
  }),
)
  .then(() => continueRender(handle))
  .catch((e) => {
    console.error(e);
    continueRender(handle);
  });
