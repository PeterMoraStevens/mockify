import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/server/auth";

function safeNext(next: string | undefined) {
  // Only allow same-site relative paths.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-grid px-4 py-16">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <h1 className="text-6xl leading-none">
            Practice like it&apos;s <span className="bg-main px-2 text-main-foreground">the real thing.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Your account lives on this server and nowhere else. Sign in to start rooms, run code and keep the feedback people leave you.
          </p>
          <ul className="mt-8 space-y-3 font-heading">
            {["Peer-to-peer video & editor", "Hidden-test grading on Piston", "Feedback history on your profile"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="size-3 rotate-45 border-2 border-border bg-main" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <AuthForm
          next={next}
          signupsOpen={process.env.ALLOW_SIGNUPS !== "false"}
          inviteRequired={!!process.env.SIGNUP_INVITE_CODE}
          initialMode={sp.mode === "signup" ? "signup" : "login"}
        />
      </div>
    </main>
  );
}
