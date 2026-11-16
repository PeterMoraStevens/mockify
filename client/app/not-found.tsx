import { Home, Library, Video } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Not found · Mockify" };

/** Shown for unknown URLs and whenever a page calls notFound() (missing room, interview, problem…). */
export default function NotFound() {
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-grid p-4">
      <div className="w-full max-w-lg rounded-base border-4 border-border bg-secondary-background p-8 text-center shadow-xl">
        <div className="mx-auto inline-flex -rotate-2 items-center rounded-base border-4 border-border bg-main px-5 py-2 font-heading text-6xl text-main-foreground shadow-lg">
          404
        </div>
        <h1 className="mt-6 text-3xl">Nothing here</h1>
        <p className="mt-3 text-muted">
          This page doesn&apos;t exist, or it isn&apos;t yours to see. Check the link, or head somewhere useful.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">
              <Home /> Home
            </Link>
          </Button>
          <Button asChild variant="neutral">
            <Link href="/rooms">
              <Video /> Your rooms
            </Link>
          </Button>
          <Button asChild variant="neutral">
            <Link href="/problems">
              <Library /> Problems
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
