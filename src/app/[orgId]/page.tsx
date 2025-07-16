import { redirect } from "next/navigation";

interface OrgRootPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function OrgRootPage({ params }: OrgRootPageProps) {
  // Immediately redirect to the issues list for the organization
  redirect(`/${(await params).orgId}/issues`);
}
