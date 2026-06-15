import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
      >
        Sign out
      </button>
    </form>
  );
}
