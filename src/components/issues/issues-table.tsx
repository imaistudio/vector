"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

import type { InferSelectModel } from "drizzle-orm";
import { issue as issueTable } from "@/db/schema/issues";

// Infer core fields directly from the DB table, then extend with join extras.
type BaseIssue = InferSelectModel<typeof issueTable>;

type Issue = Pick<
  BaseIssue,
  "id" | "title" | "key" | "sequenceNumber" | "stateId" | "priorityId"
> & {
  updatedAt: string | Date;
  projectName: string | null;
  teamKey: string | null;
  projectKey: string | null;
};

interface IssuesTableProps {
  orgSlug: string;
  issues: Issue[];
}

// No longer needed - we use the stored key directly from the database

export function IssuesTable({ orgSlug, issues }: IssuesTableProps) {
  const utils = trpc.useUtils();
  const deleteMutation = trpc.issue.delete.useMutation({
    onSuccess: () => {
      utils.organization.listIssues.invalidate({ orgSlug }).catch(() => {});
    },
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Issue</TableHead>
          <TableHead>Project</TableHead>
          <TableHead className="w-[15%]">Updated</TableHead>
          <TableHead className="w-[15%]">Status</TableHead>
          <TableHead className="w-[15%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => {
          return (
            <TableRow key={issue.id}>
              <TableCell className="truncate">
                <Link
                  href={`/${orgSlug}/issues/${issue.key}`}
                  className="hover:text-primary font-medium"
                >
                  {issue.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground truncate">
                {issue.projectName ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Clock className="text-muted-foreground size-3" />
                  <span>{new Date(issue.updatedAt).toLocaleDateString()}</span>
                </div>
              </TableCell>
              <TableCell>
                {issue.stateId && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      issue.stateId === "open"
                        ? "bg-green-100 text-green-800"
                        : issue.stateId === "in-progress"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {issue.stateId}
                  </span>
                )}
              </TableCell>
              <TableCell className="flex justify-end gap-2 text-right">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${orgSlug}/issues/${issue.key}`}>Open</Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      !confirm(
                        "Delete this issue? This action cannot be undone.",
                      )
                    )
                      return;
                    deleteMutation.mutate({ issueId: issue.id });
                  }}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
