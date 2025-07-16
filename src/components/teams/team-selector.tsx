"use client";

import { useState } from "react";
// UI primitives
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// Utils
import { cn } from "@/lib/utils";
import { getDynamicIcon } from "@/lib/dynamic-icons";

// Icons
import { Check, Circle, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Shared display mode type (duplicated to avoid cross-file coupling)
// ---------------------------------------------------------------------------
export type SelectorDisplayMode =
  | "default"
  | "labelOnly"
  | "iconOnly"
  | "iconWhenUnselected";

function resolveVisibility(
  mode: SelectorDisplayMode | undefined,
  hasSelection: boolean,
): { showIcon: boolean; showLabel: boolean } {
  switch (mode) {
    case "labelOnly":
      return { showIcon: false, showLabel: true };
    case "iconOnly":
      return { showIcon: true, showLabel: false };
    case "iconWhenUnselected":
      return { showIcon: true, showLabel: hasSelection };
    case "default":
    default:
      return { showIcon: true, showLabel: true };
  }
}

// ---------------------------------------------------------------------------
// Public props – kept generic so any consumer can provide its own Team shape
// ---------------------------------------------------------------------------
export interface TeamSelectorProps<
  T extends {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
  },
> {
  teams: readonly T[] | T[];
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

/**
 * Shared TeamSelector used across Issues & Projects.
 * Accepts a list of teams and shows a searchable combobox drop-down.
 *
 * Features:
 * - Supports team icons and colors from the database
 * - Falls back to Circle icon and grey color (#94a3b8) when none are set
 * - Uses the same pattern as status selectors for consistency
 */
export function TeamSelector<
  T extends {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
  },
>({
  teams,
  selectedTeam,
  onTeamSelect,
  displayMode,
  trigger,
  className,
  align = "start",
}: TeamSelectorProps<T> & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);

  const hasSelection = selectedTeam !== "";
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  // Get selected team data
  const selectedTeamObj = teams.find((t) => t.id === selectedTeam);
  const currentColor = selectedTeamObj?.color || "#94a3b8"; // Default grey
  const currentName = selectedTeamObj?.name || "Team";
  const currentIconName = selectedTeamObj?.icon;
  const CurrentIcon = currentIconName
    ? getDynamicIcon(currentIconName) || Circle
    : Circle;

  const DefaultBtn = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon &&
        (selectedTeam ? (
          CurrentIcon ? (
            <CurrentIcon className="h-3 w-3" style={{ color: currentColor }} />
          ) : (
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )
        ) : (
          <Users className="h-3 w-3" />
        ))}
      {showLabel && currentName}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
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
              {teams.map((team) => {
                const Icon = team.icon
                  ? getDynamicIcon(team.icon) || Circle
                  : Circle;
                return (
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
                    <Icon
                      className="mr-2 h-3 w-3"
                      style={{ color: team.color || "#94a3b8" }}
                    />
                    {team.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
