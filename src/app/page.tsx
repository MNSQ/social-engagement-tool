import { auth, signIn } from "@/auth";
import { Dashboard } from "@/components/Dashboard";
import { SignOutButton } from "@/components/SignOutButton";
import { loadCsvPosts } from "@/lib/csvPosts";
import { samplePosts } from "@/lib/samplePosts";

function AdminLoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button
        type="submit"
        className="rounded border border-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-700 hover:text-slate-400"
      >
        Admin
      </button>
    </form>
  );
}

export default async function Home() {
  const session = await auth();
  const posts = loadCsvPosts() ?? samplePosts;

  return (
    <Dashboard
      initialPosts={posts}
      isAdmin={session?.user?.isAdmin ?? false}
      userEmail={session?.user?.email ?? undefined}
      signOutSlot={session?.user ? <SignOutButton /> : undefined}
      adminLoginSlot={!session?.user ? <AdminLoginButton /> : undefined}
    />
  );
}
