"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Circle, Users, User, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDynamicIcon } from "@/lib/dynamic-icons";

// Re-export types for convenience
export type Status = {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  type: string;
};

export type Team = {
  id: string;
  name: string;
  key: string;
};

export type Member = {
  userId: string;
  name: string;
  email: string;
};

// Helper function for initials
function getInitials(name?: string | null, email?: string | null): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Status Selector Component
interface StatusSelectorProps {
  statuses: ReadonlyArray<Status>;
  selectedStatus: string;
  onStatusSelect: (statusId: string) => void;
  displayMode?: "full" | "iconOnly" | "iconWhenUnselected";
  trigger?: React.ReactNode;
  className?: string;
}

export function StatusSelector({
  statuses,
  selectedStatus,
  onStatusSelect,
  displayMode = "full",
  trigger,
  className,
}: StatusSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedStatusObj = statuses.find((s) => s.id === selectedStatus);
  const StatusIcon = selectedStatusObj?.icon
    ? getDynamicIcon(selectedStatusObj.icon) || Circle
    : Circle;
  const statusColor = selectedStatusObj?.color || "#94a3b8";

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      <StatusIcon className="h-3 w-3" style={{ color: statusColor }} />
      {(displayMode === "full" ||
        (displayMode === "iconWhenUnselected" && selectedStatus)) && (
        <span className="text-sm">{selectedStatusObj?.name || "Status"}</span>
      )}
    </Button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger || defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {statuses.map((status) => {
          const Icon = status.icon
            ? getDynamicIcon(status.icon) || Circle
            : Circle;
          return (
            <DropdownMenuItem
              key={status.id}
              onClick={() => {
                onStatusSelect(status.id);
                setOpen(false);
              }}
              className="flex items-center gap-2"
            >
              <Icon
                className="size-4"
                style={{ color: status.color || "#94a3b8" }}
              />
              {status.name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Team Selector Component
interface TeamSelectorProps {
  teams: ReadonlyArray<Team>;
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
  displayMode?: "full" | "iconOnly" | "iconWhenUnselected";
  className?: string;
}

// Deprecated local implementation renamed to avoid export conflicts
function _DeprecatedTeamSelector({
  teams,
  selectedTeam,
  onTeamSelect,
  displayMode = "full",
  className,
}: TeamSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedTeamObj = teams.find((t) => t.id === selectedTeam);

  if (displayMode === "iconWhenUnselected" && !selectedTeam) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "bg-muted/30 hover:bg-muted/50 h-8 w-8 p-0",
              className,
            )}
          >
            <Users className="text-muted-foreground h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onClick={() => {
              onTeamSelect("");
              setOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <Users className="text-muted-foreground size-4" />
            No team
          </DropdownMenuItem>
          {teams.map((team) => (
            <DropdownMenuItem
              key={team.id}
              onClick={() => {
                onTeamSelect(team.id);
                setOpen(false);
              }}
              className="flex items-center gap-2"
            >
              <Users className="size-4" />
              {team.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (selectedTeamObj) {
    return (
      <Badge variant="secondary" className="text-xs">
        {selectedTeamObj.key}
      </Badge>
    );
  }

  return null;
}

// Lead/Assignee Selector Component
interface LeadSelectorProps {
  members: ReadonlyArray<Member>;
  selectedLead: string;
  onLeadSelect: (leadId: string) => void;
  displayMode?: "full" | "iconOnly" | "iconWhenUnselected";
  trigger?: React.ReactNode;
  className?: string;
}

export function LeadSelector({
  members,
  selectedLead,
  onLeadSelect,
  displayMode = "full",
  trigger,
  className,
}: LeadSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedLeadObj = members.find((m) => m.userId === selectedLead);

  const defaultTrigger = selectedLead ? (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      <Avatar className="size-5">
        <AvatarFallback className="text-xs">
          {getInitials(selectedLeadObj?.name, selectedLeadObj?.email)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm">{selectedLeadObj?.name}</span>
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
      <User className="text-muted-foreground h-3 w-3" />
      <span className="text-sm">Lead</span>
    </Button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger || defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => {
            onLeadSelect("");
            setOpen(false);
          }}
          className="flex items-center gap-2"
        >
          <User className="text-muted-foreground size-4" />
          No lead
        </DropdownMenuItem>
        {members.map((member) => (
          <DropdownMenuItem
            key={member.userId}
            onClick={() => {
              onLeadSelect(member.userId);
              setOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <Avatar className="size-5">
              <AvatarFallback className="text-xs">
                {getInitials(member.name, member.email)}
              </AvatarFallback>
            </Avatar>
            {member.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
