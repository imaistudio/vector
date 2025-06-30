import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateHuman } from "@/lib/date";
import {
  StatusSelector,
  TeamSelector,
  LeadSelector,
} from "@/components/projects/project-selectors";
import ProjectViewClient from "./project-view-client";

interface ProjectViewPageProps {
  params: Promise<{ orgId: string; projectKey: string }>;
}

export default async function ProjectViewPage({
  params,
}: ProjectViewPageProps) {
  const resolvedParams = await params;

  return <ProjectViewClient params={resolvedParams} />;
}
