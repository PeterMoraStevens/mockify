// Shapes returned by /api/run. Shared by server and client.

export type RunMode = "run" | "submit" | "custom";

export type ExecStatusName =
  | "ok"
  | "compile_error"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "internal_error";

export type TestResult = {
  index: number;
  kind: "example" | "hidden";
  passed: boolean;
  status: ExecStatusName;
  statusText: string;
  timeMs: number | null;
  memoryKb: number | null;
  /** Only present for visible examples. Hidden tests never include I/O. */
  input?: string;
  expected?: string;
  stdout?: string;
  stderr?: string;
  /**
   * Hidden tests only: the kind of error a runtime error raised ("IndexError",
   * "java.lang.NullPointerException", "panic"), never its message, since a
   * message could echo the hidden input back.
   */
  errorKind?: string;
};

export type CustomRunResult = {
  status: ExecStatusName;
  statusText: string;
  stdout: string;
  stderr: string;
  timeMs: number | null;
  memoryKb: number | null;
};

export type RunResponse = {
  mode: RunMode;
  compileError?: string;
  results: TestResult[];
  custom?: CustomRunResult;
  summary: { passed: number; total: number };
};
