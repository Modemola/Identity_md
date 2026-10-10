import { s } from "./dom.js";

// Line icons in IMD's register: 24px grid, 1.5px strokes, square joins, no fills.
const P = {
  seal: ["M7 12.5l3.2 3.2L17 9"],
  release: ["M4 12V5h7l9 9-7 7-9-9", "M8.5 8.5h.01"],
  page: ["M6 3h9l4 4v14H6z", "M14 3v5h5", "M9 13h7", "M9 17h5"],
  cube: ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M4 7.5l8 4.5 8-4.5", "M12 12v9"],
  gauge: ["M4 17a8 8 0 1 1 16 0", "M12 17l4-6", "M4 21h16"],
  lock: ["M6 11h12v10H6z", "M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"],
  flame: ["M12 21c-4 0-6-2.6-6-5.6 0-3.4 3-5 3-8.4 2 1 3 3 3 5 1-1 1.5-2.4 1.5-3.6 2.4 1.6 4.5 4.3 4.5 7 0 3-2.2 5.6-6 5.6z"],
  check: ["M5 12.5l4.2 4.2L19 7"],
  cross: ["M6 6l12 12", "M18 6L6 18"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  wallet: ["M3 7h16v12H3z", "M3 7l12-3v3", "M15 13h2"],
  pulse: ["M3 12h4l2-5 4 10 2-5h6"],
  fund: ["M12 3v18", "M7 7h7.5a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8"],
};

export function icon(name, size = 18) {
  return s(
    "svg",
    {
      class: `ic ic-${name}`,
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "square",
      "stroke-linejoin": "miter",
      "aria-hidden": "true",
    },
    ...(P[name] || []).map((d) => s("path", { d })),
  );
}

export const TEMPLATE_ICON = ["release", "page", "cube", "gauge"];
