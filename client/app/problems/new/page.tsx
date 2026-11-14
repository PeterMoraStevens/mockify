import { Suspense } from "react";
import { NewProblemTabs } from "@/components/problems/new-problem-tabs";

export const metadata = { title: "Create a problem · Mockify" };

export default function NewProblemPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-5xl">Create a problem</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Describe the problem, its function signature and some tests. Mockify writes the starter code for every language, and your reference
        solution has to pass every test before it goes live. Drafts save as you type.
      </p>
      <Suspense>
        <NewProblemTabs />
      </Suspense>
    </main>
  );
}
