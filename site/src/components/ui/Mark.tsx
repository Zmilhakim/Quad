import { MARK_GRID, MARK_SIZE } from "@/lib/markGrid";

/**
 * The four, as pixels.
 *
 * The grid is generated from `brand/lib/marks.mjs` — the same array the logo
 * SVGs are drawn from — so the mark in the header cannot drift from the mark on
 * the banner. Tollpad's equivalent is a hand-typed duplicate with a comment
 * asking whoever edits one to remember the other.
 *
 * It is drawn rather than loaded because an `<img>` cannot be tinted: the mark
 * has to take the colour of whatever it sits on, which is `currentColor` here.
 */
function rects(grid: readonly string[], pad: number) {
  const out: React.ReactElement[] = [];

  grid.forEach((row, y) => {
    let run = 0;
    [...row].forEach((cell, x) => {
      if (cell === "#") {
        run += 1;
        return;
      }
      if (run > 0) {
        out.push(<rect key={`${x}-${y}`} x={pad + x - run} y={pad + y} width={run} height={1} fill="currentColor" />);
        run = 0;
      }
    });
    if (run > 0) {
      out.push(
        <rect key={`end-${y}`} x={pad + row.length - run} y={pad + y} width={run} height={1} fill="currentColor" />,
      );
    }
  });

  return out;
}

export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  const pad = 2;
  const span = MARK_SIZE + pad * 2;

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <circle cx={span / 2} cy={span / 2} r={span / 2} className="fill-signal" />
      {rects(MARK_GRID, pad)}
    </svg>
  );
}
