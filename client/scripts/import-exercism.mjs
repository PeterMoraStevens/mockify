#!/usr/bin/env node
// Converts an Exercism problem-specifications exercise (MIT) into a Mockify
// problem draft. The canonical tests are function calls; this turns each one
// into stdin/stdout by putting every input argument on its own line as JSON
// and expecting the JSON-encoded return value.
//
//   git clone https://github.com/exercism/problem-specifications
//   node scripts/import-exercism.mjs ../problem-specifications leap > leap.json
//
// The draft gets Python/JavaScript/TypeScript starters that parse the JSON
// lines and call solve(). You still need to:
//   - write a real `reference` solution (uploads are rejected until it passes)
//   - pick a difficulty and tags, and add interviewer hints
// Cases that expect an error are skipped.

import fs from "node:fs";
import path from "node:path";

const [, , specsDir, slug] = process.argv;
if (!specsDir || !slug) {
  console.error("usage: import-exercism.mjs <problem-specifications dir> <exercise slug>");
  process.exit(1);
}

const exDir = path.join(specsDir, "exercises", slug);
const canonical = JSON.parse(fs.readFileSync(path.join(exDir, "canonical-data.json"), "utf8"));
const description = fs.existsSync(path.join(exDir, "description.md"))
  ? fs.readFileSync(path.join(exDir, "description.md"), "utf8")
  : "";
const metadata = fs.existsSync(path.join(exDir, "metadata.toml"))
  ? fs.readFileSync(path.join(exDir, "metadata.toml"), "utf8")
  : "";
const title = metadata.match(/^title\s*=\s*"(.*)"/m)?.[1] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Flatten nested case groups and drop cases that a newer case reimplements.
const flat = [];
(function walk(cases) {
  for (const c of cases) {
    if (c.cases) walk(c.cases);
    else flat.push(c);
  }
})(canonical.cases);
const replaced = new Set(flat.map((c) => c.reimplements).filter(Boolean));
let cases = flat.filter((c) => !replaced.has(c.uuid));

// Keep the most common property (some exercises test several functions).
const counts = {};
for (const c of cases) counts[c.property] = (counts[c.property] ?? 0) + 1;
const property = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
cases = cases.filter((c) => c.property === property);

const isError = (e) => e && typeof e === "object" && !Array.isArray(e) && "error" in e;
const skipped = cases.filter((c) => isError(c.expected)).length;
cases = cases.filter((c) => !isError(c.expected));
if (cases.length === 0) {
  console.error(`No usable cases for ${slug}`);
  process.exit(1);
}

const argNames = Object.keys(cases[0].input);
const toCase = (c) => ({
  input: argNames.map((k) => JSON.stringify(c.input[k])).join("\n") + "\n",
  output: JSON.stringify(c.expected) + "\n",
  explanation: c.description,
});

const pyArgs = argNames.join(", ");
const starters = {
  python: `import json
import sys


def solve(${pyArgs}):
    # TODO
    return None


def main() -> None:
    args = [json.loads(line) for line in sys.stdin.read().splitlines() if line.strip()]
    print(json.dumps(solve(*args), separators=(",", ":")))


if __name__ == "__main__":
    main()
`,
  javascript: `function solve(${argNames.join(", ")}) {
  // TODO
  return null;
}

function main() {
  const args = require("fs").readFileSync(0, "utf8").split("\\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  console.log(JSON.stringify(solve(...args)));
}

main();
`,
  typescript: `declare const require: any;

function solve(${argNames.map((a) => `${a}: any`).join(", ")}): any {
  // TODO
  return null;
}

function main(): void {
  const lines: string[] = require("fs").readFileSync(0, "utf8").split("\\n");
  const args = lines.filter((l) => l.trim()).map((l) => JSON.parse(l));
  console.log(JSON.stringify((solve as any)(...args)));
}

main();
`,
};

const all = cases.map(toCase);
const problem = {
  slug,
  title,
  difficulty: "easy",
  tags: [],
  license: "MIT",
  source: {
    name: "Exercism problem-specifications",
    url: `https://github.com/exercism/problem-specifications/tree/main/exercises/${slug}`,
  },
  description:
    description.trim() +
    `\n\n### Input\nEach argument (${argNames.map((a) => `\`${a}\``).join(", ")}) on its own line, JSON-encoded.\n\n### Output\nThe JSON-encoded result of \`${property}\`.`,
  examples: all.slice(0, Math.min(2, all.length)),
  tests: all.slice(2),
  starters,
  interviewer: { hints: [], followUps: [] },
  reference: { language: "python", code: "# TODO: a reference solution that prints the expected output\n" },
};

process.stdout.write(JSON.stringify(problem, null, 2) + "\n");
console.error(`${slug}: ${all.length} cases (${skipped} error cases skipped), property "${property}", args [${argNames.join(", ")}]`);
