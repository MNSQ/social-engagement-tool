import { auth, signIn } from "@/auth";
import { PublicApp } from "@/components/PublicApp";
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
        className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
      >
        Admin login
      </button>
    </form>
  );
}

export default async function Home() {
  const session = await auth();
  const posts = loadCsvPosts() ?? samplePosts;

  return (
    <PublicApp
      initialPosts={posts}
      isAdmin={session?.user?.isAdmin ?? false}
      userEmail={session?.user?.email ?? undefined}
      isAuthenticated={!!session?.user}
      signOutSlot={session?.user ? <SignOutButton /> : undefined}
      adminLoginSlot={<AdminLoginButton />}
    />
  );
}
