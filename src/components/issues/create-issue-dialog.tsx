"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bug,
  Hash,
  User,
  Users,
  FolderOpen,
  Check,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";

// ---------------------------------------------------------------------------
// 🧩 Type inference – derive types directly from tRPC router outputs
// ---------------------------------------------------------------------------
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

type Team = RouterOutputs["organization"]["listTeams"][number];
type Project = RouterOutputs["organization"]["listProjects"][number];
type State = RouterOutputs["organization"]["listIssueStates"][number];
type Member = RouterOutputs["organization"]["listMembers"][number];
type Priority = RouterOutputs["organization"]["listIssuePriorities"][number];

// Team Selector Component
interface TeamSelectorProps {
  teams: Team[];
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
}

function TeamSelector({
  teams,
  selectedTeam,
  onTeamSelect,
}: TeamSelectorProps) {
  const [open, setOpen] = useState(false);

  if (teams.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/30 hover:bg-muted/50 h-8 gap-2"
        >
          <Users className="h-3 w-3" />
          {selectedTeam
            ? teams.find((team) => team.id === selectedTeam)?.name
            : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search team..." className="h-9" />
          <CommandList>
            <CommandEmpty>No team found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onTeamSelect("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedTeam === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                None
              </CommandItem>
              {teams.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => {
                    onTeamSelect(team.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedTeam === team.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {team.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Project Selector Component
interface ProjectSelectorProps {
  projects: Project[];
  selectedProject: string;
  onProjectSelect: (projectId: string) => void;
}

function ProjectSelector({
  projects,
  selectedProject,
  onProjectSelect,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/30 hover:bg-muted/50 h-8 gap-2"
        >
          <FolderOpen className="h-3 w-3" />
          {selectedProject
            ? projects.find((project) => project.id === selectedProject)?.name
            : "Project"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search project..." className="h-9" />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onProjectSelect("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedProject === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                None
              </CommandItem>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => {
                    onProjectSelect(project.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedProject === project.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// State Selector Component
interface StateSelectorProps {
  states: readonly State[] | State[];
  selectedState: string;
  onStateSelect: (stateId: string) => void;
}

function StateSelector({
  states,
  selectedState,
  onStateSelect,
}: StateSelectorProps) {
  const [open, setOpen] = useState(false);

  // Transform states from API into combobox-friendly structure
  const stateOptions = states.map((s) => ({
    value: s.id,
    label: s.name,
    color: s.color || "#94a3b8", // fallback to default gray
  }));

  // Get the color for the currently selected state
  const getSelectedStateColor = () => {
    if (!selectedState) {
      // Fallback: try to find default "todo" state color
      const defaultState =
        states.find((state) => state.type === "todo") || states[0];
      return defaultState?.color || "#94a3b8";
    }
    const state = stateOptions.find((s) => s.value === selectedState);
    return state?.color || "#94a3b8";
  };

  // Get the default state name
  const getDefaultStateName = () => {
    if (!selectedState) {
      const defaultState =
        states.find((state) => state.type === "todo") || states[0];
      return defaultState?.name || "Select state...";
    }
    return (
      stateOptions.find((state) => state.value === selectedState)?.label ||
      "Select state..."
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/30 hover:bg-muted/50 h-8 gap-2"
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: getSelectedStateColor() }}
          />
          {getDefaultStateName()}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search state..." className="h-9" />
          <CommandList>
            <CommandEmpty>No state found.</CommandEmpty>
            <CommandGroup>
              {stateOptions.map((state) => (
                <CommandItem
                  key={state.value}
                  value={state.label}
                  onSelect={() => {
                    onStateSelect(state.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedState === state.value
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div
                    className="mr-2 h-2 w-2 rounded-full"
                    style={{ backgroundColor: state.color }}
                  />
                  {state.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Priority Selector Component
interface PrioritySelectorProps {
  priorities: readonly Priority[] | Priority[];
  selectedPriority: string;
  onPrioritySelect: (priorityId: string) => void;
}

function PrioritySelector({
  priorities,
  selectedPriority,
  onPrioritySelect,
}: PrioritySelectorProps) {
  const [open, setOpen] = useState(false);

  if (priorities.length === 0) return null;

  const current = priorities.find((p) => p.id === selectedPriority);
  const currentColor = current?.color || "#94a3b8";
  const currentName = current?.name || "Priority";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/30 hover:bg-muted/50 h-8 gap-2"
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: currentColor }}
          />
          {currentName}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search priority..." className="h-9" />
          <CommandList>
            <CommandEmpty>No priority found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onPrioritySelect("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedPriority === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="bg-muted-foreground/30 mr-2 h-2 w-2 rounded-full" />
                None
              </CommandItem>
              {priorities.map((priority) => (
                <CommandItem
                  key={priority.id}
                  value={priority.name}
                  onSelect={() => {
                    onPrioritySelect(priority.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedPriority === priority.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div
                    className="mr-2 h-2 w-2 rounded-full"
                    style={{ backgroundColor: priority.color || "#94a3b8" }}
                  />
                  {priority.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Assignee Selector Component
interface AssigneeSelectorProps {
  members: Member[];
  selectedAssignee: string;
  onAssigneeSelect: (assigneeId: string) => void;
}

function AssigneeSelector({
  members,
  selectedAssignee,
  onAssigneeSelect,
}: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false);

  if (members.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/30 hover:bg-muted/50 h-8 gap-2"
        >
          <User className="h-3 w-3" />
          {selectedAssignee
            ? members.find((member) => member.userId === selectedAssignee)?.name
            : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search assignee..." className="h-9" />
          <CommandList>
            <CommandEmpty>No member found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onAssigneeSelect("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedAssignee === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                Unassigned
              </CommandItem>
              {members.map((member) => (
                <CommandItem
                  key={member.userId}
                  value={member.name || member.email}
                  onSelect={() => {
                    onAssigneeSelect(member.userId);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedAssignee === member.userId
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{member.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {member.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
                />

                <AssigneeSelector
                  members={members}
                  selectedAssignee={selectedAssignee}
                  onAssigneeSelect={setSelectedAssignee}
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
