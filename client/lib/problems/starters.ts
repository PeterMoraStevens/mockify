// Generates starter code for every language from one function signature.
// Used by the problem builder (in the browser) and by the seed-problem script.
// Self-contained on purpose: only type imports, no path aliases.
//
// Types are a base type plus any number of "[]": int, long, bool, string,
// int[], string[][], bool[], long[][][] … ("array of ___", nested).
//
// I/O convention (same for every problem made this way):
//   stdin – one line per parameter, in order
//     scalar           int/long -> "42"   bool -> "true"/"false"   string -> the whole line (spaces allowed)
//     1-D array        the elements, space-separated            "1 2 3"   "ab cd"   "true false"
//     2-D and deeper   length-prefixed, recursively, on one line: [[1,2],[3]] -> "2 2 1 2 1 3"
//                      (strings inside arrays are single words)
//   stdout – the return value
//     scalar -> one line;  1-D -> space-separated on one line;  2-D -> one line per inner array
//
// ListNode and TreeNode (integer values) are also allowed as a parameter or
// return type, not inside arrays. See nodes.ts for their format and classes.

import type { LanguageId } from "../languages";
import {
  applyNodeMode,
  encodeNode,
  formatNode,
  nodeBlock,
  nodeHelpers,
  nodeKinds,
  nodeLang,
  nodeOf,
  type NodeMode,
} from "./nodes";

export { NODE_TYPES, nodeOf, nodeKinds, applyNodeMode, nodeModeOf, type NodeMode, type NodeType } from "./nodes";

export const BASE_TYPES = ["int", "long", "bool", "string"] as const;
export type BaseType = (typeof BASE_TYPES)[number];
/** e.g. "int", "string[]", "int[][]" */
export type TypeName = string;
export type Param = { name: string; type: TypeName };
export type Signature = { params: Param[]; returns: TypeName };
export type ParamType = TypeName;
export type ReturnType = TypeName;

export const MAX_PARAM_DEPTH = 4;
export const MAX_RETURN_DEPTH = 2;

type T = { base: BaseType; depth: number };

export function parseType(t: string): T | null {
  const m = /^(int|long|bool|string)((?:\[\])*)$/.exec(t);
  return m ? { base: m[1] as BaseType, depth: m[2].length / 2 } : null;
}
const ty = (t: string): T => parseType(t) ?? { base: "int", depth: 0 };
export const makeType = (base: BaseType, depth: number): TypeName => base + "[]".repeat(depth);

export function isValidType(t: string, role: "param" | "return"): boolean {
  if (nodeOf(t)) return true;
  const p = parseType(t);
  return !!p && p.depth <= (role === "param" ? MAX_PARAM_DEPTH : MAX_RETURN_DEPTH);
}

const BASE_LABEL: Record<BaseType, [string, string]> = {
  int: ["integer", "integers"],
  long: ["64-bit integer", "64-bit integers"],
  bool: ["boolean", "booleans"],
  string: ["string", "words"],
};
export function typeLabel(t: TypeName): string {
  const k = nodeOf(t);
  if (k) return k === "ListNode" ? "linked list" : "binary tree";
  const { base, depth } = ty(t);
  if (depth === 0) return BASE_LABEL[base][0];
  return `array of ${"arrays of ".repeat(depth - 1)}${BASE_LABEL[base][1]}`;
}

const PARAM_NAME_RE = /^[a-z][a-zA-Z0-9]{0,23}$/;
const RESERVED = new Set([
  "in", "is", "as", "do", "if", "fn", "of", "or", "and", "not", "for", "int", "new", "var", "val", "let", "def",
  "end", "fun", "use", "len", "str", "map", "set", "list", "line", "lines", "main", "solve", "result", "type",
  "data", "string", "class", "atoi", "object", "return", "input", "print", "func", "match", "case", "when", "where", "import",
  "tok", "tk", "res", "out", "parts", "rows", "row", "next", "long", "bool", "char", "byte", "short", "double", "float",
  "self", "this", "null", "nil", "true", "false", "std", "vec", "array", "range", "from", "with", "yield", "lambda", "global",
  "static", "const", "final", "default", "switch", "break", "continue", "while", "loop", "unsafe", "move", "ref", "mut", "impl",
  "trait", "struct", "enum", "interface", "package", "go", "defer", "chan", "select", "begin", "rescue", "ensure", "unless",
  "until", "redo", "retry", "super", "extends", "implements", "private", "public", "protected", "internal", "operator",
  "inline", "sizeof", "typedef", "union", "extern", "register", "auto", "signed", "unsigned", "volatile", "goto", "cap", "copy",
  "l", "r", "j", "p", "br", "nl", "buf", "returnsize", "returncolumnsizes",
  "listnode", "treenode", "buildlist", "buildtree", "liststr", "treestr", "printlist", "printtree", "newtreenode",
]);

export function validateSignature(sig: Signature): string | null {
  if (sig.params.length === 0) return "Add at least one parameter.";
  if (sig.params.length > 6) return "At most 6 parameters.";
  const seen = new Set<string>();
  for (const p of sig.params) {
    if (!PARAM_NAME_RE.test(p.name)) return `"${p.name}" isn't a valid name. Use camelCase letters and digits, starting lowercase.`;
    if (RESERVED.has(p.name.toLowerCase()) || /^read/i.test(p.name) || /^t?k\d+$/.test(p.name))
      return `"${p.name}" is reserved in some languages. Pick another name.`;
    if (seen.has(p.name)) return `Duplicate parameter "${p.name}".`;
    if (!isValidType(p.type, "param"))
      return `"${p.name}" has an unsupported type. Arrays can nest at most ${MAX_PARAM_DEPTH} deep, and lists/trees can't go inside arrays.`;
    seen.add(p.name);
  }
  if (!isValidType(sig.returns, "return")) return `The return type can nest at most ${MAX_RETURN_DEPTH} arrays deep.`;
  return null;
}

/** Languages whose starter can express this signature (C stops at 2-D, Bash at 1-D). */
export function supportsSignature(lang: LanguageId, sig: Signature): boolean {
  if (nodeKinds(sig).length && !nodeLang(lang)) return false;
  const max = Math.max(...sig.params.map((p) => ty(p.type).depth), ty(sig.returns).depth);
  if (lang === "bash") return max <= 1;
  if (lang === "c") return max <= 2;
  return true;
}

/** Markdown appended to the problem description. */
export function ioSection(sig: Signature): string {
  const nested = sig.params.some((p) => ty(p.type).depth >= 2);
  const lines = sig.params.map((p, i) => {
    const k = nodeOf(p.type);
    if (k)
      return `- Line ${i + 1}: \`${p.name}\`, ${
        k === "ListNode"
          ? "a linked list: its values in order, space-separated (an empty line is an empty list)"
          : "a binary tree in level order, space-separated, with `null` for a missing child (an empty line is an empty tree)"
      }.`;
    const { base, depth } = ty(p.type);
    const fmt =
      depth === 0
        ? base === "string"
          ? "a string (the whole line)"
          : base === "bool"
            ? "`true` or `false`"
            : "an integer"
        : depth === 1
          ? `space-separated ${base === "bool" ? "`true`/`false` values" : BASE_LABEL[base][1]}`
          : `${typeLabel(p.type)}, length-prefixed (see below)`;
    return `- Line ${i + 1}: \`${p.name}\`, ${fmt}.`;
  });
  const rk = nodeOf(sig.returns);
  const r = ty(sig.returns);
  const what = r.base === "bool" ? "`true`/`false` values" : r.base === "string" ? "strings" : "integers";
  const out = rk
    ? rk === "ListNode"
      ? "The returned list's values in order, space-separated on one line (an empty line for an empty list)."
      : "The returned tree in level order on one line, `null` for missing children, trailing `null`s dropped."
    : r.depth === 0
      ? r.base === "bool"
        ? "`true` or `false`."
        : r.base === "string"
          ? "The string on one line."
          : "One integer."
      : r.depth === 1
        ? `The ${what} on one line, separated by spaces.`
        : `One line per inner array, its ${what} separated by spaces.`;
  const usesNodes = nodeKinds(sig).length > 0;
  const nodeNote = usesNodes
    ? "\n\nLists and trees are written like `[1,2,3]` and `[3,9,20,null,null,15,7]` in the examples. The starter code turns them into `ListNode` / `TreeNode` objects for you."
    : "";
  const note = nested
    ? "\n\nNested arrays are written on one line as their length followed by each element, recursively: `[[1,2],[3]]` is `2 2 1 2 1 3`. The starter code reads this for you."
    : "";
  return `### Input\n${lines.join("\n")}${note}${nodeNote}\n\n### Output\n${out}`;
}

/** Turns per-parameter stdin lines into the full stdin text. */
export function buildStdin(values: string[]): string {
  return values.map((v) => v.replace(/\r?\n/g, " ")).join("\n") + "\n";
}

// ----------------------------------------------- values ⇄ readable literals

function checkScalar(base: BaseType, v: unknown, where: string): string {
  if (base === "bool") {
    if (v === true || v === false || v === "true" || v === "false") return String(v);
    throw new Error(`${where}: expected true or false, got ${JSON.stringify(v)}`);
  }
  if (base === "string") {
    const s = String(v);
    if (/\s/.test(s) || s === "") throw new Error(`${where}: strings inside arrays must be single words (no spaces)`);
    return s;
  }
  const s = String(v).trim();
  if (!/^-?\d+$/.test(s)) throw new Error(`${where}: expected an integer, got ${JSON.stringify(v)}`);
  const n = BigInt(s);
  const lim = base === "int" ? BigInt(2) ** BigInt(31) : BigInt(2) ** BigInt(63);
  if (n < -lim || n >= lim) throw new Error(`${where}: ${s} doesn't fit in a ${base === "int" ? "32" : "64"}-bit integer`);
  return s;
}

/**
 * Converts what an author types for one parameter into its stdin line.
 * Scalars and 1-D arrays can be typed as-is ("1 2 3"); arrays can also be
 * typed as JSON ("[[1,2],[3]]", '["ab","cd"]'), and nested ones must be.
 */
export function encodeValue(type: TypeName, text: string, name = "value"): string {
  const k = nodeOf(type);
  if (k) return encodeNode(k, text, name);
  const { base, depth } = ty(type);
  if (depth === 0) return base === "string" ? text : checkScalar(base, text.trim(), name);
  let v: unknown;
  const t = text.trim();
  if (t.startsWith("[")) {
    try {
      v = JSON.parse(t);
    } catch {
      throw new Error(`${name}: that isn't valid JSON${base === "string" ? ' (quote each word: ["ab","cd"])' : ""}`);
    }
  } else if (depth === 1) {
    v = t ? t.split(/\s+/) : [];
  } else {
    throw new Error(`${name}: write nested arrays as JSON, e.g. [[1,2],[3]]`);
  }
  const walk = (x: unknown, d: number, top: boolean): string[] => {
    if (d === 0) return [checkScalar(base, x, name)];
    if (!Array.isArray(x)) throw new Error(`${name}: expected ${"[".repeat(d)}…${"]".repeat(d)}`);
    const inner = x.flatMap((e) => walk(e, d - 1, false));
    return top && d === 1 ? inner : [String(x.length), ...inner];
  };
  return walk(v, depth, true).join(" ");
}

/** The readable form of one stdin line: 42, "hi", [1,2], [["a"],["b","c"]]. */
export function formatValue(type: TypeName, line: string): string {
  if (nodeOf(type)) return formatNode(line);
  const { base, depth } = ty(type);
  const show = (s: string) => (base === "string" ? JSON.stringify(s) : s);
  if (depth === 0) return base === "string" ? JSON.stringify(line) : line.trim();
  const toks = line.trim() ? line.trim().split(/\s+/) : [];
  if (depth === 1) return `[${toks.map(show).join(",")}]`;
  let i = 0;
  const rd = (d: number): string => {
    const n = Number(toks[i++] ?? 0);
    const parts: string[] = [];
    for (let k = 0; k < n && i <= toks.length; k++) parts.push(d === 1 ? show(toks[i++] ?? "") : rd(d - 1));
    return `[${parts.join(",")}]`;
  };
  return rd(depth);
}

/** The readable form of a program's output for the given return type. */
export function formatOutput(type: TypeName, out: string): string {
  if (nodeOf(type)) return formatNode(out.split("\n")[0] ?? "");
  const { base, depth } = ty(type);
  const text = out.replace(/\s+$/, "");
  const show = (s: string) => (base === "string" ? JSON.stringify(s) : s);
  if (depth === 0) return base === "string" ? text : text.trim();
  const row = (l: string) => `[${(l.trim() ? l.trim().split(/\s+/) : []).map(show).join(",")}]`;
  if (depth === 1) return row(text);
  return `[${(text ? text.split("\n") : []).map(row).join(",")}]`;
}

/** "nums = [2,7,11,15]", one line per parameter, from a test's raw stdin. */
export function readableInput(sig: Signature, input: string): string {
  const lines = input.replace(/\n$/, "").split("\n");
  return sig.params.map((p, i) => `${p.name} = ${formatValue(p.type, lines[i] ?? "")}`).join("\n");
}

/** What the builder shows for a saved stdin line (nested arrays become JSON; the rest stays as-is). */
export function editableValue(type: TypeName, line: string): string {
  if (nodeOf(type) === "TreeNode") return formatNode(line);
  return ty(type).depth >= 2 ? formatValue(type, line) : line;
}

// ---------------------------------------------------------------------------

type Gen = (sig: Signature, doc: string, body?: string) => string;

/** Everything a generator needs to support ListNode/TreeNode for one language. */
function nodeParts(lang: LanguageId, sig: Signature) {
  const L = nodeLang(lang);
  const kinds = L ? nodeKinds(sig) : [];
  const rk = nodeOf(sig.returns);
  return {
    kinds,
    /** The marked class section ("provided" mode; generateStarter swaps it for scratch). */
    block: kinds.length ? nodeBlock(lang, kinds, "provided") : "",
    helpers: kinds.length ? nodeHelpers(lang, kinds) : "",
    /** The language's type for `type`, or `fallback` for non-node types. */
    pt: (type: string, fallback: string) => {
      const k = nodeOf(type);
      return k && L ? L.type[k] : fallback;
    },
    /** Expression reading a node param from `line`, or null for non-node types. */
    read: (type: string, line: string) => {
      const k = nodeOf(type);
      return k && L ? L.read(k, line) : null;
    },
    ret: rk && L ? { str: (v: string) => L.str(rk, v), nil: L.nil } : null,
  };
}

const ind = (s: string, n: number) =>
  s
    .split("\n")
    .map((l) => (l ? " ".repeat(n) + l : l))
    .join("\n");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Which readers a signature needs: whole-line 1-D readers, and length-prefixed readers up to some depth. */
function needs(sig: Signature) {
  const all = new Set<BaseType>();
  const nested = new Map<BaseType, number>();
  for (const p of sig.params) {
    const { base, depth } = ty(p.type);
    if (depth === 1) all.add(base);
    if (depth >= 2) nested.set(base, Math.max(nested.get(base) ?? 0, depth));
  }
  return { all, nested };
}
const ret = (sig: Signature) => ty(sig.returns);

// ------------------------------------------------------------------ Python
const python: Gen = (sig, doc, body) => {
  const N = nodeParts("python", sig);
  const T = (t: T): string => (t.depth ? `List[${T({ ...t, depth: t.depth - 1 })}]` : { int: "int", long: "int", bool: "bool", string: "str" }[t.base]);
  const sc = (b: BaseType, x: string) => ({ int: `int(${x})`, long: `int(${x})`, bool: `${x} == "true"`, string: x })[b];
  const { nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`def read_${b}_${k}(tk):
    n = int(next(tk))
    return [${k === 1 ? sc(b, "next(tk)") : `read_${b}_${k - 1}(tk)`} for _ in range(n)]`);
  const read = sig.params.map((p, i) => {
    const { base, depth } = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `    ${p.name} = ${nr}`;
    const v =
      depth === 0
        ? base === "string"
          ? l
          : sc(base, `${l}.strip()`)
        : depth === 1
          ? base === "string"
            ? `${l}.split()`
            : `[${sc(base, "x")} for x in ${l}.split()]`
          : `read_${base}_${depth}(iter(${l}.split()))`;
    return `    ${p.name} = ${v}`;
  });
  const r = ret(sig);
  const f = (x: string) => (r.base === "bool" ? `("true" if ${x} else "false")` : r.base === "string" ? x : `str(${x})`);
  const out = N.ret
    ? `print(${N.ret.str("result")})`
    : r.depth === 0
      ? `print(${r.base === "bool" ? f("result") : "result"})`
      : r.depth === 1
        ? `print(" ".join(${f("v")} for v in result))`
        : `for row in result:\n        print(" ".join(${f("v")} for v in row))`;
  const def = N.ret ? N.ret.nil : r.depth ? "[]" : { int: "0", long: "0", bool: "False", string: '""' }[r.base];
  return `import sys
from typing import List${N.kinds.length ? ", Optional" : ""}
${N.block ? `\n\n${N.block}\n` : ""}

def solve(${sig.params.map((p) => `${p.name}: ${N.pt(p.type, T(ty(p.type)))}`).join(", ")}) -> ${N.pt(sig.returns, T(r))}:
    # ${doc}
${body ? ind(body, 4) : `    return ${def}`}

${helpers.length ? `\n${helpers.join("\n\n\n")}\n\n` : ""}
def main() -> None:
    lines = sys.stdin.read().split("\\n")

    def line(i: int) -> str:
        return lines[i].rstrip("\\r") if i < len(lines) else ""

${read.join("\n")}
    result = solve(${sig.params.map((p) => p.name).join(", ")})
    ${out}


if __name__ == "__main__":
    main()
`;
};

// -------------------------------------------------------------- JS and TS
const jsLike = (ts: boolean): Gen => (sig, doc, body) => {
  const N = nodeParts(ts ? "typescript" : "javascript", sig);
  const T = (t: T): string => ({ int: "number", long: "number", bool: "boolean", string: "string" })[t.base] + "[]".repeat(t.depth);
  const sc = (b: BaseType, x: string) => ({ int: `Number(${x})`, long: `Number(${x})`, bool: `${x} === "true"`, string: x })[b];
  const a = (s: string) => (ts ? s : "");
  const { nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`function read${cap(b)}${k}(tk${a(": Tok")})${a(`: ${T({ base: b, depth: k })}`)} {
  const n = Number(tk.next());
  const res${a(`: ${T({ base: b, depth: k })}`)} = [];
  for (let i = 0; i < n; i++) res.push(${k === 1 ? sc(b, "tk.next()") : `read${cap(b)}${k - 1}(tk)`});
  return res;
}`);
  const read = sig.params.map((p, i) => {
    const { base, depth } = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `  const ${p.name} = ${nr};`;
    const v =
      depth === 0
        ? base === "string"
          ? l
          : sc(base, `${l}.trim()`)
        : depth === 1
          ? `readWords(${l})${base === "string" ? "" : `.map((x) => ${sc(base, "x")})`}`
          : `read${cap(base)}${depth}(tok(${l}))`;
    return `  const ${p.name} = ${v};`;
  });
  const r = ret(sig);
  const f = (x: string) => (r.base === "bool" ? `(${x} ? "true" : "false")` : `String(${x})`);
  const out = N.ret
    ? `console.log(${N.ret.str("result")});`
    : r.depth === 0
      ? `console.log(${f("result")});`
      : r.depth === 1
        ? `console.log(result.map((v) => ${f("v")}).join(" "));`
        : `console.log(result.map((row) => row.map((v) => ${f("v")}).join(" ")).join("\\n"));`;
  const def = N.ret ? N.ret.nil : r.depth ? "[]" : { int: "0", long: "0", bool: "false", string: '""' }[r.base];
  const params = sig.params.map((p) => (ts ? `${p.name}: ${N.pt(p.type, T(ty(p.type)))}` : p.name)).join(", ");
  const tokDef = nested.size
    ? `
${ts ? "type Tok = { next: () => string };\n\n" : ""}function tok(s${a(": string")})${a(": Tok")} {
  const t = readWords(s);
  let i = 0;
  return { next: () => t[i++] ?? "0" };
}
`
    : "";
  return `${ts ? '/// <reference lib="es2022" />\ndeclare const require: any;\n\n' : ""}${N.block ? `${N.block}\n\n` : ""}function solve(${params})${ts ? `: ${N.pt(sig.returns, T(r))}` : ""} {
  // ${doc}
${body ? ind(body, 2) : `  return ${def};`}
}

function readWords(s${a(": string")})${a(": string[]")} {
  return s.trim().split(/\\s+/).filter(Boolean);
}
${tokDef}${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
function main()${a(": void")} {
  const lines${a(": string[]")} = require("fs").readFileSync(0, "utf8").split("\\n");
  const line = (i${a(": number")})${a(": string")} => (lines[i] ?? "").replace(/\\r$/, "");
${read.join("\n")}
  const result = solve(${sig.params.map((p) => p.name).join(", ")});
  ${out}
}

main();
`;
};

// -------------------------------------------------------------------- Java
const java: Gen = (sig, doc, body) => {
  const N = nodeParts("java", sig);
  const B = { int: "int", long: "long", bool: "boolean", string: "String" } as const;
  const T = (t: T) => B[t.base] + "[]".repeat(t.depth);
  const sc = (b: BaseType, x: string) => ({ int: `Integer.parseInt(${x})`, long: `Long.parseLong(${x})`, bool: `${x}.equals("true")`, string: x })[b];
  const { all, nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const b of all)
    helpers.push(`    static ${B[b]}[] readAll${cap(b)}(Tok tk) {
        ${B[b]}[] res = new ${B[b]}[tk.left()];
        for (int i = 0; i < res.length; i++) res[i] = ${sc(b, "tk.next()")};
        return res;
    }`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`    static ${T({ base: b, depth: k })} read${cap(b)}${k}(Tok tk) {
        int n = Integer.parseInt(tk.next());
        ${T({ base: b, depth: k })} res = new ${B[b]}[n]${"[]".repeat(k - 1)};
        for (int i = 0; i < n; i++) res[i] = ${k === 1 ? sc(b, "tk.next()") : `read${cap(b)}${k - 1}(tk)`};
        return res;
    }`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(lines, ${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `        ${N.pt(p.type, "")} ${p.name} = ${nr};`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `${l}.trim()`)
        : t.depth === 1
          ? `readAll${cap(t.base)}(new Tok(${l}))`
          : `read${cap(t.base)}${t.depth}(new Tok(${l}))`;
    return `        ${T(t)} ${p.name} = ${v};`;
  });
  const r = ret(sig);
  const f = (x: string) => (r.base === "bool" ? `(${x} ? "true" : "false")` : x);
  const out = N.ret
    ? `System.out.println(${N.ret.str("result")});`
    : r.depth === 0
      ? `System.out.println(${f("result")});`
      : r.depth === 1
        ? `StringBuilder _sb = new StringBuilder();
        for (int _i = 0; _i < result.length; _i++) _sb.append(_i > 0 ? " " : "").append(${f("result[_i]")});
        System.out.println(_sb);`
        : `StringBuilder _sb = new StringBuilder();
        for (int _r = 0; _r < result.length; _r++) {
            if (_r > 0) _sb.append("\\n");
            for (int _i = 0; _i < result[_r].length; _i++) _sb.append(_i > 0 ? " " : "").append(${f("result[_r][_i]")});
        }
        System.out.println(_sb);`;
  const def = N.ret ? N.ret.nil : r.depth ? `new ${B[r.base]}[0]${"[]".repeat(r.depth - 1)}` : { int: "0", long: "0L", bool: "false", string: '""' }[r.base];
  return `import java.io.*;
import java.util.*;

${N.block ? `${N.block}\n\n` : ""}public class Main {
    static ${N.pt(sig.returns, T(r))} solve(${sig.params.map((p) => `${N.pt(p.type, T(ty(p.type)))} ${p.name}`).join(", ")}) {
        // ${doc}
${body ? ind(body, 8) : `        return ${def};`}
    }

    static class Tok {
        final String[] t;
        int i = 0;
        Tok(String s) {
            String x = s.trim();
            t = x.isEmpty() ? new String[0] : x.split("\\\\s+");
        }
        String next() { return i < t.length ? t[i++] : "0"; }
        int left() { return t.length - i; }
    }

    static String line(List<String> lines, int i) {
        return i < lines.size() ? lines.get(i) : "";
    }
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        List<String> lines = new ArrayList<>();
        for (String _l; (_l = br.readLine()) != null; ) lines.add(_l);
${read.join("\n")}
        ${N.pt(sig.returns, T(r))} result = solve(${sig.params.map((p) => p.name).join(", ")});
        ${out}
    }
}
`;
};

// ----------------------------------------------------------------------- C
const c: Gen = (sig, doc, body) => {
  const N = nodeParts("c", sig);
  const B = { int: "int", long: "long long", bool: "bool", string: "char*" } as const;
  const sc = (b: BaseType, x: string) =>
    ({ int: `(int)strtol(${x}, NULL, 10)`, long: `strtoll(${x}, NULL, 10)`, bool: `(strcmp(${x}, "true") == 0)`, string: x })[b];
  const PF = { int: "%d", long: "%lld", bool: "%s", string: "%s" } as const;
  const args: string[] = [];
  for (const p of sig.params) {
    if (nodeOf(p.type)) {
      args.push(`${N.pt(p.type, "")} ${p.name}`);
      continue;
    }
    const { base, depth } = ty(p.type);
    if (depth === 0) args.push(`${B[base]} ${p.name}`);
    else if (depth === 1) args.push(`${B[base]}* ${p.name}`, `int ${p.name}Size`);
    else args.push(`${B[base]}** ${p.name}`, `int ${p.name}Size`, `int* ${p.name}ColSize`);
  }
  const r = ret(sig);
  if (r.depth >= 1) args.push("int* returnSize");
  if (r.depth === 2) args.push("int** returnColumnSizes");
  const RT = N.pt(sig.returns, B[r.base] + "*".repeat(r.depth));
  const def = N.ret
    ? `    return ${N.ret.nil};`
    : r.depth === 0
      ? `    return ${{ int: "0", long: "0", bool: "false", string: '""' }[r.base]};`
      : r.depth === 1
        ? "    *returnSize = 0;\n    return NULL;"
        : "    *returnSize = 0;\n    *returnColumnSizes = NULL;\n    return NULL;";
  const read: string[] = [];
  const call: string[] = [];
  sig.params.forEach((p, i) => {
    const { base, depth } = ty(p.type);
    const n = p.name;
    if (nodeOf(p.type)) {
      read.push(`    ${N.pt(p.type, "")} ${n} = ${N.read(p.type, `line(${i})`)};`);
      call.push(n);
      return;
    }
    if (depth === 0 && base === "string") {
      read.push(`    char* ${n} = line(${i});`);
      call.push(n);
      return;
    }
    read.push(`    Tok k${i} = tok(line(${i}));`);
    if (depth === 0) {
      read.push(`    ${B[base]} ${n} = ${sc(base, `tk_next(&k${i})`)};`);
      call.push(n);
    } else if (depth === 1) {
      read.push(
        `    int ${n}Size = k${i}.n;`,
        `    ${B[base]}* ${n} = malloc((${n}Size + 1) * sizeof(${B[base]}));`,
        `    for (int j = 0; j < ${n}Size; j++) ${n}[j] = ${sc(base, `k${i}.t[j]`)};`,
      );
      call.push(n, `${n}Size`);
    } else {
      read.push(
        `    int ${n}Size = atoi(tk_next(&k${i}));`,
        `    ${B[base]}** ${n} = malloc((${n}Size + 1) * sizeof(${B[base]}*));`,
        `    int* ${n}ColSize = malloc((${n}Size + 1) * sizeof(int));`,
        `    for (int r = 0; r < ${n}Size; r++) {`,
        `        ${n}ColSize[r] = atoi(tk_next(&k${i}));`,
        `        ${n}[r] = malloc((${n}ColSize[r] + 1) * sizeof(${B[base]}));`,
        `        for (int j = 0; j < ${n}ColSize[r]; j++) ${n}[r][j] = ${sc(base, `tk_next(&k${i})`)};`,
        `    }`,
      );
      call.push(n, `${n}Size`, `${n}ColSize`);
    }
  });
  if (r.depth >= 1) {
    read.push("    int returnSize = 0;");
    call.push("&returnSize");
  }
  if (r.depth === 2) {
    read.push("    int* returnColumnSizes = NULL;");
    call.push("&returnColumnSizes");
  }
  const val = (x: string) => (r.base === "bool" ? `${x} ? "true" : "false"` : r.base === "string" ? `${x} ? ${x} : ""` : x);
  const out = N.ret
    ? `    ${nodeOf(sig.returns) === "ListNode" ? "print_list" : "print_tree"}(result);`
    : r.depth === 0
      ? `    printf("${PF[r.base]}\\n", ${val("result")});`
      : r.depth === 1
        ? `    for (int i = 0; i < returnSize; i++) printf(i ? " ${PF[r.base]}" : "${PF[r.base]}", ${val("result[i]")});
    printf("\\n");`
        : `    for (int r = 0; r < returnSize; r++) {
        for (int i = 0; i < returnColumnSizes[r]; i++) printf(i ? " ${PF[r.base]}" : "${PF[r.base]}", ${val("result[r][i]")});
        printf("\\n");
    }`;
  return `#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${N.block ? `${N.block}\n\n` : ""}${RT} solve(${args.join(", ")}) {
    // ${doc}
${body ? ind(body, 4) : def}
}

static char* read_all(void) {
    size_t cap = 1 << 16, len = 0;
    char* buf = malloc(cap);
    for (;;) {
        if (len + 1 >= cap) buf = realloc(buf, cap *= 2);
        size_t r = fread(buf + len, 1, cap - len - 1, stdin);
        if (r == 0) break;
        len += r;
    }
    buf[len] = '\\0';
    return buf;
}

static char** g_lines;
static int g_count;

static char* line(int i) {
    return i < g_count ? g_lines[i] : "";
}

typedef struct {
    char** t;
    int n, i;
} Tok;

__attribute__((unused)) static Tok tok(const char* s) {
    Tok k = {0};
    char* copy = strdup(s);
    int cap = 16;
    k.t = malloc(cap * sizeof(char*));
    for (char* w = strtok(copy, " \\t"); w; w = strtok(NULL, " \\t")) {
        if (k.n == cap) k.t = realloc(k.t, (cap *= 2) * sizeof(char*));
        k.t[k.n++] = w;
    }
    return k;
}

__attribute__((unused)) static char* tk_next(Tok* k) {
    return k->i < k->n ? k->t[k->i++] : "0";
}

${N.helpers ? `${N.helpers}\n\n` : ""}int main(void) {
    char* input = read_all();
    int cap = 8;
    g_lines = malloc(cap * sizeof(char*));
    for (char* p = input;;) {
        if (g_count == cap) g_lines = realloc(g_lines, (cap *= 2) * sizeof(char*));
        g_lines[g_count++] = p;
        char* nl = strchr(p, '\\n');
        size_t n = nl ? (size_t)(nl - p) : strlen(p);
        if (n && p[n - 1] == '\\r') p[n - 1] = '\\0';
        if (!nl) break;
        *nl = '\\0';
        p = nl + 1;
    }
${read.join("\n")}
    ${RT} result = solve(${call.join(", ")});
${out}
    return 0;
}
`;
};

// --------------------------------------------------------------------- C++
const cpp: Gen = (sig, doc, body) => {
  const N = nodeParts("cpp", sig);
  const B = { int: "int", long: "long long", bool: "bool", string: "string" } as const;
  const T = (t: T): string => (t.depth ? `vector<${T({ ...t, depth: t.depth - 1 })}>` : B[t.base]);
  const sc = (b: BaseType, x: string) => ({ int: `stoi(${x})`, long: `stoll(${x})`, bool: `(${x} == "true")`, string: x })[b];
  const { all, nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const b of all)
    helpers.push(`static vector<${B[b]}> readAll${cap(b)}(Tok tk) {
    vector<${B[b]}> res;
    while (tk.i < tk.t.size()) res.push_back(${sc(b, "tk.next()")});
    return res;
}`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`static ${T({ base: b, depth: k })} read${cap(b)}${k}(Tok& tk) {
    int n = stoi(tk.next());
    ${T({ base: b, depth: k })} res;
    for (int i = 0; i < n; i++) res.push_back(${k === 1 ? sc(b, "tk.next()") : `read${cap(b)}${k - 1}(tk)`});
    return res;
}`);
  const read = sig.params.flatMap((p, i) => {
    const t = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return [`    ${N.pt(p.type, "")} ${p.name} = ${nr};`];
    if (t.depth === 0) return [`    ${T(t)} ${p.name} = ${t.base === "string" ? l : sc(t.base, `Tok(${l}).next()`)};`];
    if (t.depth === 1) return [`    ${T(t)} ${p.name} = readAll${cap(t.base)}(Tok(${l}));`];
    return [`    Tok tk${i}(${l});`, `    ${T(t)} ${p.name} = read${cap(t.base)}${t.depth}(tk${i});`];
  });
  const r = ret(sig);
  const f = (x: string) => (r.base === "bool" ? `(${x} ? "true" : "false")` : x);
  const out = N.ret
    ? `    cout << ${N.ret.str("result")} << "\\n";`
    : r.depth === 0
      ? `    cout << ${f("result")} << "\\n";`
      : r.depth === 1
        ? `    for (size_t i = 0; i < result.size(); i++) cout << (i ? " " : "") << ${f("result[i]")};
    cout << "\\n";`
        : `    for (auto& row : result) {
        for (size_t i = 0; i < row.size(); i++) cout << (i ? " " : "") << ${f("row[i]")};
        cout << "\\n";
    }`;
  const def = N.ret ? N.ret.nil : r.depth ? "{}" : { int: "0", long: "0", bool: "false", string: '""' }[r.base];
  const arg = (p: Param) => {
    if (nodeOf(p.type)) return `${N.pt(p.type, "")} ${p.name}`;
    const t = ty(p.type);
    return `${T(t)}${t.depth || t.base === "string" ? "&" : ""} ${p.name}`;
  };
  return `#include <algorithm>
#include <climits>
#include <iostream>
#include <map>
#include <numeric>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

${N.block ? `${N.block}\n\n` : ""}${N.pt(sig.returns, T(r))} solve(${sig.params.map(arg).join(", ")}) {
    // ${doc}
${body ? ind(body, 4) : `    return ${def};`}
}

struct Tok {
    vector<string> t;
    size_t i = 0;
    explicit Tok(const string& s) {
        istringstream is(s);
        for (string w; is >> w;) t.push_back(w);
    }
    string next() { return i < t.size() ? t[i++] : "0"; }
};

static vector<string> g_lines;
static string line(size_t i) { return i < g_lines.size() ? g_lines[i] : string(); }
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    for (string l; getline(cin, l);) {
        if (!l.empty() && l.back() == '\\r') l.pop_back();
        g_lines.push_back(l);
    }
${read.join("\n")}
    ${N.pt(sig.returns, T(r))} result = solve(${sig.params.map((p) => p.name).join(", ")});
${out}
    return 0;
}
`;
};

// ---------------------------------------------------------------------- C#
const csharp: Gen = (sig, doc, body) => {
  const N = nodeParts("csharp", sig);
  const B = { int: "int", long: "long", bool: "bool", string: "string" } as const;
  const T = (t: T) => B[t.base] + "[]".repeat(t.depth);
  const sc = (b: BaseType, x: string) => ({ int: `int.Parse(${x})`, long: `long.Parse(${x})`, bool: `${x} == "true"`, string: x })[b];
  const { all, nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const b of all)
    helpers.push(`    static ${B[b]}[] ReadAll${cap(b)}(Tok tk) {
        var res = new ${B[b]}[tk.Left];
        for (int i = 0; i < res.Length; i++) res[i] = ${sc(b, "tk.Next()")};
        return res;
    }`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`    static ${T({ base: b, depth: k })} Read${cap(b)}${k}(Tok tk) {
        int n = int.Parse(tk.Next());
        var res = new ${B[b]}[n]${"[]".repeat(k - 1)};
        for (int i = 0; i < n; i++) res[i] = ${k === 1 ? sc(b, "tk.Next()") : `Read${cap(b)}${k - 1}(tk)`};
        return res;
    }`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `Line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `        ${N.pt(p.type, "")} ${p.name} = ${nr};`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `${l}.Trim()`)
        : t.depth === 1
          ? `ReadAll${cap(t.base)}(new Tok(${l}))`
          : `Read${cap(t.base)}${t.depth}(new Tok(${l}))`;
    return `        ${T(t)} ${p.name} = ${v};`;
  });
  const r = ret(sig);
  const f = (x: string) => (r.base === "bool" ? `(${x} ? "true" : "false")` : `${x}.ToString()`);
  const out = N.ret
    ? `Console.WriteLine(${N.ret.str("result")});`
    : r.depth === 0
      ? `Console.WriteLine(${r.base === "bool" ? f("result") : "result"});`
      : r.depth === 1
        ? `Console.WriteLine(string.Join(" ", result.Select(_v => ${f("_v")})));`
        : `Console.WriteLine(string.Join("\\n", result.Select(_row => string.Join(" ", _row.Select(_v => ${f("_v")})))));`;
  const def = N.ret ? N.ret.nil : r.depth ? `new ${B[r.base]}[0]${"[]".repeat(r.depth - 1)}` : { int: "0", long: "0", bool: "false", string: '""' }[r.base];
  return `using System;
using System.Collections.Generic;
using System.Linq;

${N.block ? `${N.block}\n\n` : ""}public class Program {
    static ${N.pt(sig.returns, T(r))} Solve(${sig.params.map((p) => `${N.pt(p.type, T(ty(p.type)))} ${p.name}`).join(", ")}) {
        // ${doc}
${body ? ind(body, 8) : `        return ${def};`}
    }

    class Tok {
        readonly string[] t;
        int i;
        public Tok(string s) { t = s.Split(new[] { ' ', '\\t' }, StringSplitOptions.RemoveEmptyEntries); }
        public string Next() => i < t.Length ? t[i++] : "0";
        public int Left => t.Length - i;
    }

    static string[] lines = new string[0];
    static string Line(int i) => i < lines.Length ? lines[i] : "";
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
    public static void Main() {
        lines = Console.In.ReadToEnd().Split('\\n').Select(_l => _l.TrimEnd('\\r')).ToArray();
${read.join("\n")}
        var result = Solve(${sig.params.map((p) => p.name).join(", ")});
        ${out}
    }
}
`;
};

// ---------------------------------------------------------------------- Go
const go: Gen = (sig, doc, body) => {
  const N = nodeParts("go", sig);
  const B = { int: "int", long: "int64", bool: "bool", string: "string" } as const;
  const T = (t: T) => "[]".repeat(t.depth) + B[t.base];
  const sc = (b: BaseType, x: string) => ({ int: `atoi(${x})`, long: `int64(atoi(${x}))`, bool: `${x} == "true"`, string: x })[b];
  const { all, nested } = needs(sig);
  const needAtoi = N.kinds.length > 0 || sig.params.some((p) => ty(p.type).depth >= 2 || ty(p.type).base === "int" || ty(p.type).base === "long");
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  if (needAtoi)
    helpers.push(`func atoi(s string) int {
\tv, _ := strconv.Atoi(strings.TrimSpace(s))
\treturn v
}`);
  if (nested.size)
    helpers.push(`type Tok struct {
\tt []string
\ti int
}

func (k *Tok) next() string {
\tif k.i < len(k.t) {
\t\tk.i++
\t\treturn k.t[k.i-1]
\t}
\treturn "0"
}`);
  for (const b of all)
    helpers.push(`func readAll${cap(b)}(s string) []${B[b]} {
\tf := strings.Fields(s)
\tres := make([]${B[b]}, len(f))
\tfor i, w := range f {
\t\tres[i] = ${sc(b, "w")}
\t}
\treturn res
}`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`func read${cap(b)}${k}(tk *Tok) ${T({ base: b, depth: k })} {
\tn := atoi(tk.next())
\tres := make(${T({ base: b, depth: k })}, n)
\tfor i := 0; i < n; i++ {
\t\tres[i] = ${k === 1 ? sc(b, "tk.next()") : `read${cap(b)}${k - 1}(tk)`}
\t}
\treturn res
}`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `\t${p.name} := ${nr}`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `strings.TrimSpace(${l})`)
        : t.depth === 1
          ? `readAll${cap(t.base)}(${l})`
          : `read${cap(t.base)}${t.depth}(&Tok{t: strings.Fields(${l})})`;
    return `\t${p.name} := ${v}`;
  });
  const r = ret(sig);
  const out = N.ret
    ? `\tfmt.Println(${N.ret.str("result")})`
    : r.depth === 0
      ? "\tfmt.Println(result)"
      : r.depth === 1
        ? `\tparts := make([]string, len(result))
\tfor i, v := range result {
\t\tparts[i] = fmt.Sprint(v)
\t}
\tfmt.Println(strings.Join(parts, " "))`
        : `\trows := make([]string, len(result))
\tfor r, row := range result {
\t\tparts := make([]string, len(row))
\t\tfor i, v := range row {
\t\t\tparts[i] = fmt.Sprint(v)
\t\t}
\t\trows[r] = strings.Join(parts, " ")
\t}
\tfmt.Println(strings.Join(rows, "\\n"))`;
  const def = N.ret ? N.ret.nil : r.depth ? `${T(r)}{}` : { int: "0", long: "0", bool: "false", string: '""' }[r.base];
  const imports = ["fmt", "io", "os", ...(needAtoi ? ["strconv"] : []), "strings"];
  return `package main

import (
${imports.map((i) => `\t"${i}"`).join("\n")}
)

${N.block ? `${N.block}\n\n` : ""}func solve(${sig.params.map((p) => `${p.name} ${N.pt(p.type, T(ty(p.type)))}`).join(", ")}) ${N.pt(sig.returns, T(r))} {
\t// ${doc}
${body ? body.split("\n").map((l) => (l ? `\t${l}` : l)).join("\n") : `\treturn ${def}`}
}
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
func main() {
\tdata, _ := io.ReadAll(os.Stdin)
\tlines := strings.Split(strings.ReplaceAll(string(data), "\\r", ""), "\\n")
\tline := func(i int) string {
\t\tif i < len(lines) {
\t\t\treturn lines[i]
\t\t}
\t\treturn ""
\t}
${read.join("\n")}
\tresult := solve(${sig.params.map((p) => p.name).join(", ")})
${out}
}
`;
};

// -------------------------------------------------------------------- Rust
const rust: Gen = (sig, doc, body) => {
  const N = nodeParts("rust", sig);
  const B = { int: "i32", long: "i64", bool: "bool", string: "String" } as const;
  const T = (t: T): string => (t.depth ? `Vec<${T({ ...t, depth: t.depth - 1 })}>` : B[t.base]);
  const sc = (b: BaseType, x: string) =>
    ({ int: `${x}.parse::<i32>().unwrap()`, long: `${x}.parse::<i64>().unwrap()`, bool: `(${x} == "true")`, string: `${x}.to_string()` })[b];
  const { nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`fn read_${b}_${k}(tk: &mut Tok) -> ${T({ base: b, depth: k })} {
    let n: usize = tk.take().parse().unwrap();
    (0..n).map(|_| ${k === 1 ? sc(b, "tk.take()") : `read_${b}_${k - 1}(tk)`}).collect()
}`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(&lines, ${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `    let ${p.name}: ${N.pt(p.type, "")} = ${nr};`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? `${l}.to_string()`
          : sc(t.base, `${l}.trim()`)
        : t.depth === 1
          ? `${l}.split_whitespace().map(|x| ${sc(t.base, "x")}).collect()`
          : `read_${t.base}_${t.depth}(&mut Tok::new(${l}))`;
    return `    let ${p.name}: ${T(t)} = ${v};`;
  });
  const r = ret(sig);
  const out = N.ret
    ? `    println!("{}", ${N.ret.str("result")});`
    : r.depth === 0
      ? '    println!("{}", result);'
      : r.depth === 1
        ? '    let parts: Vec<String> = result.iter().map(|v| v.to_string()).collect();\n    println!("{}", parts.join(" "));'
        : '    let rows: Vec<String> = result\n        .iter()\n        .map(|row| row.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(" "))\n        .collect();\n    println!("{}", rows.join("\\n"));';
  const def = N.ret ? N.ret.nil : r.depth ? "vec![]" : { int: "0", long: "0", bool: "false", string: "String::new()" }[r.base];
  const tokDef = nested.size
    ? `
struct Tok<'a> {
    it: std::str::SplitWhitespace<'a>,
}

impl<'a> Tok<'a> {
    fn new(s: &'a str) -> Self {
        Tok { it: s.split_whitespace() }
    }
    fn take(&mut self) -> &'a str {
        self.it.next().unwrap_or("0")
    }
}
`
    : "";
  return `#![allow(unused_imports, unused_variables, unused_mut, dead_code)]
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::{self, Read};
${N.kinds.length ? "use std::cell::RefCell;\nuse std::rc::Rc;\n" : ""}
${N.block ? `${N.block}\n\n` : ""}fn solve(${sig.params.map((p) => `${p.name}: ${N.pt(p.type, T(ty(p.type)))}`).join(", ")}) -> ${N.pt(sig.returns, T(r))} {
    // ${doc}
${body ? ind(body, 4) : `    ${def}`}
}

fn line<'a>(lines: &[&'a str], i: usize) -> &'a str {
    lines.get(i).copied().unwrap_or("")
}
${tokDef}${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let lines: Vec<&str> = input.split('\\n').map(|l| l.trim_end_matches('\\r')).collect();
${read.join("\n")}
    let result = solve(${sig.params.map((p) => p.name).join(", ")});
${out}
}
`;
};

// ------------------------------------------------------------------ Kotlin
const kotlin: Gen = (sig, doc, body) => {
  const N = nodeParts("kotlin", sig);
  const B = { int: "Int", long: "Long", bool: "Boolean", string: "String" } as const;
  const ARR = { int: "IntArray", long: "LongArray", bool: "BooleanArray", string: "Array<String>" } as const;
  const T = (t: T): string => (t.depth === 0 ? B[t.base] : t.depth === 1 ? ARR[t.base] : `Array<${T({ ...t, depth: t.depth - 1 })}>`);
  const sc = (b: BaseType, x: string) => ({ int: `${x}.toInt()`, long: `${x}.toLong()`, bool: `(${x} == "true")`, string: x })[b];
  const mk1 = (b: BaseType, n: string, x: string) => (b === "string" ? `Array(${n}) { ${x} }` : `${ARR[b]}(${n}) { ${sc(b, x)} }`);
  const { all, nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const b of all) helpers.push(`fun readAll${cap(b)}(tk: Tok): ${ARR[b]} = ${mk1(b, "tk.left()", "tk.next()")}`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`fun read${cap(b)}${k}(tk: Tok): ${T({ base: b, depth: k })} {
    val n = tk.next().toInt()
    return ${k === 1 ? mk1(b, "n", "tk.next()") : `Array(n) { read${cap(b)}${k - 1}(tk) }`}
}`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `    val ${p.name} = ${nr}`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `${l}.trim()`)
        : t.depth === 1
          ? `readAll${cap(t.base)}(Tok(${l}))`
          : `read${cap(t.base)}${t.depth}(Tok(${l}))`;
    return `    val ${p.name} = ${v}`;
  });
  const r = ret(sig);
  const out = N.ret
    ? `    println(${N.ret.str("result")})`
    : r.depth === 0
      ? "    println(result)"
      : r.depth === 1
        ? '    println(result.joinToString(" "))'
        : '    println(result.joinToString("\\n") { it.joinToString(" ") })';
  const def = N.ret
    ? N.ret.nil
    : r.depth === 0
      ? { int: "0", long: "0L", bool: "false", string: '""' }[r.base]
      : r.depth === 1
        ? { int: "intArrayOf()", long: "longArrayOf()", bool: "booleanArrayOf()", string: "arrayOf<String>()" }[r.base]
        : `arrayOf<${T({ ...r, depth: r.depth - 1 })}>()`;
  return `${N.block ? `${N.block}\n\n` : ""}fun solve(${sig.params.map((p) => `${p.name}: ${N.pt(p.type, T(ty(p.type)))}`).join(", ")}): ${N.pt(sig.returns, T(r))} {
    // ${doc}
${body ? ind(body, 4) : `    return ${def}`}
}

class Tok(s: String) {
    private val t = s.trim().split(Regex("\\\\s+")).filter { it.isNotEmpty() }
    private var i = 0
    fun next(): String = if (i < t.size) t[i++] else "0"
    fun left(): Int = t.size - i
}
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
fun main() {
    val lines = generateSequence(::readLine).map { it.trimEnd('\\r') }.toList()
    fun line(i: Int): String = lines.getOrElse(i) { "" }
${read.join("\n")}
    val result = solve(${sig.params.map((p) => p.name).join(", ")})
${out}
}
`;
};

// ------------------------------------------------------------------- Swift
const swift: Gen = (sig, doc, body) => {
  const N = nodeParts("swift", sig);
  const B = { int: "Int", long: "Int", bool: "Bool", string: "String" } as const;
  const T = (t: T) => "[".repeat(t.depth) + B[t.base] + "]".repeat(t.depth);
  const sc = (b: BaseType, x: string) => ({ int: `Int(${x})!`, long: `Int(${x})!`, bool: `(${x} == "true")`, string: x })[b];
  const { all, nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const b of all)
    helpers.push(`func readAll${cap(b)}(_ tk: Tok) -> [${B[b]}] {
    var res: [${B[b]}] = []
    while tk.left > 0 { res.append(${sc(b, "tk.next()")}) }
    return res
}`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`func read${cap(b)}${k}(_ tk: Tok) -> ${T({ base: b, depth: k })} {
    let n = Int(tk.next())!
    var res: ${T({ base: b, depth: k })} = []
    for _ in 0..<n { res.append(${k === 1 ? sc(b, "tk.next()") : `read${cap(b)}${k - 1}(tk)`}) }
    return res
}`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `let ${p.name}: ${N.pt(p.type, "")} = ${nr}`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `${l}.trimmingCharacters(in: .whitespaces)`)
        : t.depth === 1
          ? `readAll${cap(t.base)}(Tok(${l}))`
          : `read${cap(t.base)}${t.depth}(Tok(${l}))`;
    return `let ${p.name}: ${T(t)} = ${v}`;
  });
  const r = ret(sig);
  const out = N.ret
    ? `print(${N.ret.str("result")})`
    : r.depth === 0
      ? "print(result)"
      : r.depth === 1
        ? 'print(result.map { String($0) }.joined(separator: " "))'
        : 'print(result.map { row in row.map { String($0) }.joined(separator: " ") }.joined(separator: "\\n"))';
  const def = N.ret ? N.ret.nil : r.depth ? "[]" : { int: "0", long: "0", bool: "false", string: '""' }[r.base];
  return `import Foundation

${N.block ? `${N.block}\n\n` : ""}func solve(${sig.params.map((p) => `_ ${p.name}: ${N.pt(p.type, T(ty(p.type)))}`).join(", ")}) -> ${N.pt(sig.returns, T(r))} {
    // ${doc}
${body ? ind(body, 4) : `    return ${def}`}
}

final class Tok {
    let t: [String]
    var i = 0
    init(_ s: String) { t = s.split(whereSeparator: { $0 == " " || $0 == "\\t" }).map(String.init) }
    func next() -> String {
        if i < t.count { i += 1; return t[i - 1] }
        return "0"
    }
    var left: Int { t.count - i }
}
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
var lines: [String] = []
while let l = readLine() { lines.append(l) }
func line(_ i: Int) -> String { i < lines.count ? lines[i] : "" }

${read.join("\n")}
let result = solve(${sig.params.map((p) => p.name).join(", ")})
${out}
`;
};

// -------------------------------------------------------------------- Ruby
const ruby: Gen = (sig, doc, body) => {
  const N = nodeParts("ruby", sig);
  const sc = (b: BaseType, x: string) => ({ int: `${x}.to_i`, long: `${x}.to_i`, bool: `(${x} == "true")`, string: x })[b];
  const { nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`def read_${b}_${k}(tk)
  Array.new((tk.shift || "0").to_i) { ${k === 1 ? sc(b, '(tk.shift || "0")') : `read_${b}_${k - 1}(tk)`} }
end`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(lines, ${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `${p.name} = ${nr}`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `${l}.strip`)
        : t.depth === 1
          ? `${l}.split${t.base === "string" ? "" : `.map { |x| ${sc(t.base, "x")} }`}`
          : `read_${t.base}_${t.depth}(${l}.split)`;
    return `${p.name} = ${v}`;
  });
  const r = ret(sig);
  const f = (x: string) => (r.base === "bool" ? `(${x} ? "true" : "false")` : `${x}.to_s`);
  const out = N.ret
    ? `puts ${N.ret.str("result")}`
    : r.depth === 0
      ? `puts ${f("result")}`
      : r.depth === 1
        ? `puts result.map { |v| ${f("v")} }.join(" ")`
        : `puts result.map { |row| row.map { |v| ${f("v")} }.join(" ") }.join("\\n")`;
  const def = N.ret ? N.ret.nil : r.depth ? "[]" : { int: "0", long: "0", bool: "false", string: '""' }[r.base];
  return `${N.block ? `${N.block}\n\n` : ""}def solve(${sig.params.map((p) => p.name).join(", ")})
  # ${doc}
${body ? ind(body, 2) : `  ${def}`}
end

def line(lines, i)
  (lines[i] || "").chomp
end
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
lines = STDIN.read.split("\\n", -1)
${read.join("\n")}
result = solve(${sig.params.map((p) => p.name).join(", ")})
${out}
`;
};

// --------------------------------------------------------------------- PHP
const php: Gen = (sig, doc, body) => {
  const N = nodeParts("php", sig);
  const B = { int: "int", long: "int", bool: "bool", string: "string" } as const;
  const T = (t: T) => (t.depth ? "array" : B[t.base]);
  const sc = (b: BaseType, x: string) => ({ int: `intval(${x})`, long: `intval(${x})`, bool: `(${x} === "true")`, string: x })[b];
  const { nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`function read${cap(b)}${k}(array &$tk): array {
    $n = intval(array_shift($tk) ?? "0");
    $res = [];
    for ($i = 0; $i < $n; $i++) $res[] = ${k === 1 ? sc(b, '(array_shift($tk) ?? "0")') : `read${cap(b)}${k - 1}($tk)`};
    return $res;
}`);
  const read = sig.params.flatMap((p, i) => {
    const t = ty(p.type);
    const l = `line($lines, ${i})`;
    const nr = N.read(p.type, l);
    if (nr) return [`$${p.name} = ${nr};`];
    if (t.depth === 0) return [`$${p.name} = ${t.base === "string" ? l : sc(t.base, `trim(${l})`)};`];
    if (t.depth === 1)
      return [`$${p.name} = ${t.base === "string" ? `readWords(${l})` : `array_map(fn($x) => ${sc(t.base, "$x")}, readWords(${l}))`};`];
    return [`$tk${i} = readWords(${l});`, `$${p.name} = read${cap(t.base)}${t.depth}($tk${i});`];
  });
  const r = ret(sig);
  const f = (x: string) => (r.base === "bool" ? `(${x} ? "true" : "false")` : x);
  const out = N.ret
    ? `echo ${N.ret.str("$result")}, "\\n";`
    : r.depth === 0
      ? `echo ${f("$result")}, "\\n";`
      : r.depth === 1
        ? `echo implode(" ", array_map(fn($v) => ${f("$v")}, $result)), "\\n";`
        : `echo implode("\\n", array_map(fn($row) => implode(" ", array_map(fn($v) => ${f("$v")}, $row)), $result)), "\\n";`;
  const def = N.ret ? N.ret.nil : r.depth ? "[]" : { int: "0", long: "0", bool: "false", string: '""' }[r.base];
  return `<?php

${N.block ? `${N.block}\n\n` : ""}function solve(${sig.params.map((p) => `${N.pt(p.type, T(ty(p.type)))} $${p.name}`).join(", ")}): ${N.pt(sig.returns, T(r))} {
    // ${doc}
${body ? ind(body, 4) : `    return ${def};`}
}

function line(array $lines, int $i): string {
    return rtrim($lines[$i] ?? "", "\\r");
}

function readWords(string $s): array {
    return preg_split('/\\s+/', trim($s), -1, PREG_SPLIT_NO_EMPTY);
}
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
$lines = explode("\\n", stream_get_contents(STDIN));
${read.join("\n")}
$result = solve(${sig.params.map((p) => `$${p.name}`).join(", ")});
${out}
`;
};

// ------------------------------------------------------------------- Scala
const scala: Gen = (sig, doc, body) => {
  const N = nodeParts("scala", sig);
  const B = { int: "Int", long: "Long", bool: "Boolean", string: "String" } as const;
  const T = (t: T): string => (t.depth ? `Array[${T({ ...t, depth: t.depth - 1 })}]` : B[t.base]);
  const sc = (b: BaseType, x: string) => ({ int: `${x}.toInt`, long: `${x}.toLong`, bool: `(${x} == "true")`, string: x })[b];
  const { all, nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const b of all) helpers.push(`  def readAll${cap(b)}(tk: Tok): Array[${B[b]}] = Array.fill(tk.left)(${sc(b, "tk.next()")})`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`  def read${cap(b)}${k}(tk: Tok): ${T({ base: b, depth: k })} = {
    val n = tk.next().toInt
    Array.fill(n)(${k === 1 ? sc(b, "tk.next()") : `read${cap(b)}${k - 1}(tk)`})
  }`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `    val ${p.name} = ${nr}`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `${l}.trim`)
        : t.depth === 1
          ? `readAll${cap(t.base)}(new Tok(${l}))`
          : `read${cap(t.base)}${t.depth}(new Tok(${l}))`;
    return `    val ${p.name} = ${v}`;
  });
  const r = ret(sig);
  const out = N.ret
    ? `    println(${N.ret.str("result")})`
    : r.depth === 0
      ? "    println(result)"
      : r.depth === 1
        ? '    println(result.mkString(" "))'
        : '    println(result.map(_.mkString(" ")).mkString("\\n"))';
  const def = N.ret ? N.ret.nil : r.depth ? `Array.empty[${T({ ...r, depth: r.depth - 1 })}]` : { int: "0", long: "0L", bool: "false", string: '""' }[r.base];
  return `import scala.collection.mutable

${N.block ? `${N.block}\n\n` : ""}class Tok(s: String) {
  private val t = s.trim.split("\\\\s+").filter(_.nonEmpty)
  private var i = 0
  def next(): String = if (i < t.length) { i += 1; t(i - 1) } else "0"
  def left: Int = t.length - i
}

object Main {
  def solve(${sig.params.map((p) => `${p.name}: ${N.pt(p.type, T(ty(p.type)))}`).join(", ")}): ${N.pt(sig.returns, T(r))} = {
    // ${doc}
${body ? ind(body, 4) : `    ${def}`}
  }
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
  def main(args: Array[String]): Unit = {
    val lines = scala.io.Source.stdin.getLines().toArray
    def line(i: Int): String = if (i < lines.length) lines(i).stripSuffix("\\r") else ""
${read.join("\n")}
    val result = solve(${sig.params.map((p) => p.name).join(", ")})
${out}
  }
}
`;
};

// -------------------------------------------------------------------- Dart
const dart: Gen = (sig, doc, body) => {
  const N = nodeParts("dart", sig);
  const B = { int: "int", long: "int", bool: "bool", string: "String" } as const;
  const T = (t: T): string => (t.depth ? `List<${T({ ...t, depth: t.depth - 1 })}>` : B[t.base]);
  const sc = (b: BaseType, x: string) => ({ int: `int.parse(${x})`, long: `int.parse(${x})`, bool: `(${x} == 'true')`, string: x })[b];
  const { all, nested } = needs(sig);
  const helpers: string[] = [];
  if (N.helpers) helpers.push(N.helpers);
  for (const b of all) helpers.push(`List<${B[b]}> readAll${cap(b)}(Tok tk) => List.generate(tk.left, (_) => ${sc(b, "tk.next()")});`);
  for (const [b, d] of nested)
    for (let k = 1; k <= d; k++)
      helpers.push(`${T({ base: b, depth: k })} read${cap(b)}${k}(Tok tk) {
  final n = int.parse(tk.next());
  return List.generate(n, (_) => ${k === 1 ? sc(b, "tk.next()") : `read${cap(b)}${k - 1}(tk)`});
}`);
  const read = sig.params.map((p, i) => {
    const t = ty(p.type);
    const l = `line(${i})`;
    const nr = N.read(p.type, l);
    if (nr) return `  final ${p.name} = ${nr};`;
    const v =
      t.depth === 0
        ? t.base === "string"
          ? l
          : sc(t.base, `${l}.trim()`)
        : t.depth === 1
          ? `readAll${cap(t.base)}(Tok(${l}))`
          : `read${cap(t.base)}${t.depth}(Tok(${l}))`;
    return `  final ${T(t)} ${p.name} = ${v};`;
  });
  const r = ret(sig);
  const out = N.ret
    ? `  print(${N.ret.str("result")});`
    : r.depth === 0
      ? "  print(result);"
      : r.depth === 1
        ? "  print(result.join(' '));"
        : "  print(result.map((row) => row.join(' ')).join('\\n'));";
  const def = N.ret ? N.ret.nil : r.depth ? `<${T({ ...r, depth: r.depth - 1 })}>[]` : { int: "0", long: "0", bool: "false", string: "''" }[r.base];
  return `import 'dart:io';

${N.block ? `${N.block}\n\n` : ""}${N.pt(sig.returns, T(r))} solve(${sig.params.map((p) => `${N.pt(p.type, T(ty(p.type)))} ${p.name}`).join(", ")}) {
  // ${doc}
${body ? ind(body, 2) : `  return ${def};`}
}

class Tok {
  final List<String> t;
  int i = 0;
  Tok(String s) : t = s.trim().split(RegExp(r'\\s+')).where((w) => w.isNotEmpty).toList();
  String next() => i < t.length ? t[i++] : '0';
  int get left => t.length - i;
}
${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}
void main() {
  final lines = <String>[];
  while (true) {
    final l = stdin.readLineSync();
    if (l == null) break;
    lines.add(l);
  }
  String line(int i) => i < lines.length ? lines[i] : '';
${read.join("\n")}
  final result = solve(${sig.params.map((p) => p.name).join(", ")});
${out}
}
`;
};

// -------------------------------------------------------------------- Bash
const bash: Gen = (sig, doc, body) => {
  const r = ret(sig);
  const def = r.depth ? 'echo ""' : { int: "echo 0", long: "echo 0", bool: "echo false", string: 'echo ""' }[r.base];
  const locals = sig.params.map((p, i) => (ty(p.type).depth ? `  local ${p.name}=(\${${i + 1}})` : `  local ${p.name}="\${${i + 1}}"`));
  const desc = sig.params.map((p, i) => `$${i + 1} = ${p.name}${ty(p.type).depth ? " (space-separated)" : ""}`).join(", ");
  const outDesc =
    r.depth === 1 ? "the values, space-separated" : { int: "an integer", long: "an integer", bool: "true or false", string: "the string" }[r.base];
  return `#!/usr/bin/env bash

# ${doc}
# Arguments: ${desc}. Echo ${outDesc}.
solve() {
${locals.join("\n")}
${body ? ind(body, 2) : `  ${def}`}
}

lines=()
while IFS= read -r l || [[ -n "$l" ]]; do lines+=("\${l%$'\\r'}"); done
solve ${sig.params.map((_, i) => `"\${lines[${i}]}"`).join(" ")}
`;
};

const GENERATORS: Record<LanguageId, Gen> = {
  python,
  javascript: jsLike(false),
  typescript: jsLike(true),
  java,
  c,
  cpp,
  csharp,
  go,
  rust,
  kotlin,
  swift,
  ruby,
  php,
  scala,
  dart,
  bash,
};

/**
 * Starter code for one language. `body` replaces the default `return …` (used
 * by tests). For list/tree signatures, `mode` picks whether the node classes
 * are written out ("provided", how starters are stored) or left for the
 * person to write ("scratch").
 */
export function generateStarter(lang: LanguageId, sig: Signature, doc: string, body?: string, mode: NodeMode = "provided"): string {
  const code = GENERATORS[lang](sig, doc.replace(/\n/g, " "), body);
  return mode === "provided" ? code : (applyNodeMode(code, lang, sig, mode) ?? code);
}

/** Starters for every language (or the given ones) that can express this signature. */
export function generateStarters(sig: Signature, doc: string, langs?: LanguageId[]): Partial<Record<LanguageId, string>> {
  const out: Partial<Record<LanguageId, string>> = {};
  for (const l of langs ?? (Object.keys(GENERATORS) as LanguageId[])) {
    if (supportsSignature(l, sig)) out[l] = generateStarter(l, sig, doc);
  }
  return out;
}
