"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { CreateIssueButton } from "@/components/issues/create-issue-button";
import { useParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { issueStateTypeEnum } from "@/db/schema/issue-config";

type StateType = (typeof issueStateTypeEnum.enumValues)[number];
type FilterType = "all" | StateType;

const TAB_LABELS: Record<FilterType, string> = {
  all: "All",
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
} as const;

const BASE_TABS: { key: FilterType; label: string; count: number }[] = [
  { key: "all", label: TAB_LABELS.all, count: 0 },
  // dynamic generated below
];
const filterTabs = [
  ...BASE_TABS,
  ...issueStateTypeEnum.enumValues.map((value) => ({
    key: value as FilterType,
    label: TAB_LABELS[value as StateType],
    count: 0,
  })),
];

function PriorityIcon({
  priority,
}: {
  priority?: { name: string; weight: number; color?: string } | null;
}) {
  if (!priority) {
    return (
      <div
        className="bg-muted-foreground/30 h-2 w-2 rounded-full"
        title="No priority"
      />
    );
  }

  return (
    <div
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: priority.color || "#94a3b8" }}
      title={priority.name}
    />
  );
}

function StatusBadge({
  state,
}: {
  state?: { name: string; color?: string; type: string } | null;
}) {
  if (!state) return <div className="h-2 w-2 rounded-full bg-gray-400" />;

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: state.color || "#94a3b8" }}
      />
      <span className="text-muted-foreground text-xs">{state.name}</span>
    </div>
  );
}

function TeamBadge({ team }: { team?: { name: string; key: string } | null }) {
  if (!team) return null;

  return (
    <Badge variant="secondary" className="text-xs">
      {team.name}
    </Badge>
  );
}

function AssigneeAvatar({
  assignee,
}: {
  assignee?: { name?: string; email: string } | null;
}) {
  if (!assignee) return null;

  const initials = (assignee.name || assignee.email)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white"
      title={assignee.name || assignee.email}
    >
      {initials}
    </div>
  );
}

export default function IssuesPage() {
  const params = useParams();
  const orgSlug = params.orgId as string;
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const utils = trpc.useUtils();
  const deleteMutation = trpc.issue.delete.useMutation({
    onSuccess: () => {
      utils.organization.listIssues.invalidate({ orgSlug }).catch(() => {});
    },
  });

  const { data: paged, isLoading } = trpc.organization.listIssuesPaged.useQuery(
    {
      orgSlug,
      page,
      pageSize: PAGE_SIZE,
    },
  );

  const issues = paged?.issues ?? [];
  const counts = paged?.counts ?? {};
  const total = paged?.total ?? 0;

  // Filter issues based on active filter
  const filteredIssues = issues.filter((issue) => {
    if (activeFilter === "all") return true;
    return issue.stateType === activeFilter;
  });

  // Update counts for tabs
  const updatedTabs = filterTabs.map((tab) => ({
    ...tab,
    count:
      tab.key === "all"
        ? total
        : ((counts as Record<string, number>)[tab.key as string] ?? 0),
  }));

  const visibleTabs = updatedTabs.filter((t) => t.key === "all" || t.count > 0);

  if (isLoading && issues.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground text-sm">Loading issues...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background h-full">
      {/* Header with tabs */}
      <div className="border-b">
        <div className="flex items-center justify-between p-1">
          <div className="flex items-center gap-1">
            {visibleTabs.map((tab) => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 gap-2 rounded-xs px-3 text-xs font-normal",
                  activeFilter === tab.key && "bg-secondary",
                )}
                onClick={() => setActiveFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="text-muted-foreground text-xs">
                  {tab.count}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Issues table */}
      <div className="flex-1">
        {filteredIssues.length > 0 ? (
          <div className="divide-y">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                {/* Priority */}
                <div className="flex w-4 justify-center">
                  <PriorityIcon
                    priority={
                      issue.priorityName
                        ? {
                            name: issue.priorityName,
                            weight: issue.priorityWeight || 0,
                            color: issue.priorityColor || undefined,
                          }
                        : null
                    }
                  />
                </div>

                {/* Issue key and title */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs">
                      {issue.key}
                    </span>
                    <StatusBadge
                      state={
                        issue.stateName
                          ? {
                              name: issue.stateName,
                              color: issue.stateColor || undefined,
                              type: issue.stateType || "todo",
                            }
                          : null
                      }
                    />
                  </div>
                  <Link
                    href={`/${orgSlug}/issues/${issue.key}`}
                    className="block truncate text-sm font-medium transition-colors hover:text-blue-600"
                  >
                    {issue.title}
                  </Link>
                </div>

                {/* Team */}
                <div className="flex w-24 justify-center">
                  <TeamBadge
                    team={
                      issue.teamName
                        ? {
                            name: issue.teamName,
                            key: issue.teamKey || "",
                          }
                        : null
                    }
                  />
                </div>

                {/* Assignee */}
                <div className="flex w-16 justify-center">
                  <AssigneeAvatar
                    assignee={
                      issue.assigneeName || issue.assigneeEmail
                        ? {
                            name: issue.assigneeName || undefined,
                            email: issue.assigneeEmail || "",
                          }
                        : null
                    }
                  />
                </div>

                {/* Updated date */}
                <div className="text-muted-foreground w-20 text-right text-xs">
                  {new Date(issue.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>

                {/* Actions */}
                <div className="flex w-8 justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label="Open issue actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
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
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 text-4xl">📋</div>
              <h3 className="mb-2 text-lg font-semibold">No issues found</h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first issue.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating create button */}
      <div className="fixed right-6 bottom-6">
        <CreateIssueButton orgSlug={orgSlug} variant="floating" />
      </div>

      {/* Pagination controls */}
      <div className="text-muted-foreground flex justify-between border-t p-2 text-xs">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
