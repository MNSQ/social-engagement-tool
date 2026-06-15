import { Dashboard } from "@/components/Dashboard";
import { loadCsvPosts } from "@/lib/csvPosts";
import { samplePosts } from "@/lib/samplePosts";

export default async function Home() {
  const posts = loadCsvPosts() ?? samplePosts;
  return <Dashboard initialPosts={posts} />;
}
