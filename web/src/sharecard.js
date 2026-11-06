// Turns a verdict card (an SVG from /api/verdict) into a PNG on the device, then hands it to the
// phone's share sheet with the post text, so posting a verdict to X is one tap and costs nothing.
// Where the browser cannot share files (most desktops), the PNG downloads and X opens with the text.

import plex400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url";
import plex600 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url";

let fontCss = null;
/** The card's face as data URIs: an SVG drawn as an image cannot load fonts from anywhere else. */
function fonts() {
  fontCss ??= Promise.all(
    [[plex400, 400], [plex600, 600]].map(async ([url, weight]) => {
      const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return `@font-face{font-family:'IBM Plex Mono';font-weight:${weight};src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
    }),
  )
    .then((faces) => faces.join(""))
    .catch(() => (fontCss = null, "")); // try again next time; the card still draws in a fallback face
  return fontCss;
}

/** Fetches the card and draws it at twice its size: a PNG file, ready to share. */
export async function cardPng(cardUrl, name) {
  const [svg, css] = await Promise.all([fetch(cardUrl).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`card ${r.status}`)))), fonts()]);
  const withFonts = svg.replace(/<defs>/, `<defs><style>${css}</style>`);
  const url = URL.createObjectURL(new Blob([withFonts], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1350;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("could not draw the card"))), "image/png"));
    return new File([blob], name, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** True on a device whose share sheet takes image files (phones, tablets). */
export function canShareImages() {
  try {
    const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
    return !!navigator.canShare?.({ files: [probe] }) && matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/** Saves a file through a temporary link: the desktop fallback. */
export function download(file) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
