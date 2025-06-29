import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth/auth";
import { StatesPageContent } from "./states-page-content";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function StatesPage({ params }: PageProps) {
  const { orgId: orgSlug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  // Page content fetches data via tRPC – we only need to pass orgSlug
  return <StatesPageContent orgSlug={orgSlug} />;
}
