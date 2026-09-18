// The Quadpad marks, drawn as pixels rather than set in a typeface.
//
// A logo that depends on a webfont breaks the moment it is used somewhere the
// font is not loaded — an email signature, a print sheet, someone else's deck.
// Everything here is rectangles, so it renders anywhere an SVG renders, at any
// size, with no font file to ship.

export const PALETTE = {
  ground: "#101826", // drafting-table blue
  groundDeep: "#080d16",
  paper: "#eef2f7",
  paperDim: "#dbe3ee",
  paperDeep: "#c3cedd",
  ink: "#080d16",
  inkSoft: "#5d6b80",
  inkFaint: "#8d9aad",
  signal: "#3ee08b", // the green a number goes when it is settled
  signalDeep: "#1f9c5c",
  rule: "#243349", // the grid on the sheet
  warn: "#e0703e",
};

const SIZE = 12;

/**
 * The mark is the numeral four.
 *
 * Every other thing this launchpad could put in a circle — a rocket, a coin, a
 * chart — is already in a thousand profile pictures and says nothing. The rate
 * is the product, so the rate is the mark: a stem, a crossbar and a diagonal,
 * which is still a four at sixteen pixels. That is the only test a profile
 * picture has to pass.
 *
 * The stem sits at x 7–8 and the crossbar at y 7–8, so the counter — the
 * triangle of empty space the diagonal closes — stays open at small sizes
 * instead of silting up into a blob.
 */
const FOUR = [
  "............",
  ".......##...",
  "......###...",
  ".....####...",
  "....##.##...",
  "...##..##...",
  "..##...##...",
  "..########..",
  "..########..",
  ".......##...",
  ".......##...",
  "............",
];

/**
 * Nothing is knocked back out of it.
 *
 * An earlier draft notched the crossbar, on the theory that a mark needs a
 * detail to be a mark. At sixteen pixels the notch read as a rendering fault
 * rather than a decision, which is the only verdict that matters here: a
 * profile picture is seen small or not at all. The counter — the triangle the
 * diagonal leaves open on the left — is the whole of the detail, and it is
 * structural, so it survives the size.
 */

/** 7 x 9 glyphs with two-pixel strokes — only the letters QUADPAD needs. */
const GLYPHS = {
  Q: [".#####.", "##...##", "##...##", "##...##", "##...##", "##...##", "##.#.##", ".#####.", ".....##"],
  U: ["##...##", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
  A: ["..###..", ".##.##.", "##...##", "##...##", "#######", "##...##", "##...##", "##...##", "##...##"],
  D: ["#####..", "##..##.", "##...##", "##...##", "##...##", "##...##", "##...##", "##..##.", "#####.."],
  P: ["######.", "##...##", "##...##", "##...##", "######.", "##.....", "##.....", "##.....", "##....."],
};

const GLYPH_WIDTH = 7;
const GLYPH_HEIGHT = 9;
const LETTER_GAP = 2;

/** Runs of set pixels become one rect each, so the output stays small. */
function rects(grid, color, offsetX = 0, offsetY = 0) {
  const out = [];
  grid.forEach((row, y) => {
    let run = 0;
    [...row].forEach((cell, x) => {
      if (cell === "#") {
        run += 1;
        return;
      }
      if (run > 0) {
        out.push(`<rect x="${offsetX + x - run}" y="${offsetY + y}" width="${run}" height="1" fill="${color}"/>`);
        run = 0;
      }
    });
    if (run > 0) {
      out.push(
        `<rect x="${offsetX + row.length - run}" y="${offsetY + y}" width="${run}" height="1" fill="${color}"/>`,
      );
    }
  });
  return out.join("");
}

/** The four, struck on a disc, with a margin so it reads as a coin and not a crop. */
export function fourSvg({ size = 512, disc = PALETTE.signal, ink = PALETTE.ink, pad = 2 } = {}) {
  const span = SIZE + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <circle cx="${span / 2}" cy="${span / 2}" r="${span / 2}" fill="${disc}"/>
  ${rects(FOUR, ink, pad, pad)}
</svg>`;
}

/** The four alone, no disc — for placing on a colour that is already the disc. */
export function fourBodySvg({ ink = PALETTE.ink, pad = 2 } = {}) {
  return rects(FOUR, ink, pad, pad);
}

function wordGrid(text) {
  const letters = [...text.toUpperCase()];
  const missing = letters.filter((letter) => !GLYPHS[letter]);
  if (missing.length > 0) throw new Error(`no pixel glyph for: ${[...new Set(missing)].join(", ")}`);
  return letters;
}

export function wordmarkSvg({ text = "QUADPAD", unit = 8, color = PALETTE.ink } = {}) {
  const letters = wordGrid(text);
  const pitch = GLYPH_WIDTH + LETTER_GAP;
  const width = letters.length * pitch - LETTER_GAP;
  const body = letters.map((letter, index) => rects(GLYPHS[letter], color, index * pitch, 0)).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${GLYPH_HEIGHT}" width="${width * unit}" height="${GLYPH_HEIGHT * unit}" shape-rendering="crispEdges">${body}</svg>`;
}

/** Mark and wordmark side by side, the way a header uses them. */
export function lockupSvg({ unit = 8, color = PALETTE.ink, disc = PALETTE.signal } = {}) {
  const letters = wordGrid("QUADPAD");
  const pitch = GLYPH_WIDTH + LETTER_GAP;
  const wordWidth = letters.length * pitch - LETTER_GAP;
  const mark = SIZE + 4;
  const gap = 5;
  const width = mark + gap + wordWidth;

  const body = letters.map((letter, index) => rects(GLYPHS[letter], color, index * pitch, 0)).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${mark}" width="${width * unit}" height="${mark * unit}" shape-rendering="crispEdges">
  <circle cx="${mark / 2}" cy="${mark / 2}" r="${mark / 2}" fill="${disc}"/>
  ${rects(FOUR, color, 2, 2)}
  <g transform="translate(${mark + gap}, ${(mark - GLYPH_HEIGHT) / 2})">${body}</g>
</svg>`;
}
