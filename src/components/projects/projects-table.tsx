"use client";

import Link from "next/link";
import { FolderKanban, Clock } from "lucide-react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  updatedAt: Date | string;
  createdAt?: Date | string;
}

interface ProjectsTableProps {
  orgSlug: string;
  projects: Project[];
}

export function ProjectsTable({ orgSlug, projects }: ProjectsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border">
        <div className="p-8 text-center">
          <FolderKanban className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
          <p className="text-muted-foreground">
            Projects help you organize work into manageable workflows and track
            progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Project</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[15%]">Updated</TableHead>
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FolderKanban className="text-muted-foreground size-4" />
                  <Link
                    href={`/${orgSlug}/projects/${project.key}`}
                    className="hover:text-primary font-medium"
                  >
                    {project.name}
                  </Link>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground truncate">
                {project.description || "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Clock className="text-muted-foreground size-3" />
                  <span className="text-muted-foreground text-sm">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${orgSlug}/projects/${project.key}`}>Open</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
