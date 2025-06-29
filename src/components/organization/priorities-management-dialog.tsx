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
import { Hash } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { IconPicker } from "@/components/ui/icon-picker";

interface PriorityData {
  id?: string;
  name: string;
  weight: number;
  color: string | null;
  icon: string | null;
}

interface PrioritiesManagementDialogProps {
  priority?: PriorityData;
  existingPriorities: PriorityData[];
  onClose: () => void;
  onSave: (priority: Omit<PriorityData, "id">) => void;
  orgSlug?: string;
}

const DEFAULT_COLORS = [
  "#94a3b8", // slate-400
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#dc2626", // red-600
];

export function PrioritiesManagementDialog({
  priority,
  existingPriorities,
  onClose,
  onSave,
  orgSlug,
}: PrioritiesManagementDialogProps) {
  const utils = trpc.useUtils();
  const deleteMutation = trpc.organization.deleteIssuePriority.useMutation({
    onSuccess: () => {
      utils.organization.listIssuePriorities
        .invalidate({ orgSlug: orgSlug! })
        .catch(() => {});
      onClose();
    },
  });

  const [name, setName] = useState(priority?.name || "");
  const [color, setColor] = useState(priority?.color || DEFAULT_COLORS[0]);
  const [icon, setIcon] = useState(priority?.icon || null);
  const [weight, setWeight] = useState(priority?.weight ?? 0);

  const isEditing = !!priority;
  const title = `${isEditing ? "Edit" : "Add"} Priority`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Determine next weight value (max + 1) if creating new without explicit weight
    const maxWeight = Math.max(-1, ...existingPriorities.map((p) => p.weight));
    const finalWeight = isEditing ? weight : maxWeight + 1;

    onSave({
      name: name.trim(),
      weight: finalWeight,
      color,
      icon,
    });
  };

  const handleDelete = () => {
    if (!priority?.id || !orgSlug) return;
    if (
      !confirm(
        "Are you sure you want to delete this priority? This cannot be undone.",
      )
    )
      return;

    deleteMutation.mutate({ orgSlug, priorityId: priority.id });
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Hash className="size-4" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder="Priority name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          {/* Weight */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Weight (ordering)</label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value, 10) || 0)}
              className="h-9"
            />
            <p className="text-muted-foreground text-xs">
              Higher weight indicates higher priority. Values must be integers.
            </p>
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Icon</label>
            <IconPicker
              value={icon}
              onValueChange={setIcon}
              placeholder="Select an icon..."
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`size-8 rounded-md border-2 transition-all ${
                    color === c
                      ? "border-foreground scale-110"
                      : "border-border hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4 flex justify-between">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
