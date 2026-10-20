import { continueRender, delayRender, staticFile } from "remotion";

const weights = ["300", "400", "500", "600"];
const handle = delayRender("fonts");
Promise.all(
  weights.map((w) => {
    const face = new FontFace("IBM Plex Mono", `url(${staticFile(`fonts/ibm-plex-mono-latin-${w}-normal.woff2`)}) format("woff2")`, { weight: w });
    (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    return face.load();
  }),
)
  .then(() => continueRender(handle))
  .catch((e) => {
    console.error(e);
    continueRender(handle);
  });
