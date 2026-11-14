// Generates starter code for every language from one function signature.
// Used by the problem builder (in the browser) and by the seed-problem script.
// Self-contained on purpose: only type imports, no path aliases.
//
// I/O convention (same for every problem made this way):
//   stdin  – one line per parameter, in order
//            int       -> "42"
//            int[]     -> "1 2 3"          (space-separated, at least one value)
//            string    -> the whole line   (spaces allowed)
//            string[]  -> "ab cd ef"       (space-separated words)
//   stdout – the return value on one line
//            int -> "42"   bool -> "true"/"false"   int[] -> "1 2 3"   string -> as-is

import type { LanguageId } from "../languages";

export const PARAM_TYPES = ["int", "int[]", "string", "string[]"] as const;
export const RETURN_TYPES = ["int", "bool", "int[]", "string"] as const;
export type ParamType = (typeof PARAM_TYPES)[number];
export type ReturnType = (typeof RETURN_TYPES)[number];
export type Param = { name: string; type: ParamType };
export type Signature = { params: Param[]; returns: ReturnType };

export const TYPE_LABELS: Record<ParamType | ReturnType, string> = {
  int: "integer",
  bool: "boolean",
  "int[]": "integer array",
  string: "string",
  "string[]": "list of words",
};

const PARAM_NAME_RE = /^[a-z][a-zA-Z0-9]{0,23}$/;
const RESERVED = new Set([
  "in", "is", "as", "do", "if", "fn", "of", "or", "and", "not", "for", "int", "new", "var", "val", "let", "def",
  "end", "fun", "use", "len", "str", "map", "set", "list", "line", "lines", "main", "solve", "result", "type",
  "data", "string", "class", "readwords", "readints", "parseints", "atoi", "object", "return", "input", "print", "func", "match", "case", "when", "where", "import",
]);

export function validateSignature(sig: Signature): string | null {
  if (sig.params.length === 0) return "Add at least one parameter.";
  if (sig.params.length > 6) return "At most 6 parameters.";
  const seen = new Set<string>();
  for (const p of sig.params) {
    if (!PARAM_NAME_RE.test(p.name)) return `"${p.name}" isn't a valid name. Use camelCase letters and digits, starting lowercase.`;
    if (RESERVED.has(p.name.toLowerCase())) return `"${p.name}" is reserved in some languages. Pick another name.`;
    if (seen.has(p.name)) return `Duplicate parameter "${p.name}".`;
    seen.add(p.name);
  }
  return null;
}

/** Markdown appended to the problem description. */
export function ioSection(sig: Signature): string {
  const lines = sig.params.map((p, i) => {
    const fmt =
      p.type === "int"
        ? "an integer"
        : p.type === "int[]"
          ? "space-separated integers"
          : p.type === "string"
            ? "a string (the whole line)"
            : "space-separated words";
    return `- Line ${i + 1}: \`${p.name}\`, ${fmt}.`;
  });
  const out =
    sig.returns === "int"
      ? "One integer."
      : sig.returns === "bool"
        ? "`true` or `false`."
        : sig.returns === "int[]"
          ? "The integers on one line, separated by spaces."
          : "The string on one line.";
  return `### Input\n${lines.join("\n")}\n\n### Output\n${out}`;
}

/** Turns per-parameter values typed in the builder into the stdin text. */
export function buildStdin(values: string[]): string {
  return values.map((v) => v.replace(/\r?\n/g, " ")).join("\n") + "\n";
}

// ---------------------------------------------------------------------------

type Gen = (sig: Signature, doc: string, body?: string) => string;

const ind = (s: string, n: number) =>
  s
    .split("\n")
    .map((l) => (l ? " ".repeat(n) + l : l))
    .join("\n");

const has = (sig: Signature, t: ParamType) => sig.params.some((p) => p.type === t);
const usesIntParsing = (sig: Signature) => has(sig, "int") || has(sig, "int[]");

// ------------------------------------------------------------------ Python
const python: Gen = (sig, doc, body) => {
  const t = { int: "int", "int[]": "List[int]", string: "str", "string[]": "List[str]", bool: "bool" } as const;
  const def = { int: "0", bool: "False", "int[]": "[]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const l = `lines[${i}] if len(lines) > ${i} else ""`;
    const v =
      p.type === "int"
        ? `int((${l}).strip())`
        : p.type === "int[]"
          ? `list(map(int, (${l}).split()))`
          : p.type === "string"
            ? `(${l}).rstrip("\\r")`
            : `(${l}).split()`;
    return `    ${p.name} = ${v}`;
  });
  const out = {
    int: "print(result)",
    bool: 'print("true" if result else "false")',
    "int[]": 'print(" ".join(map(str, result)))',
    string: "print(result)",
  }[sig.returns];
  return `import sys
from typing import List


def solve(${sig.params.map((p) => `${p.name}: ${t[p.type]}`).join(", ")}) -> ${t[sig.returns]}:
    # ${doc}
${body ? ind(body, 4) : `    return ${def}`}


def main() -> None:
    lines = sys.stdin.read().split("\\n")
${read.join("\n")}
    result = solve(${sig.params.map((p) => p.name).join(", ")})
    ${out}


if __name__ == "__main__":
    main()
`;
};

// -------------------------------------------------------------- JS and TS
const jsLike = (ts: boolean): Gen => (sig, doc, body) => {
  const t = { int: "number", "int[]": "number[]", string: "string", "string[]": "string[]", bool: "boolean" } as const;
  const def = { int: "0", bool: "false", "int[]": "[]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const l = `line(${i})`;
    const v =
      p.type === "int"
        ? `Number(${l}.trim())`
        : p.type === "int[]"
          ? `${l}.trim().split(/\\s+/).filter(Boolean).map(Number)`
          : p.type === "string"
            ? l
            : `${l}.trim().split(/\\s+/).filter(Boolean)`;
    return `  const ${p.name} = ${v};`;
  });
  const out = {
    int: "console.log(String(result));",
    bool: 'console.log(result ? "true" : "false");',
    "int[]": 'console.log(result.join(" "));',
    string: "console.log(result);",
  }[sig.returns];
  const params = sig.params.map((p) => (ts ? `${p.name}: ${t[p.type]}` : p.name)).join(", ");
  return `${ts ? '/// <reference lib="es2022" />\ndeclare const require: any;\n\n' : ""}function solve(${params})${ts ? `: ${t[sig.returns]}` : ""} {
  // ${doc}
${body ? ind(body, 2) : `  return ${def};`}
}

function main()${ts ? ": void" : ""} {
  const lines${ts ? ": string[]" : ""} = require("fs").readFileSync(0, "utf8").split("\\n");
  const line = (i${ts ? ": number" : ""})${ts ? ": string" : ""} => (lines[i] ?? "").replace(/\\r$/, "");
${read.join("\n")}
  const result = solve(${sig.params.map((p) => p.name).join(", ")});
  ${out}
}

main();
`;
};

// -------------------------------------------------------------------- Java
const java: Gen = (sig, doc, body) => {
  const t = { int: "int", "int[]": "int[]", string: "String", "string[]": "String[]", bool: "boolean" } as const;
  const def = { int: "0", bool: "false", "int[]": "new int[0]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `Integer.parseInt(line(lines, ${i}).trim())`
        : p.type === "int[]"
          ? `Arrays.stream(readWords(line(lines, ${i}))).mapToInt(Integer::parseInt).toArray()`
          : p.type === "string"
            ? `line(lines, ${i})`
            : `readWords(line(lines, ${i}))`;
    return `        ${t[p.type]} ${p.name} = ${v};`;
  });
  const out = {
    int: "System.out.println(result);",
    bool: 'System.out.println(result ? "true" : "false");',
    "int[]": `StringBuilder sb = new StringBuilder();
        for (int i = 0; i < result.length; i++) sb.append(i > 0 ? " " : "").append(result[i]);
        System.out.println(sb);`,
    string: "System.out.println(result);",
  }[sig.returns];
  return `import java.io.*;
import java.util.*;

public class Main {
    static ${t[sig.returns]} solve(${sig.params.map((p) => `${t[p.type]} ${p.name}`).join(", ")}) {
        // ${doc}
${body ? ind(body, 8) : `        return ${def};`}
    }

    static String line(List<String> lines, int i) {
        return i < lines.size() ? lines.get(i) : "";
    }

    static String[] readWords(String s) {
        String t = s.trim();
        return t.isEmpty() ? new String[0] : t.split("\\\\s+");
    }

    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        List<String> lines = new ArrayList<>();
        for (String l; (l = br.readLine()) != null; ) lines.add(l);
${read.join("\n")}
        ${t[sig.returns]} result = solve(${sig.params.map((p) => p.name).join(", ")});
        ${out}
    }
}
`;
};

// ----------------------------------------------------------------------- C
const c: Gen = (sig, doc, body) => {
  const args: string[] = [];
  for (const p of sig.params) {
    if (p.type === "int") args.push(`int ${p.name}`);
    else if (p.type === "string") args.push(`char* ${p.name}`);
    else if (p.type === "int[]") args.push(`int* ${p.name}`, `int ${p.name}Size`);
    else args.push(`char** ${p.name}`, `int ${p.name}Size`);
  }
  if (sig.returns === "int[]") args.push("int* returnSize");
  const ret = { int: "int", bool: "bool", "int[]": "int*", string: "char*" }[sig.returns];
  const def = {
    int: "    return 0;",
    bool: "    return false;",
    "int[]": "    *returnSize = 0;\n    return NULL;",
    string: '    return "";',
  }[sig.returns];
  const read: string[] = [];
  const call: string[] = [];
  sig.params.forEach((p, i) => {
    if (p.type === "int") {
      read.push(`    int ${p.name} = (int)strtol(line(${i}), NULL, 10);`);
      call.push(p.name);
    } else if (p.type === "string") {
      read.push(`    char* ${p.name} = line(${i});`);
      call.push(p.name);
    } else if (p.type === "int[]") {
      read.push(`    int ${p.name}Size = 0;`, `    int* ${p.name} = parse_ints(line(${i}), &${p.name}Size);`);
      call.push(p.name, `${p.name}Size`);
    } else {
      read.push(`    int ${p.name}Size = 0;`, `    char** ${p.name} = parse_words(line(${i}), &${p.name}Size);`);
      call.push(p.name, `${p.name}Size`);
    }
  });
  if (sig.returns === "int[]") {
    read.push("    int returnSize = 0;");
    call.push("&returnSize");
  }
  const out = {
    int: '    printf("%d\\n", result);',
    bool: '    printf("%s\\n", result ? "true" : "false");',
    "int[]": '    for (int i = 0; i < returnSize; i++) printf(i ? " %d" : "%d", result[i]);\n    printf("\\n");',
    string: '    printf("%s\\n", result ? result : "");',
  }[sig.returns];
  const helpers = [
    `static char* read_all(void) {
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
}`,
    `static char** g_lines;
static int g_count;

static char* line(int i) {
    return i < g_count ? g_lines[i] : "";
}`,
  ];
  if (has(sig, "int[]"))
    helpers.push(`static int* parse_ints(const char* s, int* n) {
    int cap = 16;
    int* out = malloc(cap * sizeof(int));
    char* end;
    *n = 0;
    for (;;) {
        long v = strtol(s, &end, 10);
        if (end == s) break;
        if (*n == cap) out = realloc(out, (cap *= 2) * sizeof(int));
        out[(*n)++] = (int)v;
        s = end;
    }
    return out;
}`);
  if (has(sig, "string[]"))
    helpers.push(`static char** parse_words(char* s, int* n) {
    int cap = 16;
    char** out = malloc(cap * sizeof(char*));
    *n = 0;
    for (char* w = strtok(s, " \\t"); w; w = strtok(NULL, " \\t")) {
        if (*n == cap) out = realloc(out, (cap *= 2) * sizeof(char*));
        out[(*n)++] = w;
    }
    return out;
}`);
  return `#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${ret} solve(${args.join(", ")}) {
    // ${doc}
${body ? ind(body, 4) : def}
}

${helpers.join("\n\n")}

int main(void) {
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
    ${ret} result = solve(${call.join(", ")});
${out}
    return 0;
}
`;
};

// --------------------------------------------------------------------- C++
const cpp: Gen = (sig, doc, body) => {
  const t = { int: "int", "int[]": "vector<int>", string: "string", "string[]": "vector<string>", bool: "bool" } as const;
  const arg = (p: Param) => (p.type === "int[]" || p.type === "string[]" ? `${t[p.type]}& ${p.name}` : `${t[p.type]} ${p.name}`);
  const def = { int: "0", bool: "false", "int[]": "{}", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `stoi(line(${i}))`
        : p.type === "int[]"
          ? `readInts(line(${i}))`
          : p.type === "string"
            ? `line(${i})`
            : `readWords(line(${i}))`;
    return `    ${t[p.type]} ${p.name} = ${v};`;
  });
  const out = {
    int: "    cout << result << \"\\n\";",
    bool: '    cout << (result ? "true" : "false") << "\\n";',
    "int[]": '    for (size_t i = 0; i < result.size(); i++) cout << (i ? " " : "") << result[i];\n    cout << "\\n";',
    string: '    cout << result << "\\n";',
  }[sig.returns];
  return `#include <algorithm>
#include <climits>
#include <iostream>
#include <map>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

${t[sig.returns]} solve(${sig.params.map(arg).join(", ")}) {
    // ${doc}
${body ? ind(body, 4) : `    return ${def};`}
}

static vector<string> g_lines;
static string line(size_t i) { return i < g_lines.size() ? g_lines[i] : string(); }
static vector<int> readInts(const string& s) {
    vector<int> v;
    istringstream is(s);
    for (int x; is >> x;) v.push_back(x);
    return v;
}
static vector<string> readWords(const string& s) {
    vector<string> v;
    istringstream is(s);
    for (string w; is >> w;) v.push_back(w);
    return v;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    for (string l; getline(cin, l);) {
        if (!l.empty() && l.back() == '\\r') l.pop_back();
        g_lines.push_back(l);
    }
${read.join("\n")}
    ${t[sig.returns]} result = solve(${sig.params.map((p) => p.name).join(", ")});
${out}
    return 0;
}
`;
};

// ---------------------------------------------------------------------- C#
const csharp: Gen = (sig, doc, body) => {
  const t = { int: "int", "int[]": "int[]", string: "string", "string[]": "string[]", bool: "bool" } as const;
  const def = { int: "0", bool: "false", "int[]": "new int[0]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `int.Parse(Line(${i}).Trim())`
        : p.type === "int[]"
          ? `Words(Line(${i})).Select(int.Parse).ToArray()`
          : p.type === "string"
            ? `Line(${i})`
            : `Words(Line(${i}))`;
    return `        ${t[p.type]} ${p.name} = ${v};`;
  });
  const out = {
    int: "Console.WriteLine(result);",
    bool: 'Console.WriteLine(result ? "true" : "false");',
    "int[]": 'Console.WriteLine(string.Join(" ", result));',
    string: "Console.WriteLine(result);",
  }[sig.returns];
  return `using System;
using System.Collections.Generic;
using System.Linq;

public class Program {
    static ${t[sig.returns]} Solve(${sig.params.map((p) => `${t[p.type]} ${p.name}`).join(", ")}) {
        // ${doc}
${body ? ind(body, 8) : `        return ${def};`}
    }

    static string[] lines = new string[0];
    static string Line(int i) => i < lines.Length ? lines[i] : "";
    static string[] Words(string s) => s.Split(new[] { ' ', '\\t' }, StringSplitOptions.RemoveEmptyEntries);

    public static void Main() {
        lines = Console.In.ReadToEnd().Split('\\n').Select(l => l.TrimEnd('\\r')).ToArray();
${read.join("\n")}
        var result = Solve(${sig.params.map((p) => p.name).join(", ")});
        ${out}
    }
}
`;
};

// ---------------------------------------------------------------------- Go
const go: Gen = (sig, doc, body) => {
  const t = { int: "int", "int[]": "[]int", string: "string", "string[]": "[]string", bool: "bool" } as const;
  const def = { int: "0", bool: "false", "int[]": "[]int{}", string: '""' }[sig.returns];
  const needStrconv = usesIntParsing(sig) || sig.returns === "int[]";
  const imports = ["fmt", "io", "os", ...(needStrconv ? ["strconv"] : []), "strings"];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `atoi(strings.TrimSpace(line(${i})))`
        : p.type === "int[]"
          ? `parseInts(line(${i}))`
          : p.type === "string"
            ? `line(${i})`
            : `strings.Fields(line(${i}))`;
    return `\t${p.name} := ${v}`;
  });
  const out = {
    int: "\tfmt.Println(result)",
    bool: "\tfmt.Println(result)",
    "int[]": `\tparts := make([]string, len(result))
\tfor i, v := range result {
\t\tparts[i] = strconv.Itoa(v)
\t}
\tfmt.Println(strings.Join(parts, " "))`,
    string: "\tfmt.Println(result)",
  }[sig.returns];
  const helpers: string[] = [];
  if (usesIntParsing(sig))
    helpers.push(`func atoi(s string) int {
\tv, _ := strconv.Atoi(s)
\treturn v
}`);
  if (has(sig, "int[]"))
    helpers.push(`func parseInts(s string) []int {
\tf := strings.Fields(s)
\tout := make([]int, len(f))
\tfor i, w := range f {
\t\tout[i] = atoi(w)
\t}
\treturn out
}`);
  return `package main

import (
${imports.map((i) => `\t"${i}"`).join("\n")}
)

func solve(${sig.params.map((p) => `${p.name} ${t[p.type]}`).join(", ")}) ${t[sig.returns]} {
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
  const t = { int: "i32", "int[]": "Vec<i32>", string: "String", "string[]": "Vec<String>", bool: "bool" } as const;
  const def = { int: "0", bool: "false", "int[]": "vec![]", string: "String::new()" }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `line(&lines, ${i}).trim().parse().unwrap()`
        : p.type === "int[]"
          ? `line(&lines, ${i}).split_whitespace().map(|x| x.parse().unwrap()).collect()`
          : p.type === "string"
            ? `line(&lines, ${i}).to_string()`
            : `line(&lines, ${i}).split_whitespace().map(String::from).collect()`;
    return `    let ${p.name}: ${t[p.type]} = ${v};`;
  });
  const out = {
    int: '    println!("{}", result);',
    bool: '    println!("{}", result);',
    "int[]": '    let parts: Vec<String> = result.iter().map(|v| v.to_string()).collect();\n    println!("{}", parts.join(" "));',
    string: '    println!("{}", result);',
  }[sig.returns];
  return `#![allow(unused_imports, unused_variables, unused_mut, dead_code)]
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::{self, Read};

fn solve(${sig.params.map((p) => `${p.name}: ${t[p.type]}`).join(", ")}) -> ${t[sig.returns]} {
    // ${doc}
${body ? ind(body, 4) : `    ${def}`}
}

fn line<'a>(lines: &[&'a str], i: usize) -> &'a str {
    lines.get(i).copied().unwrap_or("")
}

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
  const t = { int: "Int", "int[]": "IntArray", string: "String", "string[]": "Array<String>", bool: "Boolean" } as const;
  const def = { int: "0", bool: "false", "int[]": "intArrayOf()", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `line(${i}).trim().toInt()`
        : p.type === "int[]"
          ? `readWords(line(${i})).map { it.toInt() }.toIntArray()`
          : p.type === "string"
            ? `line(${i})`
            : `readWords(line(${i})).toTypedArray()`;
    return `    val ${p.name} = ${v}`;
  });
  const out = {
    int: "    println(result)",
    bool: "    println(result)",
    "int[]": '    println(result.joinToString(" "))',
    string: "    println(result)",
  }[sig.returns];
  return `fun solve(${sig.params.map((p) => `${p.name}: ${t[p.type]}`).join(", ")}): ${t[sig.returns]} {
    // ${doc}
${body ? ind(body, 4) : `    return ${def}`}
}

fun readWords(s: String): List<String> = s.trim().split(Regex("\\\\s+")).filter { it.isNotEmpty() }

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
  const t = { int: "Int", "int[]": "[Int]", string: "String", "string[]": "[String]", bool: "Bool" } as const;
  const def = { int: "0", bool: "false", "int[]": "[]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `Int(line(${i}).trimmingCharacters(in: .whitespaces)) ?? 0`
        : p.type === "int[]"
          ? `line(${i}).split(whereSeparator: { $0 == " " || $0 == "\\t" }).compactMap { Int($0) }`
          : p.type === "string"
            ? `line(${i})`
            : `line(${i}).split(whereSeparator: { $0 == " " || $0 == "\\t" }).map(String.init)`;
    return `let ${p.name} = ${v}`;
  });
  const out = {
    int: "print(result)",
    bool: "print(result)",
    "int[]": 'print(result.map(String.init).joined(separator: " "))',
    string: "print(result)",
  }[sig.returns];
  return `import Foundation

func solve(${sig.params.map((p) => `_ ${p.name}: ${t[p.type]}`).join(", ")}) -> ${t[sig.returns]} {
    // ${doc}
${body ? ind(body, 4) : `    return ${def}`}
}

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
  const def = { int: "0", bool: "false", "int[]": "[]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `line(lines, ${i}).to_i`
        : p.type === "int[]"
          ? `line(lines, ${i}).split.map(&:to_i)`
          : p.type === "string"
            ? `line(lines, ${i})`
            : `line(lines, ${i}).split`;
    return `${p.name} = ${v}`;
  });
  const out = {
    int: "puts result",
    bool: 'puts(result ? "true" : "false")',
    "int[]": 'puts result.join(" ")',
    string: "puts result",
  }[sig.returns];
  return `def solve(${sig.params.map((p) => p.name).join(", ")})
  # ${doc}
${body ? ind(body, 2) : `  ${def}`}
end

def line(lines, i)
  (lines[i] || "").chomp
end

lines = STDIN.read.split("\\n", -1)
${read.join("\n")}
result = solve(${sig.params.map((p) => p.name).join(", ")})
${out}
`;
};

// --------------------------------------------------------------------- PHP
const php: Gen = (sig, doc, body) => {
  const t = { int: "int", "int[]": "array", string: "string", "string[]": "array", bool: "bool" } as const;
  const def = { int: "0", bool: "false", "int[]": "[]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `intval(trim(line($lines, ${i})))`
        : p.type === "int[]"
          ? `array_map('intval', readWords(line($lines, ${i})))`
          : p.type === "string"
            ? `line($lines, ${i})`
            : `readWords(line($lines, ${i}))`;
    return `$${p.name} = ${v};`;
  });
  const out = {
    int: 'echo $result, "\\n";',
    bool: 'echo $result ? "true" : "false", "\\n";',
    "int[]": 'echo implode(" ", $result), "\\n";',
    string: 'echo $result, "\\n";',
  }[sig.returns];
  return `<?php

function solve(${sig.params.map((p) => `${t[p.type]} $${p.name}`).join(", ")}): ${t[sig.returns]} {
    // ${doc}
${body ? ind(body, 4) : `    return ${def};`}
}

function line(array $lines, int $i): string {
    return rtrim($lines[$i] ?? "", "\\r");
}

function readWords(string $s): array {
    return preg_split('/\\s+/', trim($s), -1, PREG_SPLIT_NO_EMPTY);
}

$lines = explode("\\n", stream_get_contents(STDIN));
${read.join("\n")}
$result = solve(${sig.params.map((p) => `$${p.name}`).join(", ")});
${out}
`;
};

// ------------------------------------------------------------------- Scala
const scala: Gen = (sig, doc, body) => {
  const t = { int: "Int", "int[]": "Array[Int]", string: "String", "string[]": "Array[String]", bool: "Boolean" } as const;
  const def = { int: "0", bool: "false", "int[]": "Array.empty[Int]", string: '""' }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `line(${i}).trim.toInt`
        : p.type === "int[]"
          ? `readWords(line(${i})).map(_.toInt)`
          : p.type === "string"
            ? `line(${i})`
            : `readWords(line(${i}))`;
    return `    val ${p.name} = ${v}`;
  });
  const out = {
    int: "    println(result)",
    bool: "    println(result)",
    "int[]": '    println(result.mkString(" "))',
    string: "    println(result)",
  }[sig.returns];
  return `import scala.collection.mutable

object Main {
  def solve(${sig.params.map((p) => `${p.name}: ${t[p.type]}`).join(", ")}): ${t[sig.returns]} = {
    // ${doc}
${body ? ind(body, 4) : `    ${def}`}
  }

  def readWords(s: String): Array[String] = s.trim.split("\\\\s+").filter(_.nonEmpty)

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
  const t = { int: "int", "int[]": "List<int>", string: "String", "string[]": "List<String>", bool: "bool" } as const;
  const def = { int: "0", bool: "false", "int[]": "[]", string: "''" }[sig.returns];
  const read = sig.params.map((p, i) => {
    const v =
      p.type === "int"
        ? `int.parse(line(${i}).trim())`
        : p.type === "int[]"
          ? `readWords(line(${i})).map(int.parse).toList()`
          : p.type === "string"
            ? `line(${i})`
            : `readWords(line(${i}))`;
    return `  final ${p.name} = ${v};`;
  });
  const out = {
    int: "  print(result);",
    bool: "  print(result);",
    "int[]": "  print(result.join(' '));",
    string: "  print(result);",
  }[sig.returns];
  return `import 'dart:io';

${t[sig.returns]} solve(${sig.params.map((p) => `${t[p.type]} ${p.name}`).join(", ")}) {
  // ${doc}
${body ? ind(body, 2) : `  return ${def};`}
}

List<String> readWords(String s) => s.trim().split(RegExp(r'\\s+')).where((w) => w.isNotEmpty).toList();

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
  const def = { int: "echo 0", bool: "echo false", "int[]": 'echo ""', string: 'echo ""' }[sig.returns];
  const locals = sig.params.map((p, i) =>
    p.type === "int[]" || p.type === "string[]" ? `  local ${p.name}=(\${${i + 1}})` : `  local ${p.name}="\${${i + 1}}"`,
  );
  const desc = sig.params
    .map((p, i) => `$${i + 1} = ${p.name}${p.type === "int[]" || p.type === "string[]" ? " (space-separated)" : ""}`)
    .join(", ");
  const outDesc = { int: "an integer", bool: "true or false", "int[]": "space-separated integers", string: "the string" }[
    sig.returns
  ];
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

/** Starter code for one language. `body` replaces the default `return …` (used by tests). */
export function generateStarter(lang: LanguageId, sig: Signature, doc: string, body?: string): string {
  return GENERATORS[lang](sig, doc.replace(/\n/g, " "), body);
}

export function generateStarters(sig: Signature, doc: string, langs?: LanguageId[]): Partial<Record<LanguageId, string>> {
  const out: Partial<Record<LanguageId, string>> = {};
  for (const l of langs ?? (Object.keys(GENERATORS) as LanguageId[])) out[l] = generateStarter(l, sig, doc);
  return out;
}
