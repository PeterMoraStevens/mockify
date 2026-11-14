import "server-only";
import type { LanguageId } from "@/lib/languages";
import type { Problem, TestCase } from "@/lib/problems/schema";
import type { RunResponse, TestResult } from "@/lib/run-types";
import { executeBatch, outputsMatch } from "./piston";

type Labeled = TestCase & { kind: "example" | "hidden" };

/**
 * Runs `code` against the given cases and grades the output. Hidden cases are
 * reduced to pass/fail + resource usage before anything leaves the server.
 */
export async function gradeAgainst(
  problem: Pick<Problem, "examples" | "tests" | "limits">,
  language: LanguageId,
  code: string,
  mode: "run" | "submit",
): Promise<RunResponse> {
  const cases: Labeled[] = [
    ...problem.examples.map((t) => ({ ...t, kind: "example" as const })),
    ...(mode === "submit" ? problem.tests.map((t) => ({ ...t, kind: "hidden" as const })) : []),
  ];

  const exec = await executeBatch(
    language,
    code,
    cases.map((c) => ({ stdin: c.input })),
    { cpuTimeSec: problem.limits?.cpuTimeSec, memoryKb: problem.limits?.memoryKb },
  );

  const compileFail = exec.find((r) => r.status === "compile_error");
  if (compileFail) {
    return {
      mode,
      compileError: compileFail.compileOutput || compileFail.stderr || "Compilation failed",
      results: [],
      summary: { passed: 0, total: cases.length },
    };
  }

  const results: TestResult[] = exec.map((r, i) => {
    const c = cases[i];
    const passed = r.status === "ok" && outputsMatch(r.stdout, c.output);
    const base: TestResult = {
      index: i,
      kind: c.kind,
      passed,
      status: r.status,
      statusText: passed ? "Accepted" : r.status === "ok" ? "Wrong Answer" : r.statusText,
      timeMs: r.timeMs,
      memoryKb: r.memoryKb,
    };
    if (c.kind === "hidden") return base;
    return { ...base, input: c.input, expected: c.output, stdout: r.stdout, stderr: r.stderr };
  });

  return {
    mode,
    results,
    summary: { passed: results.filter((r) => r.passed).length, total: results.length },
  };
}
