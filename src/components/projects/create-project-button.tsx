"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "./create-project-dialog";
import { Plus } from "lucide-react";

interface CreateProjectButtonProps {
  orgSlug: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
}

export function CreateProjectButton({
  orgSlug,
  variant = "default",
  size = "sm",
  children,
}: CreateProjectButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setShowDialog(true)}>
        <Plus className="mr-1 size-3" />
        {children || "Create project"}
      </Button>

      {showDialog && (
        <CreateProjectDialog
          orgSlug={orgSlug}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}
