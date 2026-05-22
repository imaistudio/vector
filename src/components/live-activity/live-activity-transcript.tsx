'use client';

import type { Id } from '@/convex/_generated/dataModel';
import type { LiveActivityStatus } from '@/convex/_shared/agentBridge';
import { VectorAgentChatPanel } from '@/components/agent-session/vector-agent-chat-panel';

export function LiveActivityTranscript({
  liveActivityId,
  isOwner,
  currentUser,
}: {
  liveActivityId: Id<'issueLiveActivities'>;
  isOwner: boolean;
  status: LiveActivityStatus;
  currentUser?: {
    name: string;
    email: string | null;
    image: string | null;
    _id: string;
  } | null;
}) {
  return (
    <VectorAgentChatPanel
      liveActivityId={liveActivityId}
      isOwner={isOwner}
      currentUser={currentUser}
      mode='embedded'
    />
  );
}
