import { nodeBlockLines } from "@/lib/problems/nodes";

/**
 * Which parts of a starter to fold when it's loaded: everything except the
 * solve() function, i.e. the imports/prelude above it and the input readers
 * and main() below it. A "node classes" section is handled on its own: folded
 * when the classes are provided, left open when it holds the instructions for
 * writing them yourself. Language-agnostic: finds the first `solve(` definition
 * and its end by indentation, which every generated starter follows.
 *
 * Returns character ranges in CodeMirror's fold convention: each starts at the
 * end of the region's first line (so that line stays visible, with a "…"
 * placeholder after it) and ends at the end of its last line.
 */
export function defaultFoldRanges(text: string): { from: number; to: number }[] {
  const lines = text.split("\n");
  const start: number[] = [];
  let pos = 0;
  for (const l of lines) {
    start.push(pos);
    pos += l.length + 1;
  }
  const endOf = (i: number) => start[i] + lines[i].length;
  const blank = (i: number) => lines[i].trim() === "";
  const indent = (i: number) => /^[\t ]*/.exec(lines[i])![0].replace(/\t/g, "    ").length;
  const isComment = (i: number) => /^\s*(\/\/|#(?!include|!)|\/\*|\*|--)/.test(lines[i]);

  const def = lines.findIndex((l) => /\bsolve\s*\(/i.test(l));
  if (def < 0) return [];

  // End of solve: the first later non-blank line indented no deeper than the
  // definition. A closing brace/`end` belongs to solve; anything else (Python's
  // next `def`) starts the next section.
  const base = indent(def);
  let last = lines.length - 1;
  for (let i = def + 1; i < lines.length; i++) {
    if (blank(i) || indent(i) > base) continue;
    last = /^\s*(}|end\b)/.test(lines[i]) ? i : i - 1;
    break;
  }
  while (last > def && blank(last)) last--;

  const out: { from: number; to: number }[] = [];
  const region = (a: number, b: number) => {
    while (a <= b && blank(a)) a++;
    while (b >= a && blank(b)) b--;
    // A one-line region has nothing to hide (its first line stays visible).
    if (b > a) out.push({ from: endOf(a), to: endOf(b) });
  };

  // Above: stop before any comment block attached to solve (it's the docs).
  let top = def - 1;
  while (top >= 0 && isComment(top)) top--;
  const nodes = nodeBlockLines(lines);
  if (nodes && nodes.end < def) {
    region(0, nodes.begin - 1);
    if (nodes.mode === "provided") out.push({ from: endOf(nodes.begin), to: endOf(nodes.end) });
    region(nodes.end + 1, top);
  } else {
    region(0, top);
  }
  region(last + 1, lines.length - 1);
  return out;
}
