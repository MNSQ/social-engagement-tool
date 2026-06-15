import { auth } from "@/auth";
import { Dashboard } from "@/components/Dashboard";
import { LoginScreen } from "@/components/LoginScreen";
import { SignOutButton } from "@/components/SignOutButton";
import { loadCsvPosts } from "@/lib/csvPosts";
import { samplePosts } from "@/lib/samplePosts";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return <LoginScreen />;
  }

  const posts = loadCsvPosts() ?? samplePosts;

  return (
    <Dashboard
      initialPosts={posts}
      isAdmin={session.user.isAdmin}
      userEmail={session.user.email ?? undefined}
      signOutSlot={<SignOutButton />}
    />
  );
}
