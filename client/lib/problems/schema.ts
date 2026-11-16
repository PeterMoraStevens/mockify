import { z } from "zod";
import { LANGUAGE_IDS } from "@/lib/languages";
import { isValidType } from "@/lib/problems/starters";

// Each test is sent to Piston as its own request, and Piston rejects bodies over
// ~100 KB (source code + stdin), so keep a single test's input well below that.
export const MAX_IO = 64 * 1024;

// A program's output is cut off at 32 KB before it's compared (lib/server/piston.ts),
// so an expected output any bigger could never pass.
export const MAX_EXPECTED_OUTPUT = 30 * 1024;

export const testCaseSchema = z.object({
  input: z.string().max(MAX_IO),
  output: z.string().max(MAX_EXPECTED_OUTPUT, "Expected outputs must be under 30 KB (program output is cut off at 32 KB)"),
  explanation: z.string().max(2000).optional(),
});

const languageEnum = z.enum(LANGUAGE_IDS);

export const problemSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and single dashes only")
      .refine((s) => s !== "new" && s !== "library", "That URL name is reserved"),
    title: z.string().min(3).max(120),
    difficulty: z.enum(["easy", "medium", "hard"]),
    tags: z.array(z.string().min(1).max(32)).max(10).default([]),
    license: z.string().min(2).max(120),
    source: z
      .object({ name: z.string().min(1).max(120), url: z.url().optional() })
      .optional(),
    /** Markdown. Should describe the stdin/stdout format. */
    description: z.string().min(20).max(20000),
    /** Set by the problem builder; lets it reopen a problem as a form. */
    signature: z
      .object({
        params: z
          .array(z.object({ name: z.string().min(1).max(40), type: z.string().refine((t) => isValidType(t, "param"), "unsupported type") }))
          .min(1)
          .max(6),
        returns: z.string().refine((t) => isValidType(t, "return"), "unsupported return type"),
      })
      .optional(),
    /** Visible test cases. Shown to both people and used by Run. */
    examples: z.array(testCaseSchema).min(1, "at least one visible example is required").max(10),
    /** Hidden test cases. Only ever read on the server. */
    tests: z.array(testCaseSchema).max(100).default([]),
    /** Starter code per language. Each should read stdin and call solve(). */
    starters: z
      .partialRecord(languageEnum, z.string().min(1).max(20000))
      .refine((s) => Object.keys(s).length > 0, "at least one starter is required"),
    interviewer: z
      .object({
        hints: z.array(z.string().max(2000)).max(10).default([]),
        followUps: z.array(z.string().max(2000)).max(10).default([]),
        expectedComplexity: z
          .object({ time: z.string().max(80), space: z.string().max(80) })
          .optional(),
        notes: z.string().max(5000).optional(),
      })
      .default({ hints: [], followUps: [] }),
    /** Required. Run through Piston against every test before publishing. */
    reference: z.object({
      language: languageEnum,
      code: z.string().min(1).max(50000),
    }),
    limits: z
      .object({
        cpuTimeSec: z.number().min(0.5).max(15).optional(),
        memoryKb: z.number().int().min(16000).max(512000).optional(),
      })
      .optional(),
  })
  .strict();

export type Problem = z.infer<typeof problemSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type Difficulty = Problem["difficulty"];

/** What the candidate's browser receives. No hidden tests, no reference, no hints. */
export type PublicProblem = Pick<
  Problem,
  "slug" | "title" | "difficulty" | "tags" | "license" | "source" | "description" | "examples" | "starters" | "signature"
> & { hiddenCount: number };

/** What the interviewer's browser receives, on top of the public view. */
export type InterviewerProblem = PublicProblem & { interviewer: Problem["interviewer"] };

export type ProblemSummary = Pick<Problem, "slug" | "title" | "difficulty" | "tags"> & {
  languages: string[];
  testCount: number;
  uploaded: boolean;
};
