"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { MoreHorizontal, Trash2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateHuman } from "@/lib/date";
import { StatusSelector, LeadSelector } from "./project-selectors";
import type { Status, Team, Member } from "./project-selectors";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { TeamSelector } from "@/components/teams/team-selector";

// Type for project data with all the rich details
export interface ProjectRowData {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  updatedAt: Date;
  createdAt: Date;
  startDate?: string | null;
  dueDate?: string | null;
  // Status details
  statusId?: string | null;
  statusName?: string | null;
  statusColor?: string | null;
  statusIcon?: string | null;
  statusType?: string | null;
  // Team details
  teamId?: string | null;
  teamName?: string | null;
  teamKey?: string | null;
  // Lead details
  leadId?: string | null;
  leadName?: string | null;
  leadEmail?: string | null;
}

function getLeadInitials(name?: string | null, email?: string | null): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface ProjectsTableProps {
  orgSlug: string;
  projects: ReadonlyArray<ProjectRowData>;
  statuses: ReadonlyArray<Status>;
  teams: ReadonlyArray<Team>;
  members: ReadonlyArray<Member>;
  onStatusChange: (projectId: string, statusId: string) => void;
  onTeamChange: (projectId: string, teamId: string) => void;
  onLeadChange: (projectId: string, leadId: string) => void;
  onDelete: (projectId: string) => void;
  deletePending?: boolean;
}

export function ProjectsTable({
  orgSlug,
  projects,
  statuses,
  teams,
  members,
  onStatusChange,
  onTeamChange,
  onLeadChange,
  onDelete,
  deletePending = false,
}: ProjectsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">📁</div>
          <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      <AnimatePresence initial={false}>
        {projects.map((project) => {
          // Status icon / color
          const StatusIcon = project.statusIcon
            ? getDynamicIcon(project.statusIcon) || Circle
            : Circle;
          const statusColor = project.statusColor || "#94a3b8";

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              key={project.id}
              className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors"
            >
              {/* Status Selector */}
              <StatusSelector
                statuses={statuses}
                selectedStatus={project.statusId || ""}
                onStatusSelect={(sid) => onStatusChange(project.id, sid)}
                displayMode="iconOnly"
                trigger={
                  <div className="flex-shrink-0 cursor-pointer">
                    <StatusIcon
                      className="size-4"
                      style={{ color: statusColor }}
                    />
                  </div>
                }
                className="border-none bg-transparent p-0 shadow-none"
              />

              {/* Project Key */}
              {/* <span className="text-muted-foreground flex-shrink-0 font-mono text-xs">
                {project.key}
              </span> */}

              {/* Title */}
              <Link
                href={`/${orgSlug}/projects/${project.key}`}
                className="hover:text-primary flex min-w-0 flex-1 items-center gap-2 transition-colors"
              >
                <span className="block truncate text-sm font-medium">
                  {project.name}
                </span>
                <div className="bg-muted h-4 w-px" />
                {project.description && (
                  <p className="text-muted-foreground max-w-xs truncate text-xs">
                    {project.description}
                  </p>
                )}
              </Link>

              {/* Team Selector */}
              <div className="flex-shrink-0">
                <TeamSelector
                  teams={teams}
                  selectedTeam={project.teamId || ""}
                  onTeamSelect={(tid) => onTeamChange(project.id, tid)}
                  displayMode="iconWhenUnselected"
                  className="border-none bg-transparent p-0 shadow-none"
                />
              </div>

              {/* Date Info */}
              <div className="text-muted-foreground flex flex-col text-xs">
                {project.startDate && (
                  <span>
                    Start: {formatDateHuman(new Date(project.startDate))}
                  </span>
                )}
                {project.dueDate && (
                  <span>Due: {formatDateHuman(new Date(project.dueDate))}</span>
                )}
                {!project.startDate && !project.dueDate && (
                  <span>Updated {formatDateHuman(project.updatedAt)}</span>
                )}
              </div>

              {/* Lead Selector */}
              <LeadSelector
                members={members}
                selectedLead={project.leadId || ""}
                onLeadSelect={(lid) => onLeadChange(project.id, lid)}
                displayMode="iconWhenUnselected"
                trigger={
                  project.leadId ? (
                    <div className="flex cursor-pointer items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-xs">
                          {getLeadInitials(project.leadName, project.leadEmail)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <div className="flex size-6 cursor-pointer items-center justify-center">
                      <span className="text-muted-foreground text-xs">—</span>
                    </div>
                  )
                }
                className="border-none bg-transparent p-0 shadow-none"
              />

              {/* Actions */}
              <div className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label="Open project actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deletePending}
                      onClick={() => onDelete(project.id)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
