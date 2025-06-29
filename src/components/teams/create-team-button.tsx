"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateTeamDialog } from "./create-team-dialog";
import { Plus } from "lucide-react";

interface CreateTeamButtonProps {
  orgSlug: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
}

export function CreateTeamButton({
  orgSlug,
  variant = "default",
  size = "sm",
  children,
}: CreateTeamButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setShowDialog(true)}>
        <Plus className="mr-1 size-3" />
        {children || "Create team"}
      </Button>

      {showDialog && (
        <CreateTeamDialog
          orgSlug={orgSlug}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}
