// Renders the Quadpad brand kit.
//
//   node render.mjs
//
// Vector marks go straight through sharp; the banner and the cards are laid out
// in HTML and screenshotted, because they are typography, not geometry.
// Everything here is reproducible — edit the source, re-run, commit the output.
import { copyFileSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

import { FOUR, SIZE, fourBodySvg, fourSvg, lockupSvg, wordmarkSvg, PALETTE } from "./lib/marks.mjs";
import { RATE, assertAgainstContracts } from "./numbers.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");

// --- the things you would change -------------------------------------------
export const BRAND = {
  ticker: "$QUAD",
  chain: "ROBINHOOD CHAIN 4663",
  venue: "UNISWAP V4",
  promise: `${RATE.fee} PER SWAP · ${RATE.creator} TO THE CREATOR`,
  tagline: "ONE RATE. ONE SUPPLY. ONE OPENING PRICE.",
  line: `Every token opens the same way: ${RATE.supplyShort} of it, all in the pool, priced so the lot comes to ${RATE.marketCap}. After that every swap pays ${RATE.fee}, and ${RATE.creator} of that is the launcher's.`,
};

// No domain and no handle on any of this art. The profile shows both already,
// and an image that repeats them is one more thing that can go stale or turn out
// to belong to somebody else. Nothing gets printed as pixels until it is
// registered — see X-PROFILE.md.

const CHECK = assertAgainstContracts();
// ---------------------------------------------------------------------------

mkdirSync(out, { recursive: true });

const CSS_URL = "https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@400;600&display=swap";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const fontCache = join(here, ".fonts");

/**
 * Fetches the webfonts in Node and inlines them as data URIs.
 *
 * The headless browser does not inherit this environment's HTTP proxy, so a
 * <link> to Google Fonts silently fetches nothing and every render lands in a
 * fallback face. Node does have the proxy, so it does the fetching; the browser
 * then needs no network at all, which also makes a re-render reproducible.
 */
async function inlineFonts() {
  mkdirSync(fontCache, { recursive: true });

  const cssPath = join(fontCache, "faces.css");
  let css;
  if (existsSync(cssPath)) {
    css = readFileSync(cssPath, "utf8");
  } else {
    const response = await fetch(CSS_URL, { headers: { "User-Agent": UA } });
    if (!response.ok) throw new Error(`could not fetch font css: ${response.status}`);
    css = await response.text();
    writeFileSync(cssPath, css);
  }

  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
  const inlined = await Promise.all(
    urls.map(async (url) => {
      const file = join(fontCache, url.split("/").pop());
      let bytes;
      if (existsSync(file)) {
        bytes = readFileSync(file);
      } else {
        const response = await fetch(url, { headers: { "User-Agent": UA } });
        if (!response.ok) throw new Error(`could not fetch ${url}: ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        writeFileSync(file, bytes);
      }
      const type = url.endsWith(".woff2") ? "font/woff2" : "font/ttf";
      return [url, `data:${type};base64,${bytes.toString("base64")}`];
    }),
  );

  let embedded = css;
  for (const [url, dataUri] of inlined) embedded = embedded.split(url).join(dataUri);
  return `<style>${embedded}</style>`;
}

const FONTS = await inlineFonts();

// The sheet is ruled like drafting paper rather than textured like Tollpad's
// asphalt: this launchpad's whole claim is that every launch is the same
// measured thing, and a grid is what measured things get drawn on.
const BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "IBM Plex Mono", ui-monospace, monospace; color: ${PALETTE.paper}; }
  .sheet-bg {
    background-color: ${PALETTE.ground};
    background-image:
      linear-gradient(${PALETTE.rule} 1px, transparent 1px),
      linear-gradient(90deg, ${PALETTE.rule} 1px, transparent 1px),
      radial-gradient(rgb(62 224 139 / .05) .5px, transparent .5px);
    background-size: 25px 25px, 25px 25px, 25px 25px;
  }
  .edge { height: 12px; background-image: repeating-linear-gradient(90deg, ${PALETTE.signal} 0 25px, ${PALETTE.ground} 25px 50px); }
  .micro { font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: ${PALETTE.inkFaint}; }
  .chip {
    display: inline-flex; align-items: center; border: 2px solid ${PALETTE.signal};
    padding: 7px 13px; font-size: 12px; font-weight: 600; letter-spacing: .14em;
    text-transform: uppercase; color: ${PALETTE.signal};
  }
  .chip.solid { background: ${PALETTE.signal}; color: ${PALETTE.ink}; border-color: ${PALETTE.signal}; }
  .card { border: 3px solid ${PALETTE.signal}; background: ${PALETTE.groundDeep}; }
  .card.fill { display: flex; flex-direction: column; height: 100%; }
  .card.fill .row { flex: 1; align-items: center; }
  .row { display: flex; justify-content: space-between; gap: 18px; padding: 9px 18px; border-bottom: 1px solid rgb(62 224 139 / .2); font-size: 15px; }
  .row:last-child { border-bottom: 0; }
  .row span { color: ${PALETTE.inkFaint}; }
  .row b { font-weight: 600; color: ${PALETTE.paper}; }
  .display { font-family: "Archivo Black", sans-serif; letter-spacing: -.01em; }
`;

function launchSheet({ width, keep = false, fill = false }) {
  const k = `${keep ? " keep" : ""}${fill ? " fill" : ""}`;
  return `
  <div class="card${k}" style="width:${width}px">
    <div style="display:flex;justify-content:space-between;background:${PALETTE.signal};color:${PALETTE.ink};padding:9px 18px;font-size:12px;font-weight:600;letter-spacing:.18em">
      <span>LAUNCH SHEET</span><span>${BRAND.venue}</span>
    </div>
    <div class="row"><span>Every swap</span><b>${RATE.fee}</b></div>
    <div class="row"><span>To the launcher</span><b>${RATE.creator} of it</b></div>
    <div class="row"><span>Pool fee</span><b>None</b></div>
    <div class="row"><span>Supply</span><b>${RATE.supply}</b></div>
    <div class="row"><span>Opens at</span><b>${RATE.marketCap}</b></div>
    <div class="row"><span>Liquidity</span><b>Locked, permanently</b></div>
  </div>`;
}

/**
 * Where X puts the profile picture, in this banner's own pixels.
 *
 * A profile header is never seen on its own: X lays the avatar over its
 * bottom-left corner, and anything under it is gone. Measured off X's own
 * layout — the avatar is about 23% of the header's width, inset about 2.5%
 * from the left, and centred on the header's bottom edge, so half of it hangs
 * below — then rounded outwards, because being too careful here costs nothing
 * and being slightly wrong costs the ticker.
 */
const AVATAR_ZONE = { x: 24, y: 308, width: 380, height: 192 };

const banner = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  body { width: 1500px; height: 500px; overflow: hidden; }
  .sheet { width: 1500px; height: 500px; display: flex; flex-direction: column; }
  /* Everything that has to survive the avatar. Checked, not hoped for. */
  .keep { }
</style></head><body>
  <div class="sheet sheet-bg">
    <div class="edge"></div>
    <div style="flex:1;display:flex;align-items:stretch;gap:48px;padding:14px 60px 22px">
      <div style="flex:1;align-self:flex-start">
        <div class="keep">${lockupSvg({ unit: 6, color: PALETTE.paper })}</div>
        <div class="keep micro" style="margin-top:18px;color:${PALETTE.signal}">${BRAND.tagline}</div>
        <div class="keep" style="margin-top:12px;font-size:16px;line-height:1.55;color:${PALETTE.inkFaint};max-width:560px">${BRAND.line}</div>
        <div style="margin-top:18px;display:flex;gap:10px">
          <span class="keep chip solid">${RATE.fee} PER SWAP</span>
          <span class="keep chip">OPENS AT ${RATE.marketCap}</span>
          <span class="keep chip">LIQUIDITY LOCKED</span>
        </div>
      </div>
      ${launchSheet({ width: 430, keep: true, fill: true })}
    </div>
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:34px;padding:13px 60px;border-top:2px solid rgb(62 224 139 / .3);background:${PALETTE.groundDeep}">
      <span class="keep micro" style="color:${PALETTE.signal};font-weight:600">${BRAND.ticker}</span>
      <span class="keep micro" style="color:${PALETTE.signal};font-weight:600">${BRAND.venue}</span>
      <span class="keep micro" style="color:${PALETTE.signal};font-weight:600">${BRAND.chain}</span>
    </div>
  </div>
</body></html>`;

const og = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  body { width: 1200px; height: 630px; overflow: hidden; background: ${PALETTE.ink}; }
  .frame { width: 1200px; height: 630px; padding: 42px; }
  .panel { width: 100%; height: 100%; border: 3px solid ${PALETTE.signal}; display: flex; flex-direction: column; }
</style></head><body>
  <div class="frame sheet-bg">
    <div class="panel">
      <div style="display:flex;justify-content:space-between;padding:11px 26px;background:${PALETTE.signal};color:${PALETTE.ink};font-size:12px;font-weight:600;letter-spacing:.18em">
        <span>${BRAND.venue} · ${BRAND.chain}</span>
        <span>${BRAND.ticker}</span>
      </div>
      <div style="flex:1;min-height:0;padding:30px 46px;display:flex;flex-direction:column;justify-content:center">
        ${lockupSvg({ unit: 5, color: PALETTE.paper })}
        <h1 class="display" style="font-size:58px;line-height:1.08;margin-top:24px;max-width:17ch;color:${PALETTE.paper}">Every launch opens at ${RATE.marketCap}</h1>
        <p style="margin-top:18px;font-size:19px;line-height:1.55;color:${PALETTE.inkFaint};max-width:62ch">
          ${RATE.supply} tokens, all of them in the pool, priced so the whole supply comes to ${RATE.marketCap} at the tick it opens on. No presale to price it, and nothing held back to sell into it. Every swap after that pays ${RATE.fee}.
        </p>
        <div style="margin-top:24px;display:flex;gap:10px">
          <span class="chip solid">SUPPLY ALL IN</span>
          <span class="chip">POOL LOCKED</span>
          <span class="chip">NO TEAM BAG</span>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

const launchCard = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  body { width: 1600px; height: 900px; overflow: hidden; background: ${PALETTE.ink}; }
  .frame { width: 1600px; height: 900px; padding: 50px; }
  .panel { width: 100%; height: 100%; border: 4px solid ${PALETTE.signal}; display: flex; flex-direction: column; }
  .split { display: flex; justify-content: space-between; align-items: baseline; gap: 24px; padding: 15px 0; border-bottom: 1px solid rgb(62 224 139 / .2); }
  .split:last-child { border-bottom: 0; }
  .split span { font-size: 19px; letter-spacing: .1em; text-transform: uppercase; color: ${PALETTE.inkFaint}; }
  .split b { font-size: 27px; font-weight: 600; color: ${PALETTE.paper}; }
</style></head><body>
  <div class="frame sheet-bg">
    <div class="panel">
      <div style="display:flex;justify-content:space-between;background:${PALETTE.signal};color:${PALETTE.ink};padding:15px 34px;font-size:17px;font-weight:600;letter-spacing:.18em">
        <span>THE WHOLE LAUNCH, ON ONE SHEET</span>
        <span>${BRAND.chain}</span>
      </div>

      <div style="flex:1;min-height:0;display:flex;align-items:center;gap:56px;padding:32px 48px">
        <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:20px">
          ${fourSvg({ size: 230 })}
          <div class="display" style="font-size:74px;line-height:1;color:${PALETTE.signal}">${RATE.fee}</div>
          <div class="micro" style="font-size:16px">OF EVERY SWAP</div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="split"><span>Opening market cap</span><b>${RATE.marketCap}, every launch</b></div>
          <div class="split"><span>Supply, minted once</span><b>${RATE.supply}</b></div>
          <div class="split"><span>To the launcher</span><b>${RATE.creator} of the fee</b></div>
          <div class="split"><span>To the treasury</span><b>${RATE.treasury} of the fee</b></div>
          <div class="split"><span>To liquidity providers</span><b>Nothing — there is no pool fee</b></div>
          <div class="split"><span>Held back at launch</span><b>None of the supply</b></div>
        </div>
      </div>

      <div style="padding:24px 48px;border-top:3px solid ${PALETTE.signal};background:${PALETTE.groundDeep}">
        <div style="font-size:20px;line-height:1.55;color:${PALETTE.paper};max-width:92ch">
          The rate lives in the hook, and the hook is part of the pool's key — it cannot be swapped, raised or switched off later. ${RATE.marketCap} is what the supply is priced at when the pool opens — ${RATE.marketCapExact} exactly, because ticks are discrete — and not money sitting in it: the pool opens one-sided, so the ETH only arrives if somebody buys.
        </div>
        <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
          <span class="micro" style="color:${PALETTE.signal};font-weight:600">${BRAND.ticker}</span>
          <span class="micro" style="color:${PALETTE.signal};font-weight:600">${BRAND.promise}</span>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

// --- vector marks -----------------------------------------------------------
writeFileSync(join(out, "logo-mark.svg"), fourSvg({ size: 512 }));
writeFileSync(join(out, "logo-wordmark.svg"), wordmarkSvg({ unit: 12 }));
writeFileSync(join(out, "logo-lockup.svg"), lockupSvg({ unit: 12 }));
writeFileSync(join(out, "logo-lockup-dark.svg"), lockupSvg({ unit: 12, color: PALETTE.paper }));

for (const size of [256, 512, 1024]) {
  await sharp(Buffer.from(fourSvg({ size }))).png().toFile(join(out, `logo-mark-${size}.png`));
}

// Avatar: full-bleed signal green, because X crops a profile picture to a circle
// and a centred mark on a square loses its corners to the crop.
//
// The four needs no inset beyond the logo's own: it is compact and it sits on
// the middle of the grid, so at this padding its furthest corner lands 400px
// from the centre of a 1000px square — a hundred pixels of clearance inside the
// circle the crop takes. Widening the padding only shrinks the mark in the feed.
const AVATAR_PAD = 2;
const avatarSpan = 12 + AVATAR_PAD * 2;
const avatar = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${avatarSpan} ${avatarSpan}" width="1000" height="1000" shape-rendering="crispEdges">
  <rect width="${avatarSpan}" height="${avatarSpan}" fill="${PALETTE.signal}"/>
  ${fourBodySvg({ pad: AVATAR_PAD })}
</svg>`;
await sharp(Buffer.from(avatar)).png().toFile(join(out, "avatar-1000.png"));

// --- typography-heavy pieces ------------------------------------------------
// Playwright insists on the exact Chromium build its version pins, and an
// environment that ships a different one has a working browser sitting right
// there. Use it rather than downloading a second copy, but only when the pinned
// build is genuinely absent.
const pinned = chromium.executablePath();
const fallback = process.env.PLAYWRIGHT_BROWSERS_PATH ? join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium") : null;
const executablePath = existsSync(pinned) || !fallback || !existsSync(fallback) ? undefined : fallback;

if (executablePath) console.log(`using the environment's chromium at ${executablePath}`);

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const tmp = join(out, ".render");
mkdirSync(tmp, { recursive: true });

for (const { name, html, size, faces, reserved } of [
  { name: "banner-1500x500", html: banner, size: { width: 1500, height: 500 }, faces: ["IBM Plex Mono"], reserved: AVATAR_ZONE },
  { name: "og-1200x630", html: og, size: { width: 1200, height: 630 }, faces: ["Archivo Black", "IBM Plex Mono"] },
  { name: "launch-1600x900", html: launchCard, size: { width: 1600, height: 900 }, faces: ["Archivo Black", "IBM Plex Mono"] },
]) {
  // Written to disk and opened over file:// — setContent leaves the base URL at
  // about:blank, where a relative or remote font is never fetched at all.
  const page = join(tmp, `${name}.html`);
  writeFileSync(page, html);

  const tab = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  await tab.goto(pathToFileURL(page).href, { waitUntil: "networkidle" });

  // document.fonts.check() answers true for a family the page never loaded, so
  // it proves nothing. Ask for each face by name first — a face nothing on the
  // page uses is never fetched otherwise — then measure: if it is missing, the
  // text lands on the fallback and matches it exactly.
  const missing = await tab.evaluate(async (families) => {
    await Promise.all(families.map((family) => document.fonts.load(`400 64px '${family}'`)));
    await document.fonts.ready;

    const measure = (stack) => {
      const el = document.createElement("span");
      el.textContent = "Every launch opens at the same price";
      el.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:64px;font-family:${stack}`;
      document.body.appendChild(el);
      const width = el.getBoundingClientRect().width;
      el.remove();
      return width;
    };

    const fallbackWidth = measure("serif");
    return families.filter((family) => measure(`'${family}',serif`) === fallbackWidth);
  }, faces);

  if (missing.length > 0) throw new Error(`${name}: webfont did not apply — ${missing.join(", ")} fell back`);

  const overflow = await tab.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  if (overflow.x > 0 || overflow.y > 0) {
    throw new Error(`${name}: content overflows the canvas by ${overflow.x}x${overflow.y}px`);
  }

  // Nothing marked .keep may sit under the profile picture X lays over the
  // header's corner. Laying the page out so it clears the avatar is easy; the
  // part that goes wrong is a later edit that quietly pushes a chip back into
  // it, so the rule is measured on every render rather than eyeballed once.
  if (reserved) {
    const covered = await tab.evaluate((zone) => {
      const hits = [];
      for (const el of document.querySelectorAll(".keep")) {
        const box = el.getBoundingClientRect();
        const overlapX = Math.min(box.right, zone.x + zone.width) - Math.max(box.left, zone.x);
        const overlapY = Math.min(box.bottom, zone.y + zone.height) - Math.max(box.top, zone.y);
        if (overlapX > 0 && overlapY > 0) {
          hits.push(`${el.textContent.trim().slice(0, 32) || el.tagName} (${Math.round(overlapX)}x${Math.round(overlapY)}px)`);
        }
      }
      return hits;
    }, reserved);

    if (covered.length > 0) {
      throw new Error(`${name}: the profile picture would cover ${covered.join(", ")} — move it out of the bottom-left corner`);
    }
  }

  await tab.screenshot({ path: join(out, `${name}.png`) });
  await tab.close();
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });

// --- what the site gets ------------------------------------------------------
// The app carries its own copy of the mark, because a header has to tint it with
// CSS and an <img> cannot be recoloured. Tollpad's equivalent is a hand-typed
// duplicate of the grid with a comment asking whoever edits one to remember the
// other; this one is written from the same array the SVGs are drawn from, so
// there is nothing to remember.
const site = join(here, "..", "site");
if (existsSync(site)) {
  const grid = join(site, "src", "lib", "markGrid.ts");
  writeFileSync(
    grid,
    `// Generated by ../../brand/render.mjs. Do not edit — edit brand/lib/marks.mjs\n` +
      `// and re-run \`npm run render\` there.\n` +
      `//\n` +
      `// The four, as a pixel grid. The header needs the shape rather than a file:\n` +
      `// an <img> cannot be tinted, and the mark has to take the colour of whatever\n` +
      `// it sits on.\n` +
      `export const MARK_SIZE = ${SIZE};\n\n` +
      `export const MARK_GRID = [\n${FOUR.map((row) => `  "${row}",`).join("\n")}\n] as const;\n`,
  );

  const icon = join(site, "src", "app", "icon.svg");
  writeFileSync(icon, fourSvg({ size: 512 }));

  const publicBrand = join(site, "public", "brand");
  mkdirSync(publicBrand, { recursive: true });
  for (const file of ["logo-mark.svg", "logo-lockup-dark.svg", "banner-1500x500.png", "og-1200x630.png"]) {
    copyFileSync(join(out, file), join(publicBrand, file));
  }

  console.log(`site assets written to ${site}`);
}

console.log(`brand kit written to out/ — fee ${RATE.fee}, launcher ${RATE.creator}, opens at ${RATE.marketCap} (${CHECK.reason})`);
