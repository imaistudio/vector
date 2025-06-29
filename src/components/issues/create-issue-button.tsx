"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateIssueDialog } from "./create-issue-dialog";

interface CreateIssueButtonProps {
  orgSlug: string;
  onIssueCreated?: () => void;
  variant?: "default" | "floating";
}

export function CreateIssueButton({
  orgSlug,
  onIssueCreated,
  variant = "default",
}: CreateIssueButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onIssueCreated?.();
    setIsDialogOpen(false);
  };

  if (variant === "floating") {
    return (
      <>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
          size="icon"
        >
          <Plus className="h-5 w-5" />
        </Button>

        {isDialogOpen && (
          <CreateIssueDialog
            orgSlug={orgSlug}
            onClose={() => setIsDialogOpen(false)}
            onSuccess={handleSuccess}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setIsDialogOpen(true)}
        className="gap-1 text-sm"
        variant="outline"
      >
        <Plus className="size-4" />
      </Button>

      {isDialogOpen && (
        <CreateIssueDialog
          orgSlug={orgSlug}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
