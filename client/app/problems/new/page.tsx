import { UploadForm } from "@/components/problems/upload-form";

export default function NewProblemPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-5xl">Upload a problem</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Paste or load a problem in the JSON format below. Before it goes live, its reference solution runs on Piston against
        every visible and hidden test. If any test fails, the problem isn&apos;t published.
      </p>
      <UploadForm />
    </main>
  );
}
