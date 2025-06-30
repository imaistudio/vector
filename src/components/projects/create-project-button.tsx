"use client";

import type React from "react";
import { CreateProjectDialog } from "./create-project-dialog";

/**
 * Thin wrapper kept for backwards-compatibility. Accepts the previous props
 * (`size`, etc.) but forwards to the unified `CreateProjectDialog` component.
 */
interface LegacyCreateProjectButtonProps
  extends React.ComponentProps<typeof CreateProjectDialog> {
  /** Optional size prop kept for API parity but not used. */
  size?: "default" | "sm" | "lg" | "icon";
}

export function CreateProjectButton({
  size: _size,
  ...rest
}: LegacyCreateProjectButtonProps) {
  // `_size` is ignored – sizing is handled internally.
  return <CreateProjectDialog {...rest} />;
}
