"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import { Settings2, Clock, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface StateData {
  id?: string;
  name: string;
  position: number;
  color: string | null;
  type: string;
}

interface StatesManagementDialogProps {
  type: "issue" | "project";
  state?: StateData;
  existingStates: StateData[];
  onClose: () => void;
  onSave: (state: Omit<StateData, "id">) => void;
  orgSlug?: string;
}

const DEFAULT_COLORS = [
  "#94a3b8", // slate-400
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#6b7280", // gray-500
];

// Linear-inspired state types
const ISSUE_STATE_TYPES = [
  { value: "backlog", label: "Backlog", description: "Not yet started" },
  { value: "todo", label: "To Do", description: "Ready to be worked on" },
  {
    value: "in_progress",
    label: "In Progress",
    description: "Currently being worked on",
  },
  { value: "done", label: "Done", description: "Completed work" },
  {
    value: "canceled",
    label: "Canceled",
    description: "Work that was canceled",
  },
];

const PROJECT_STATUS_TYPES = [
  { value: "backlog", label: "Backlog", description: "Ideas and future work" },
  { value: "planned", label: "Planned", description: "Scheduled for future" },
  {
    value: "in_progress",
    label: "In Progress",
    description: "Active development",
  },
  {
    value: "completed",
    label: "Completed",
    description: "Successfully finished",
  },
  { value: "canceled", label: "Canceled", description: "Project was canceled" },
];

export function StatesManagementDialog({
  type,
  state,
  existingStates,
  onClose,
  onSave,
  orgSlug,
}: StatesManagementDialogProps) {
  const utils = trpc.useUtils();
  const deleteIssueMutation = trpc.organization.deleteIssueState.useMutation({
    onSuccess: () => {
      utils.organization.listIssueStates
        .invalidate({ orgSlug: orgSlug! })
        .catch(() => {});
      onClose();
    },
  });
  const deleteStatusMutation =
    trpc.organization.deleteProjectStatus.useMutation({
      onSuccess: () => {
        utils.organization.listProjectStatuses
          .invalidate({ orgSlug: orgSlug! })
          .catch(() => {});
        onClose();
      },
    });
  const [name, setName] = useState(state?.name || "");
  const [color, setColor] = useState(state?.color || DEFAULT_COLORS[0]);
  const [stateType, setStateType] = useState(
    state?.type || (type === "issue" ? "todo" : "planned"),
  );
  const [typeComboboxOpen, setTypeComboboxOpen] = useState(false);

  const isEditing = !!state;
  const IconComponent = type === "issue" ? Settings2 : Clock;
  const title = `${isEditing ? "Edit" : "Add"} ${type === "issue" ? "Issue State" : "Project Status"}`;

  const typeOptions =
    type === "issue" ? ISSUE_STATE_TYPES : PROJECT_STATUS_TYPES;
  const selectedTypeInfo = typeOptions.find((t) => t.value === stateType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Calculate position for new states (at the end)
    const maxPosition = Math.max(-1, ...existingStates.map((s) => s.position));
    const position = isEditing ? state.position : maxPosition + 1;

    onSave({
      name: name.trim(),
      position,
      color,
      type: stateType,
    });
  };

  const handleDelete = () => {
    if (!state?.id || !orgSlug) return;
    if (
      !confirm("Are you sure you want to delete this? This cannot be undone.")
    )
      return;

    if (type === "issue") {
      deleteIssueMutation.mutate({ orgSlug, stateId: state.id });
    } else {
      deleteStatusMutation.mutate({ orgSlug, statusId: state.id });
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <IconComponent className="size-4" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder={`${type === "issue" ? "State" : "Status"} name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          {/* Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Popover open={typeComboboxOpen} onOpenChange={setTypeComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={typeComboboxOpen}
                  className="h-9 w-full justify-between"
                >
                  {selectedTypeInfo ? selectedTypeInfo.label : "Select type..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-h-[200px] w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search type..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No type found.</CommandEmpty>
                    <CommandGroup>
                      {typeOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={(currentValue) => {
                            setStateType(currentValue);
                            setTypeComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              stateType === option.value
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedTypeInfo && (
              <p className="text-muted-foreground text-xs">
                {selectedTypeInfo.description}
              </p>
            )}
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  className={`size-8 rounded-md border-2 transition-all ${
                    color === colorOption
                      ? "border-foreground scale-110"
                      : "border-border hover:scale-105"
                  }`}
                  style={{ backgroundColor: colorOption }}
                  onClick={() => setColor(colorOption)}
                />
              ))}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <div
                className="size-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {name || `${type === "issue" ? "State" : "Status"} name`}
            </div>
          </div>
        </form>

        <DialogFooter>
          {isEditing && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={
                deleteIssueMutation.isPending || deleteStatusMutation.isPending
              }
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            {isEditing
              ? "Save Changes"
              : `Add ${type === "issue" ? "State" : "Status"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
