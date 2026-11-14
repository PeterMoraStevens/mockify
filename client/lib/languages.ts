// Shared between client and server. `pistonNames` are the Piston language
// names/aliases to look for in /api/v2/runtimes, in order of preference
// (the first name with an installed runtime wins, then the newest version).
//
// Matches these Piston packages: python node typescript java gcc dotnet go
// rust kotlin swift ruby php scala dart bash.

export const LANGUAGE_IDS = [
  "python",
  "javascript",
  "typescript",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "kotlin",
  "swift",
  "ruby",
  "php",
  "scala",
  "dart",
  "bash",
] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];

export type LanguageInfo = {
  id: LanguageId;
  label: string;
  short: string;
  pistonNames: string[];
  /** File name sent to Piston. */
  fileName: string;
};

export const LANGUAGES: Record<LanguageId, LanguageInfo> = {
  python: { id: "python", label: "Python 3", short: "PY", pistonNames: ["python", "python3", "py"], fileName: "main.py" },
  javascript: { id: "javascript", label: "JavaScript (Node)", short: "JS", pistonNames: ["javascript", "node", "node-js", "js"], fileName: "main.js" },
  typescript: { id: "typescript", label: "TypeScript", short: "TS", pistonNames: ["typescript", "ts"], fileName: "main.ts" },
  java: { id: "java", label: "Java", short: "JAVA", pistonNames: ["java"], fileName: "Main.java" },
  c: { id: "c", label: "C (GCC)", short: "C", pistonNames: ["c", "gcc"], fileName: "main.c" },
  cpp: { id: "cpp", label: "C++ (GCC)", short: "C++", pistonNames: ["c++", "cpp", "g++"], fileName: "main.cpp" },
  csharp: { id: "csharp", label: "C# (.NET)", short: "C#", pistonNames: ["csharp.net", "csharp", "c#", "cs"], fileName: "main.cs" },
  go: { id: "go", label: "Go", short: "GO", pistonNames: ["go", "golang"], fileName: "main.go" },
  rust: { id: "rust", label: "Rust", short: "RS", pistonNames: ["rust", "rs"], fileName: "main.rs" },
  kotlin: { id: "kotlin", label: "Kotlin", short: "KT", pistonNames: ["kotlin", "kt"], fileName: "main.kt" },
  swift: { id: "swift", label: "Swift", short: "SWIFT", pistonNames: ["swift"], fileName: "main.swift" },
  ruby: { id: "ruby", label: "Ruby", short: "RB", pistonNames: ["ruby", "rb"], fileName: "main.rb" },
  php: { id: "php", label: "PHP", short: "PHP", pistonNames: ["php"], fileName: "main.php" },
  scala: { id: "scala", label: "Scala", short: "SCALA", pistonNames: ["scala", "sc"], fileName: "main.scala" },
  dart: { id: "dart", label: "Dart", short: "DART", pistonNames: ["dart"], fileName: "main.dart" },
  bash: { id: "bash", label: "Bash", short: "SH", pistonNames: ["bash", "sh"], fileName: "main.sh" },
};

export function isLanguageId(v: unknown): v is LanguageId {
  return typeof v === "string" && (LANGUAGE_IDS as readonly string[]).includes(v);
}

const HELLO = "hello from mockify";

/** Free-form scratch pad used when no problem is selected. */
export const SCRATCH_STARTERS: Record<LanguageId, string> = {
  python: `# Scratch pad: anything printed to stdout shows up below.\nprint("${HELLO}")\n`,
  javascript: `// Scratch pad: anything printed to stdout shows up below.\nconsole.log("${HELLO}");\n`,
  typescript: `/// <reference lib="es2022" />\n// Scratch pad: anything printed to stdout shows up below.\nconst greeting: string = "${HELLO}";\nconsole.log(greeting);\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("${HELLO}");\n    }\n}\n`,
  c: `#include <stdio.h>\n\nint main(void) {\n    printf("${HELLO}\\n");\n    return 0;\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "${HELLO}" << endl;\n    return 0;\n}\n`,
  csharp: `using System;\n\npublic class Program {\n    public static void Main() {\n        Console.WriteLine("${HELLO}");\n    }\n}\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("${HELLO}")\n}\n`,
  rust: `fn main() {\n    println!("${HELLO}");\n}\n`,
  kotlin: `fun main() {\n    println("${HELLO}")\n}\n`,
  swift: `print("${HELLO}")\n`,
  ruby: `# Scratch pad: anything printed to stdout shows up below.\nputs "${HELLO}"\n`,
  php: `<?php\n\necho "${HELLO}\\n";\n`,
  scala: `object Main {\n  def main(args: Array[String]): Unit = {\n    println("${HELLO}")\n  }\n}\n`,
  dart: `void main() {\n  print('${HELLO}');\n}\n`,
  bash: `#!/usr/bin/env bash\n# Scratch pad: anything printed to stdout shows up below.\necho "${HELLO}"\n`,
};
