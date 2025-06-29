"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Users, FolderOpen, Check, MoreHorizontal } from "lucide-react";
import { Textarea } from "../ui/textarea";

// Extracted selector components
import {
  TeamSelector,
  ProjectSelector,
  StateSelector,
  PrioritySelector,
  AssigneeSelector,
} from "./issue-selectors";

// ---------------------------------------------------------------------------
// 🧩 Type inference – derive types directly from tRPC router outputs
// ---------------------------------------------------------------------------

// Key Format Selector Component
interface KeyFormatSelectorProps {
  manualFormatOverride: "team" | "project" | "user" | null;
  setManualFormatOverride: (value: "team" | "project" | "user" | null) => void;
  preview: string;
}

function KeyFormatSelector({
  manualFormatOverride,
  setManualFormatOverride,
  preview,
}: KeyFormatSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-muted/50 h-6 w-6 rounded-md p-0"
          >
            <MoreHorizontal className="text-muted-foreground h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1">
          <DropdownMenuItem
            onClick={() => setManualFormatOverride(null)}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {!manualFormatOverride && (
                    <Check className="text-primary h-3 w-3" />
                  )}
                </div>
                Auto-detect format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride("user")}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {manualFormatOverride === "user" ? (
                    <Check className="text-primary h-3 w-3" />
                  ) : (
                    <User className="text-muted-foreground h-3 w-3" />
                  )}
                </div>
                User format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride("team")}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {manualFormatOverride === "team" ? (
                    <Check className="text-primary h-3 w-3" />
                  ) : (
                    <Users className="text-muted-foreground h-3 w-3" />
                  )}
                </div>
                Team format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride("project")}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {manualFormatOverride === "project" ? (
                    <Check className="text-primary h-3 w-3" />
                  ) : (
                    <FolderOpen className="text-muted-foreground h-3 w-3" />
                  )}
                </div>
                Project format
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {manualFormatOverride && (
        <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
          <div className="h-1 w-1 rounded-full bg-orange-500" />
          forced
        </span>
      )}
      <code className="bg-muted flex h-8 items-center rounded-md px-2.5 font-mono text-sm">
        {preview}
      </code>
    </div>
  );
}

interface CreateIssueDialogProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (issueId: string) => void;
}

export function CreateIssueDialog({
  orgSlug,
  onClose,
  onSuccess,
}: CreateIssueDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [manualFormatOverride, setManualFormatOverride] = useState<
    "team" | "project" | "user" | null
  >(null);

  const utils = trpc.useUtils();

  // ---------------------------------------------
  //   Fetch data (teams, projects, states)
  // ---------------------------------------------
  // Get teams and projects data
  const { data: teams = [] } = trpc.organization.listTeams.useQuery({
    orgSlug,
  });
  const { data: projects = [] } = trpc.organization.listProjects.useQuery({
    orgSlug,
  });
  const { data: states = [] } = trpc.organization.listIssueStates.useQuery({
    orgSlug,
  });
  const { data: members = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });
  const { data: priorities = [] } =
    trpc.organization.listIssuePriorities.useQuery({ orgSlug });

  // Auto-infer the format based on selections
  const getEffectiveFormat = (): "team" | "project" | "user" => {
    // Manual override takes precedence
    if (manualFormatOverride) {
      return manualFormatOverride;
    }

    // Auto-infer: Project > Team > User
    if (selectedProject) {
      return "project";
    }
    if (selectedTeam) {
      return "team";
    }
    return "user";
  };

  const effectiveFormat = getEffectiveFormat();

  // Auto-select the first "todo" state as default
  useEffect(() => {
    if (states.length > 0 && !selectedState) {
      const defaultState =
        states.find((state) => state.type === "todo") || states[0];
      setSelectedState(defaultState.id);
    }
  }, [states, selectedState]);

  const createMutation = trpc.issue.create.useMutation({
    onSuccess: (result) => {
      // Refresh issues list
      utils.organization.listIssues.invalidate({ orgSlug }).catch(() => {});
      onSuccess?.(result.id);
      onClose();
    },
    onError: (e) => console.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Validate required selections based on effective format
    if (effectiveFormat === "team" && !selectedTeam) {
      alert("Please select a team for team-based issue keys");
      return;
    }
    if (effectiveFormat === "project" && !selectedProject) {
      alert("Please select a project for project-based issue keys");
      return;
    }

    createMutation.mutate({
      orgSlug,
      title: title.trim(),
      description: description.trim() || undefined,
      teamId: selectedTeam || undefined,
      projectId: selectedProject || undefined,
      stateId: selectedState || undefined,
      priorityId: selectedPriority || undefined,
      assigneeId: selectedAssignee || undefined,
      issueKeyFormat: effectiveFormat,
    });
  };

  const getIssueKeyPreview = () => {
    const nextNumber = 1; // Placeholder for preview

    // Show different examples based on manual override
    if (manualFormatOverride === "team") {
      const team = teams.find((t) => t.id === selectedTeam);
      return team ? `${team.key}-${nextNumber}` : `TEAM-${nextNumber}`;
    }
    if (manualFormatOverride === "project") {
      const project = projects.find((p) => p.id === selectedProject);
      return project ? `${project.key}-${nextNumber}` : `PROJ-${nextNumber}`;
    }
    if (manualFormatOverride === "user") {
      return `USER-${nextNumber}`;
    }

    // Auto-detect logic (original behavior)
    if (effectiveFormat === "team" && selectedTeam) {
      const team = teams.find((t) => t.id === selectedTeam);
      return team ? `${team.key}-${nextNumber}` : `TEAM-${nextNumber}`;
    }
    if (effectiveFormat === "project" && selectedProject) {
      const project = projects.find((p) => p.id === selectedProject);
      return project ? `${project.key}-${nextNumber}` : `PROJ-${nextNumber}`;
    }
    // For user format, we'd need the current user info - for now show placeholder
    return `USER-${nextNumber}`;
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className="gap-2 p-2 sm:max-w-2xl">
        <DialogHeader className="">
          <DialogTitle className="flex items-center">
            <div className="text-muted-foreground flex w-full items-center gap-2 text-sm">
              {/* Properties Row */}
              <div className="flex flex-wrap gap-2">
                <TeamSelector
                  teams={teams}
                  selectedTeam={selectedTeam}
                  onTeamSelect={setSelectedTeam}
                  displayMode="iconWhenUnselected"
                />

                <AssigneeSelector
                  members={members}
                  selectedAssignee={selectedAssignee}
                  onAssigneeSelect={setSelectedAssignee}
                  displayMode="iconWhenUnselected"
                />

                <ProjectSelector
                  projects={projects}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                />

                <StateSelector
                  states={states}
                  selectedState={selectedState}
                  onStateSelect={setSelectedState}
                />

                <PrioritySelector
                  priorities={priorities}
                  selectedPriority={selectedPriority}
                  onPrioritySelect={setSelectedPriority}
                />
              </div>
              <div className="ml-auto">
                <KeyFormatSelector
                  manualFormatOverride={manualFormatOverride}
                  setManualFormatOverride={setManualFormatOverride}
                  preview={getIssueKeyPreview()}
                />
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Title */}
          <Input
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base"
            autoFocus
          />

          {/* Description */}
          <Textarea
            placeholder="Add description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[120px] w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
        </form>

        <div className="flex w-full flex-row items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              !title.trim() ||
              createMutation.isPending ||
              (effectiveFormat === "team" && !selectedTeam) ||
              (effectiveFormat === "project" && !selectedProject)
            }
            onClick={handleSubmit}
          >
            {createMutation.isPending ? "Creating…" : "Create issue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
