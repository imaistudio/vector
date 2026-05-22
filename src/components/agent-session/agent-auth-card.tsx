'use client';

import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PendingAgentApproval } from '@/lib/local-agents/types';

export function AgentAuthCard({
  approval,
  onApprove,
  onDeny,
}: {
  approval: PendingAgentApproval;
  onApprove: (approveForSession: boolean) => void;
  onDeny: () => void;
}) {
  return (
    <div className='border-border bg-muted/30 mx-3 my-2 rounded-md border px-3 py-2'>
      <div className='flex items-start gap-2'>
        <ShieldCheck className='text-muted-foreground mt-0.5 size-4 shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='text-sm font-medium'>{approval.title}</div>
          {approval.detail ? (
            <pre className='text-muted-foreground mt-1 max-h-28 overflow-auto text-xs whitespace-pre-wrap'>
              {approval.detail}
            </pre>
          ) : null}
          {approval.reason ? (
            <p className='text-muted-foreground mt-1 text-xs'>
              {approval.reason}
            </p>
          ) : null}
        </div>
      </div>
      <div className='mt-2 flex justify-end gap-1'>
        <Button size='xs' variant='ghost' onClick={onDeny}>
          <X className='size-3' />
          Deny
        </Button>
        {approval.canApproveForSession ? (
          <Button size='xs' variant='secondary' onClick={() => onApprove(true)}>
            Approve session
          </Button>
        ) : null}
        <Button size='xs' onClick={() => onApprove(false)}>
          Approve
        </Button>
      </div>
    </div>
  );
}
