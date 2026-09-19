// The command line that repeats a launch, built from the parameters that were
// actually read rather than from the two that are required.
//
// This exists because of a near miss. `launch.mjs` printed the line to run with
// CONFIRM set, and printed only NAME and SYMBOL in it — so following the
// instruction it had just given would have launched the token with no picture,
// no blurb and no link. Those three are written into the notice once, by the
// launch, and there is no function anywhere in the factory that changes them
// afterwards. The tool would have quietly dropped them and been right about
// everything else on the screen.
//
// Every field goes in, and the quoting has to survive a blurb with an
// apostrophe in it, because the first thing anyone writes in a blurb is a
// sentence.

/**
 * A value as a single shell word.
 *
 * Single quotes, because inside them the shell expands nothing at all — no
 * `$`, no backtick, no backslash. The one character that cannot appear is the
 * single quote itself, which is why it is closed, escaped and reopened.
 */
export function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

/** The fields a launch reads, in the order they are worth reading back. */
export const LAUNCH_FIELDS = [
  ["NAME", "name"],
  ["SYMBOL", "symbol"],
  ["IMAGE", "imageURI"],
  ["BLURB", "blurb"],
  ["LINK", "link"],
];

/**
 * `NAME='…' SYMBOL='…' … CONFIRM=launch npm run launch`, carrying every field
 * that was set. Empty ones are left out rather than passed as empty strings:
 * they are the default, and a line long enough to wrap is a line people edit.
 */
export function relaunchCommand(params) {
  const set = LAUNCH_FIELDS.filter(([, key]) => (params[key] ?? "") !== "").map(
    ([env, key]) => `${env}=${shellQuote(params[key])}`,
  );

  return `${set.join(" ")} CONFIRM=launch npm run launch`;
}
