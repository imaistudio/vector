"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

interface ProjectLeadSelectorProps {
  orgSlug: string;
  projectId?: string; // Optional - if provided, we're editing an existing project
  selectedLead: string;
  onLeadSelect: (leadId: string) => void;
  displayMode?: "full" | "iconOnly" | "iconWhenUnselected";
  trigger?: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}

function getInitials(name: string | null, email: string | undefined): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProjectLeadSelector({
  orgSlug,
  projectId,
  selectedLead,
  onLeadSelect,
  displayMode = "full",
  trigger,
  className,
  align = "start",
}: ProjectLeadSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;

  // Fetch organization members (for project creation)
  const { data: orgMembers = [] } = trpc.organization.listMembers.useQuery(
    { orgSlug },
    { enabled: !projectId }, // Only fetch org members when creating
  );

  // Fetch project members (for project editing)
  const { data: projectMembers = [] } = trpc.project.listMembers.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }, // Only fetch project members when editing
  );

  // Determine which members to show and sort them
  const members = projectId ? projectMembers : orgMembers;

  // Sort members: current user first, then alphabetically by name
  const sortedMembers = [...members].sort((a, b) => {
    // Current user always comes first
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;

    // Then sort by name
    const nameA = a.name || a.email;
    const nameB = b.name || b.email;
    return nameA.localeCompare(nameB);
  });

  const selectedLeadObj = sortedMembers.find((m) => m.userId === selectedLead);

  const hasSelection = selectedLead !== "";
  const showIcon =
    displayMode === "iconOnly" ||
    (displayMode === "iconWhenUnselected" && !hasSelection);
  const showLabel =
    displayMode === "full" ||
    (displayMode === "iconWhenUnselected" && hasSelection);

  const defaultTrigger = selectedLead ? (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      <Avatar className="size-5">
        <AvatarFallback className="text-xs">
          {getInitials(selectedLeadObj?.name ?? null, selectedLeadObj?.email)}
        </AvatarFallback>
      </Avatar>
      {showLabel && (
        <span className="text-sm">
          {selectedLeadObj?.name || selectedLeadObj?.email}
        </span>
      )}
    </Button>
  ) : displayMode === "iconWhenUnselected" ? (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 w-8 p-0", className)}
    >
      <User className="text-muted-foreground h-3 w-3" />
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon && <User className="text-muted-foreground h-3 w-3" />}
      {showLabel && <span className="text-sm">Lead</span>}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger || defaultTrigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput
            placeholder={
              projectId ? "Search project members..." : "Search members..."
            }
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              {projectId ? "No project members found." : "No members found."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onLeadSelect("");
                  setOpen(false);
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
              {sortedMembers.map((member) => (
                <CommandItem
                  key={member.userId}
                  value={member.name || member.email}
                  onSelect={() => {
                    onLeadSelect(member.userId);
                    setOpen(false);
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
                  <Avatar className="mr-2 size-5">
                    <AvatarFallback className="text-xs">
                      {getInitials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm">
                      {member.name || member.email}
                      {member.userId === currentUserId && (
                        <span className="text-muted-foreground ml-1">
                          (you)
                        </span>
                      )}
                    </span>
                    {member.name && (
                      <span className="text-muted-foreground text-xs">
                        {member.email}
                      </span>
                    )}
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
