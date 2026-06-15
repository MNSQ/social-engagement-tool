import { signIn } from "@/auth";

export function LoginScreen() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Social Media Engagement Tool
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Access is limited to approved accounts. Sign in with Google to view engagement
          opportunities.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
