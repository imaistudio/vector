export interface PendingAgentApproval {
  kind: 'command' | 'file-change';
  title: string;
  detail?: string | null;
  reason?: string | null;
  command?: string | null;
  cwd?: string | null;
  grantRoot?: string | null;
  canApproveForSession?: boolean;
  createdAt: number;
}

export function commandApproval(
  title: string,
  command: string,
  cwd?: string,
): PendingAgentApproval {
  return {
    kind: 'command',
    title,
    command,
    cwd,
    detail: command,
    canApproveForSession: true,
    createdAt: Date.now(),
  };
}
