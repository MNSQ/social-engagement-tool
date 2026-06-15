import { signIn } from "@/auth";
import { BoltIcon } from "./icons";

export function LoginScreen() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <div>
        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30">
          <BoltIcon className="h-5 w-5 text-cyan-300" />
        </span>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
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
