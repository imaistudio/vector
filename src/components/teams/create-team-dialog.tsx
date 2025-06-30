"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
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
import { Users, Plus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 🧩 Internal content component (dialog body)
// ---------------------------------------------------------------------------
interface CreateTeamDialogContentProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (teamId: string) => void;
}

function CreateTeamDialogContent({
  orgSlug,
  onClose,
  onSuccess,
}: CreateTeamDialogContentProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [leadComboboxOpen, setLeadComboboxOpen] = useState(false);

  const utils = trpc.useUtils();

  // Get organization members for lead selection
  const { data: orgMembers = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });

  const createMutation = trpc.team.create.useMutation({
    onSuccess: (result) => {
      // Refresh teams list so the UI updates
      utils.organization.listTeams.invalidate({ orgSlug }).catch(() => {});
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
      key: key.trim().toUpperCase(),
      description: description.trim() || undefined,
      leadId: selectedLead || undefined,
    });
  };

  // Auto-generate key from name (alphanumeric, max 10 chars)
  const handleNameChange = (value: string) => {
    setName(value);
    if (
      !key ||
      key ===
        value
          .replace(/[^A-Z0-9]/gi, "")
          .slice(0, 10)
          .toUpperCase()
    ) {
      setKey(
        value
          .replace(/[^A-Z0-9]/gi, "")
          .slice(0, 10)
          .toUpperCase(),
      );
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Create team
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Team name</label>
            <Input
              placeholder="e.g. Engineering, Marketing, Design"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus
            />
          </div>

          {/* Team Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Team key</label>
            <Input
              placeholder="e.g. ENG, MKT, DES"
              value={key}
              onChange={(e) =>
                setKey(e.target.value.toUpperCase().slice(0, 10))
              }
              maxLength={10}
            />
            <p className="text-muted-foreground text-xs">
              Used as prefix for issue IDs (e.g. {key || "ENG"}-123)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description (optional)
            </label>
            <textarea
              placeholder="What does this team work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Team Lead */}
          {orgMembers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Team lead (optional)
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
                      : "Select team lead..."}
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
            {createMutation.isPending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 🖱️ Public wrapper — handles trigger button + open state
// ---------------------------------------------------------------------------
export interface CreateTeamDialogProps {
  /** Organization slug the team belongs to */
  orgSlug: string;
  /** Optional callback fired after the team is successfully created */
  onTeamCreated?: () => void;
  /** Visual style of trigger button */
  variant?: "default" | "floating";
  /** Additional classes for the trigger button */
  className?: string;
}

export function CreateTeamDialog({
  orgSlug,
  onTeamCreated,
  variant = "default",
  className,
}: CreateTeamDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onTeamCreated?.();
    setIsDialogOpen(false);
  };

  const trigger =
    variant === "floating" ? (
      <Button
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          "h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl",
          className,
        )}
        size="icon"
      >
        <Plus className="h-5 w-5" />
      </Button>
    ) : (
      <Button
        size="sm"
        onClick={() => setIsDialogOpen(true)}
        className={cn("gap-1 text-sm", className)}
        variant="outline"
      >
        <Plus className="size-4" />
      </Button>
    );

  return (
    <>
      {trigger}
      {isDialogOpen && (
        <CreateTeamDialogContent
          orgSlug={orgSlug}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
