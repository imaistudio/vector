"use client";

import { useState } from "react";
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
import { Folder, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateProjectDialogProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
}

export function CreateProjectDialog({
  orgSlug,
  onClose,
  onSuccess,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [teamComboboxOpen, setTeamComboboxOpen] = useState(false);
  const [leadComboboxOpen, setLeadComboboxOpen] = useState(false);
  const [statusComboboxOpen, setStatusComboboxOpen] = useState(false);

  const utils = trpc.useUtils();

  // Get teams and organization members
  const { data: teams = [] } = trpc.organization.listTeams.useQuery({
    orgSlug,
  });
  const { data: orgMembers = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });

  // ---------------------------------------------
  //   Fetch project statuses from organization
  // ---------------------------------------------

  const { data: statuses = [] } =
    trpc.organization.listProjectStatuses.useQuery({ orgSlug });

  // Transform statuses into combobox-friendly shape
  const statusOptions = statuses.map((s) => ({ value: s.id, label: s.name }));

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (result) => {
      utils.organization.listProjects.invalidate({ orgSlug }).catch(() => {});
      onSuccess?.(result.id);
      onClose();
    },
    onError: (e) => console.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    createMutation.mutate({
      orgSlug,
      name: name.trim(),
      key: key.trim(),
      description: description.trim() || undefined,
      teamId: selectedTeam || undefined,
      leadId: selectedLead || undefined,
      statusId: selectedStatus || undefined,
    });
  };

  // Auto-generate key from name
  const handleNameChange = (value: string) => {
    setName(value);
    if (!key) {
      const generatedKey = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 20);
      setKey(generatedKey);
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="size-4" />
            New project
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder="Project name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          {/* Project Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Key</label>
            <Input
              placeholder="project-key"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              className="h-9"
            />
            <p className="text-muted-foreground text-xs">
              Used for URLs and identification (e.g., /projects/{key})
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description (optional)
            </label>
            <textarea
              placeholder="Project description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Team Selection */}
          {teams.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Team (optional)</label>
              <Popover
                open={teamComboboxOpen}
                onOpenChange={setTeamComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={teamComboboxOpen}
                    className="h-9 w-full justify-between"
                  >
                    {selectedTeam
                      ? teams.find((team) => team.id === selectedTeam)?.name
                      : "Select team..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-h-[200px] w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search team..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No team found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => {
                            setSelectedTeam("");
                            setTeamComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedTeam === "" ? "opacity-100" : "opacity-0",
                            )}
                          />
                          No team
                        </CommandItem>
                        {teams.map((team) => (
                          <CommandItem
                            key={team.id}
                            value={team.name}
                            onSelect={() => {
                              setSelectedTeam(team.id);
                              setTeamComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTeam === team.id
                                  ? "opacity-100"
                                  : "opacity-0",
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
            </div>
          )}

          {/* Lead Selection */}
          {orgMembers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Project lead (optional)
              </label>
              <Popover
                open={leadComboboxOpen}
                onOpenChange={setLeadComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={leadComboboxOpen}
                    className="h-9 w-full justify-between"
                  >
                    {selectedLead
                      ? orgMembers.find(
                          (member) => member.userId === selectedLead,
                        )?.name
                      : "Select project lead..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-h-[200px] w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search member..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No member found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => {
                            setSelectedLead("");
                            setLeadComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedLead === "" ? "opacity-100" : "opacity-0",
                            )}
                          />
                          No lead
                        </CommandItem>
                        {orgMembers.map((member) => (
                          <CommandItem
                            key={member.userId}
                            value={member.name}
                            onSelect={() => {
                              setSelectedLead(member.userId);
                              setLeadComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLead === member.userId
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {member.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Status Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status (optional)</label>
            <Popover
              open={statusComboboxOpen}
              onOpenChange={setStatusComboboxOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={statusComboboxOpen}
                  className="h-9 w-full justify-between"
                >
                  {selectedStatus
                    ? statusOptions.find(
                        (status) => status.value === selectedStatus,
                      )?.label
                    : "Select status..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-h-[200px] w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search status..."
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>No status found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value=""
                        onSelect={() => {
                          setSelectedStatus("");
                          setStatusComboboxOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedStatus === "" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        No status
                      </CommandItem>
                      {statusOptions.map((status) => (
                        <CommandItem
                          key={status.value}
                          value={status.label}
                          onSelect={() => {
                            setSelectedStatus(status.value);
                            setStatusComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedStatus === status.value
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {status.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || !key.trim() || createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
