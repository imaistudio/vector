import { ProjectsPageContent } from "@/components/projects/projects-page-content";

interface ProjectsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const { orgId } = await params;

  return <ProjectsPageContent orgSlug={orgId} />;
}
