'use client';

import {
  useState,
  useCallback,
  useId,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useCachedQuery, useMutation } from '@/lib/convex';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { UserAvatar } from '@/components/user-avatar';
import { RichEditor } from '@/components/ui/rich-editor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pencil,
  Trash2,
  X,
  Check,
  ChevronUp,
  ArrowUp,
  Sparkles,
} from 'lucide-react';
import { formatDateHuman } from '@/lib/date';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BarsSpinner } from '@/components/bars-spinner';
import type { ActivityFeedItem } from '@/components/activity/activity-feed-list';
import { getActivityIcon } from '@/lib/activity-icons';
import { useConfirm } from '@/hooks/use-confirm';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommentAuthor {
  _id: string;
  name: string;
  email: string | null;
  image: string | null;
}

interface Comment {
  _id: Id<'comments'>;
  _creationTime: number;
  issueId?: Id<'issues'>;
  requestId?: Id<'requests'>;
  documentId?: Id<'documents'>;
  authorId: Id<'users'>;
  body: string;
  deleted: boolean;
  parentId?: Id<'comments'>;
  agentStatus?: 'thinking' | 'done' | 'error';
  author: CommentAuthor | null;
}

interface PendingComment {
  localId: string;
  body: string;
  createdAt: number;
  parentId?: Id<'comments'>;
}

type FeedEntry =
  | { type: 'comment'; data: Comment; timestamp: number }
  | { type: 'activity'; data: ActivityFeedItem; timestamp: number }
  | { type: 'pending'; data: PendingComment; timestamp: number };

type EditComment = (commentId: Id<'comments'>, body: string) => Promise<void>;
type DeleteComment = (commentId: Id<'comments'>) => Promise<void>;

const COLLAPSE_HEIGHT = 150; // px — collapse comments taller than this

function useOverflows(ref: React.RefObject<HTMLDivElement | null>) {
  // Track whether the content overflows COLLAPSE_HEIGHT using ResizeObserver
  return useSyncExternalStore(
    onStoreChange => {
      const el = ref.current;
      if (!el) return () => {};
      const ro = new ResizeObserver(() => onStoreChange());
      ro.observe(el);
      return () => ro.disconnect();
    },
    () => (ref.current ? ref.current.scrollHeight > COLLAPSE_HEIGHT : false),
    () => false,
  );
}

function CollapsibleBody({
  children,
  defaultExpanded = false,
}: {
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const overflows = useOverflows(contentRef);
  const collapsed = overflows && !expanded;

  return (
    <div className='relative'>
      <div
        ref={contentRef}
        className={collapsed ? 'overflow-hidden' : undefined}
        style={collapsed ? { maxHeight: COLLAPSE_HEIGHT } : undefined}
      >
        {children}
      </div>
      {collapsed && (
        <>
          <div className='from-background pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t' />
          <button
            type='button'
            onClick={() => setExpanded(true)}
            className='text-muted-foreground hover:text-foreground mt-1 cursor-pointer text-xs font-medium'
          >
            Show more
          </button>
        </>
      )}
    </div>
  );
}

// ─── Inline Reply Input ──────────────────────────────────────────────────────

function InlineReplyInput({
  orgSlug,
  currentUser,
  onSubmit,
}: {
  orgSlug: string;
  currentUser: CommentAuthor | null;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody('');
    } catch {
      // The entity-specific submitter reports the error and keeps the draft.
    } finally {
      setIsSubmitting(false);
    }
  }, [body, isSubmitting, onSubmit]);

  return (
    <div className='flex items-center gap-2'>
      <UserAvatar
        name={currentUser?.name}
        email={currentUser?.email}
        image={currentUser?.image}
        userId={currentUser?._id}
        size='sm'
        className='size-6 shrink-0'
      />
      <div
        className='min-w-0 flex-1'
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <RichEditor
          value={body}
          onChange={setBody}
          placeholder='Leave a reply... Use @ to mention'
          mode='compact'
          borderless
          orgSlug={orgSlug}
          showPlaceholderOnlyCurrent={false}
          className='[&_.tiptap]:min-h-[24px] [&_.tiptap]:p-0 [&_.tiptap]:text-sm [&_.tiptap]:leading-6'
        />
      </div>
      <Button
        size='sm'
        className='size-7 shrink-0 cursor-pointer rounded-md p-0'
        onClick={() => void submit()}
        disabled={!body.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <BarsSpinner size={10} />
        ) : (
          <ArrowUp className='size-2.5' />
        )}
      </Button>
    </div>
  );
}

// ─── Single Reply (compact, no border card) ──────────────────────────────────

function ReplyItem({
  comment,
  currentUserId,
  orgSlug,
  isPending,
  onEditComment,
  onDeleteComment,
}: {
  comment: Comment;
  currentUserId: string;
  orgSlug: string;
  isPending?: boolean;
  onEditComment: EditComment;
  onDeleteComment: DeleteComment;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm();
  const isOwner = comment.authorId === currentUserId;

  const handleSaveEdit = useCallback(async () => {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === comment.body) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEditComment(comment._id, trimmed);
      setIsEditing(false);
    } catch {
      toast.error('Failed to edit reply');
    } finally {
      setSaving(false);
    }
  }, [editBody, comment._id, comment.body, onEditComment]);

  const handleDelete = useCallback(async () => {
    const confirmed = await confirmDelete({
      title: 'Delete reply',
      description: 'This reply will be removed from the discussion.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onDeleteComment(comment._id);
    } catch {
      toast.error('Failed to delete reply');
    } finally {
      setDeleting(false);
    }
  }, [comment._id, confirmDelete, onDeleteComment]);

  return (
    <>
      <div className={cn('group/reply', isPending && 'opacity-50')}>
        {/* Header — same layout as parent comment */}
        <div className='flex items-center gap-2 px-3 pt-2.5 pb-1'>
          {comment.agentStatus ? (
            <div className='bg-primary/10 flex size-6 shrink-0 items-center justify-center rounded-full'>
              <Sparkles className='text-primary size-3.5' />
            </div>
          ) : (
            <UserAvatar
              name={comment.author?.name}
              email={comment.author?.email}
              image={comment.author?.image}
              userId={comment.author?._id}
              size='sm'
              className='size-6 shrink-0'
            />
          )}
          <span className='text-sm font-medium'>
            {comment.agentStatus
              ? 'Vector'
              : (comment.author?.name ?? 'Unknown')}
          </span>
          <span className='text-muted-foreground text-xs'>
            {formatDateHuman(new Date(comment._creationTime))}
          </span>
          {isOwner && !isEditing && !isPending && (
            <div className='ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/reply:opacity-100'>
              <button
                type='button'
                onClick={() => {
                  setEditBody(comment.body);
                  setIsEditing(true);
                }}
                className='text-muted-foreground hover:text-foreground rounded p-1 transition-colors'
              >
                <Pencil className='size-3' />
              </button>
              <button
                type='button'
                onClick={() => void handleDelete()}
                disabled={deleting}
                className='text-muted-foreground hover:text-destructive rounded p-1 transition-colors'
              >
                {deleting ? (
                  <BarsSpinner size={12} />
                ) : (
                  <Trash2 className='size-3' />
                )}
              </button>
            </div>
          )}
        </div>
        {/* Body */}
        <div className='px-3 pb-2.5'>
          {comment.agentStatus === 'thinking' ? (
            <div className='text-muted-foreground flex items-center gap-2 py-1 text-sm'>
              <BarsSpinner size={12} />
              <span>Thinking...</span>
            </div>
          ) : isEditing ? (
            <div>
              <div className='rounded-md border'>
                <RichEditor
                  value={editBody}
                  onChange={setEditBody}
                  disabled={saving}
                  mode='compact'
                  borderless
                  orgSlug={orgSlug}
                  className='px-2.5 py-1.5 [&_.tiptap]:min-h-[40px]'
                />
              </div>
              <div className='mt-1 flex items-center gap-1'>
                <Button
                  size='sm'
                  className='h-6 cursor-pointer gap-1 px-2 text-xs'
                  onClick={() => void handleSaveEdit()}
                  disabled={!editBody.trim() || saving}
                >
                  {saving ? (
                    <BarsSpinner size={12} />
                  ) : (
                    <Check className='size-3' />
                  )}
                  {saving ? 'Saving' : 'Save'}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-6 cursor-pointer gap-1 px-2 text-xs'
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  <X className='size-3' />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <CollapsibleBody defaultExpanded={!!comment.agentStatus}>
              <RichEditor
                value={comment.body}
                onChange={() => {}}
                disabled
                mode='compact'
                borderless
                orgSlug={orgSlug}
                className='[&_.tiptap]:min-h-0 [&_.tiptap]:p-0'
              />
            </CollapsibleBody>
          )}
        </div>
      </div>
      <ConfirmDeleteDialog />
    </>
  );
}

// ─── Comment Card (Linear-style bordered block with replies) ─────────────────

function CommentCard({
  comment,
  replies,
  pendingReplies,
  currentUserId,
  currentUser,
  orgSlug,
  isPending,
  onReply,
  onEditComment,
  onDeleteComment,
}: {
  comment: Comment;
  replies: Comment[];
  pendingReplies: PendingComment[];
  currentUserId: string;
  currentUser: CommentAuthor | null;
  orgSlug: string;
  isPending?: boolean;
  onReply: (parentId: Id<'comments'>, body: string) => Promise<void>;
  onEditComment: EditComment;
  onDeleteComment: DeleteComment;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isReplying, setIsReplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm();
  const isOwner = comment.authorId === currentUserId;

  const handleSaveEdit = useCallback(async () => {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === comment.body) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEditComment(comment._id, trimmed);
      setIsEditing(false);
    } catch {
      toast.error('Failed to edit comment');
    } finally {
      setSaving(false);
    }
  }, [editBody, comment._id, comment.body, onEditComment]);

  const handleDelete = useCallback(async () => {
    const confirmed = await confirmDelete({
      title: 'Delete comment',
      description: 'This comment will be removed from the discussion.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onDeleteComment(comment._id);
    } catch {
      toast.error('Failed to delete comment');
    } finally {
      setDeleting(false);
    }
  }, [comment._id, confirmDelete, onDeleteComment]);

  return (
    <>
      <div
        className={cn(
          'group/comment rounded-lg border',
          isPending && 'opacity-50',
        )}
      >
        {/* Header */}
        <div className='flex items-center gap-2 px-3 pt-2.5 pb-1'>
          <UserAvatar
            name={comment.author?.name}
            email={comment.author?.email}
            image={comment.author?.image}
            userId={comment.author?._id}
            size='sm'
            className='size-6 shrink-0'
          />
          <span className='text-sm font-medium'>
            {comment.author?.name ?? 'Unknown user'}
          </span>
          <span className='text-muted-foreground text-xs'>
            {formatDateHuman(new Date(comment._creationTime))}
          </span>
          {!isPending && (
            <div className='ml-auto flex items-center gap-1'>
              <button
                type='button'
                onClick={() => setIsReplying(current => !current)}
                className='text-muted-foreground hover:text-foreground hover:bg-muted h-6 cursor-pointer rounded-md px-2 text-xs font-medium transition-colors'
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
              {isOwner && !isEditing && (
                <div className='flex items-center gap-0.5 opacity-0 transition-opacity group-hover/comment:opacity-100'>
                  <button
                    type='button'
                    onClick={() => {
                      setEditBody(comment.body);
                      setIsEditing(true);
                    }}
                    className='text-muted-foreground hover:text-foreground rounded p-1 transition-colors'
                  >
                    <Pencil className='size-3' />
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className='text-muted-foreground hover:text-destructive rounded p-1 transition-colors'
                  >
                    {deleting ? (
                      <BarsSpinner size={12} />
                    ) : (
                      <Trash2 className='size-3' />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className='px-3 pb-2.5'>
          {isEditing ? (
            <div>
              <div className='rounded-md border'>
                <RichEditor
                  value={editBody}
                  onChange={setEditBody}
                  disabled={saving}
                  mode='compact'
                  borderless
                  orgSlug={orgSlug}
                  className='px-2.5 py-1.5 [&_.tiptap]:min-h-[60px]'
                />
              </div>
              <div className='mt-1.5 flex items-center gap-1'>
                <Button
                  size='sm'
                  className='h-6 cursor-pointer gap-1 px-2 text-xs'
                  onClick={() => void handleSaveEdit()}
                  disabled={!editBody.trim() || saving}
                >
                  {saving ? (
                    <BarsSpinner size={12} />
                  ) : (
                    <Check className='size-3' />
                  )}
                  {saving ? 'Saving' : 'Save'}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-6 cursor-pointer gap-1 px-2 text-xs'
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  <X className='size-3' />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <CollapsibleBody>
              <RichEditor
                value={comment.body}
                onChange={() => {}}
                disabled
                mode='compact'
                borderless
                orgSlug={orgSlug}
                className='[&_.tiptap]:min-h-0 [&_.tiptap]:p-0'
              />
            </CollapsibleBody>
          )}
        </div>

        {/* Replies — each separated by a full-width divider */}
        {replies.map(reply => (
          <div key={`r-${reply._id}`}>
            <div className='border-t' />
            <ReplyItem
              comment={reply}
              currentUserId={currentUserId}
              orgSlug={orgSlug}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
            />
          </div>
        ))}
        {pendingReplies.map(pending => {
          const fakeReply: Comment = {
            _id: pending.localId as Id<'comments'>,
            _creationTime: pending.createdAt,
            authorId: (currentUserId ?? '') as Id<'users'>,
            body: pending.body,
            deleted: false,
            parentId: comment._id,
            author: currentUser,
          };
          return (
            <div key={`pr-${pending.localId}`}>
              <div className='border-t' />
              <ReplyItem
                comment={fakeReply}
                currentUserId={currentUserId}
                orgSlug={orgSlug}
                isPending
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
              />
            </div>
          );
        })}

        {/* Reply composer is opt-in so stacked comment cards stay compact. */}
        {!isPending && isReplying && (
          <>
            <div className='border-t' />
            <div className='p-2.5'>
              <InlineReplyInput
                orgSlug={orgSlug}
                currentUser={currentUser}
                onSubmit={async body => {
                  await onReply(comment._id, body);
                  setIsReplying(false);
                }}
              />
            </div>
          </>
        )}
      </div>
      <ConfirmDeleteDialog />
    </>
  );
}

// ─── Comment Input (bottom card) ─────────────────────────────────────────────

function CommentInput({
  orgSlug,
  onSubmit,
}: {
  orgSlug: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [focused, setFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expanded = focused || body.trim().length > 0;

  const submit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody('');
      setFocused(false);
    } catch {
      // The entity-specific submitter reports the error and keeps the draft.
    } finally {
      setIsSubmitting(false);
    }
  }, [body, isSubmitting, onSubmit]);

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        expanded ? 'border-border' : 'border-border/50',
      )}
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <div
        role='textbox'
        tabIndex={0}
        onClick={() => setFocused(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') setFocused(true);
        }}
      >
        <RichEditor
          value={body}
          onChange={v => {
            setBody(v);
            if (!focused) setFocused(true);
          }}
          placeholder='Leave a comment... Use @ to mention'
          mode='compact'
          borderless
          orgSlug={orgSlug}
          showPlaceholderOnlyCurrent={false}
          className={cn(
            'px-3 py-2',
            expanded ? '[&_.tiptap]:min-h-[60px]' : '[&_.tiptap]:min-h-[28px]',
          )}
        />
      </div>
      {expanded && (
        <div className='flex items-center justify-end p-2'>
          <Button
            size='sm'
            className='size-7 cursor-pointer rounded-md p-0'
            onClick={() => void submit()}
            disabled={!body.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <BarsSpinner size={10} />
            ) : (
              <ArrowUp className='size-2.5' />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Compact Activity Row ────────────────────────────────────────────────────

function renderActivityDescription(item: ActivityFeedItem) {
  const details = item.details;
  switch (item.eventType) {
    case 'issue_created':
      return 'created the issue';
    case 'issue_title_changed':
      return `changed title to ${details.toLabel ?? '—'}`;
    case 'issue_description_changed':
      return 'updated the description';
    case 'issue_priority_changed':
      return `changed priority to ${details.toLabel ?? '—'}`;
    case 'issue_workflow_state_changed':
      return `moved from ${details.fromLabel ?? '—'} to ${details.toLabel ?? '—'}`;
    case 'issue_assignment_state_changed':
      return `changed assignment state to ${details.toLabel ?? '—'}`;
    case 'issue_assignees_changed': {
      const added = details.addedUserNames;
      const removed = details.removedUserNames;
      if (added?.length) return `assigned ${added.join(', ')}`;
      if (removed?.length) return `unassigned ${removed.join(', ')}`;
      return 'updated assignees';
    }
    case 'issue_team_changed':
    case 'issue_team_added':
      return `moved to team ${details.toLabel ?? '—'}`;
    case 'issue_team_removed':
      return `removed from team ${details.fromLabel ?? '—'}`;
    case 'issue_project_changed':
    case 'issue_project_added':
      return `moved to project ${details.toLabel ?? '—'}`;
    case 'issue_project_removed':
      return `removed from project ${details.fromLabel ?? '—'}`;
    case 'issue_visibility_changed':
      return `changed visibility to ${details.toLabel ?? '—'}`;
    case 'issue_sub_issue_created':
      return `created sub-issue ${details.toLabel ?? item.target.key ?? ''}`;
    case 'issue_comment_added':
      return null;
    case 'request_created':
      return 'created the Request';
    case 'request_description_changed':
      return 'updated the Request description';
    case 'request_expected_output_changed':
      return 'updated the expected output';
    case 'request_due_date_changed':
      return `changed the due date from ${details.fromLabel ?? 'None'} to ${details.toLabel ?? 'None'}`;
    case 'request_priority_changed':
      return `changed the priority from ${details.fromLabel ?? 'None'} to ${details.toLabel ?? 'None'}`;
    case 'request_comment_added':
      return null;
    case 'request_routed':
      return 'updated Request routing';
    case 'request_claimed':
      return 'took responsibility for the Request';
    case 'request_linked_to_work':
      return 'linked the Request to Work';
    case 'request_ready_for_review':
      return 'raised the Request for review';
    case 'request_changes_requested':
      return 'requested changes';
    case 'request_completed':
      return 'accepted and completed the Request';
    case 'work_created':
      return 'created the Work';
    case 'work_started':
      return 'started the Work';
    case 'work_ready_for_review':
      return 'raised the Work for review';
    case 'work_completed':
      return 'completed the Work';
    case 'work_owner_changed':
      return `transferred accountability to ${details.toLabel ?? 'a new owner'}`;
    case 'work_contributor_added':
      return `added ${details.toLabel ?? 'a contributor'}`;
    case 'work_contributor_removed':
      return `removed ${details.fromLabel ?? 'a contributor'}`;
    case 'work_handoff_proposed':
      return 'proposed a Work handoff';
    case 'work_handoff_accepted':
      return 'accepted the Work handoff';
    case 'work_handoff_declined':
      return 'declined the Work handoff';
    case 'work_attention_requested':
      return 'requested human attention';
    case 'work_attention_resolved':
      return 'resolved the attention request';
    case 'task_created':
      return `created Task ${details.toLabel ?? ''}`.trim();
    case 'task_updated':
      return 'updated a Task';
    case 'task_status_changed':
      return `moved a Task from ${details.fromLabel ?? '—'} to ${details.toLabel ?? '—'}`;
    case 'task_assignee_changed':
      return `assigned a Task to ${details.toLabel ?? 'nobody'}`;
    default:
      return `updated ${item.target.key ?? 'issue'}`;
  }
}

// getActivityIcon is imported from @/lib/activity-icons

function CompactActivityRow({
  item,
  isLast,
}: {
  item: ActivityFeedItem;
  isLast: boolean;
}) {
  const description = renderActivityDescription(item);
  if (description === null) return null;

  const { Icon, color } = getActivityIcon(item.eventType);

  return (
    <div className='relative flex items-center gap-2 py-1.5 pl-1'>
      {/* Timeline line — connects to next icon with small gaps */}
      {!isLast && (
        <div className='bg-border absolute top-[26px] -bottom-[5px] left-[12.5px] w-px' />
      )}
      {/* Icon dot */}
      <div
        className={cn(
          'bg-background relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border',
          color,
        )}
      >
        <Icon className='size-2.5' />
      </div>
      {/* Content */}
      <div className='text-muted-foreground flex min-w-0 flex-1 items-center gap-1 text-[13px] leading-[18px]'>
        <span className='min-w-0 flex-1 truncate'>
          <span className='text-foreground/80 font-medium'>
            {item.actor?.name ?? 'Unknown'}
          </span>{' '}
          {description}
          {item.details.viaAgent && (
            <span className='text-muted-foreground/60 ml-1 inline-flex items-center gap-0.5'>
              <Sparkles className='inline size-2.5' />
              <span className='text-[11px]'>via Vector</span>
            </span>
          )}
        </span>
        <span className='shrink-0 text-xs'>
          · {formatDateHuman(new Date(item.createdAt))}
        </span>
      </div>
    </div>
  );
}

// ─── Issue Comments Section ──────────────────────────────────────────────────

export function IssueCommentsSection({
  orgSlug,
  issueId,
  currentUser,
}: {
  orgSlug: string;
  issueId: Id<'issues'>;
  currentUser: CommentAuthor | null;
}) {
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const localIdBase = useId();

  const comments = useCachedQuery(api.issues.queries.listComments, {
    issueId,
  });

  const pageSize = 10;
  const {
    results: activityResults,
    status: activityStatus,
    loadMore,
  } = usePaginatedQuery(
    api.activities.queries.listIssueActivity,
    { issueId },
    { initialNumItems: pageSize },
  );

  const addComment = useMutation(api.issues.mutations.addComment);
  const editComment = useMutation(api.issues.mutations.editComment);
  const deleteComment = useMutation(api.issues.mutations.deleteComment);

  const handleSubmitComment = useCallback(
    async (body: string, parentId?: Id<'comments'>) => {
      const localId = `${localIdBase}-${Date.now()}`;
      const pending: PendingComment = {
        localId,
        body,
        createdAt: Date.now(),
        parentId,
      };
      setPendingComments(prev => [...prev, pending]);

      try {
        await addComment({ issueId, body, parentId });
      } catch (error) {
        toast.error('Failed to post comment');
        throw error;
      } finally {
        setPendingComments(prev => prev.filter(p => p.localId !== localId));
      }
    },
    [issueId, addComment, localIdBase],
  );

  if (comments === undefined) {
    return <CommentsSkeleton />;
  }

  return (
    <CommentsAndActivityFeed
      comments={comments as Comment[]}
      activityResults={activityResults as ActivityFeedItem[]}
      activityStatus={activityStatus}
      loadMore={loadMore}
      pageSize={pageSize}
      pendingComments={pendingComments}
      currentUser={currentUser}
      orgSlug={orgSlug}
      onSubmitComment={body => handleSubmitComment(body)}
      onReply={(parentId, body) => handleSubmitComment(body, parentId)}
      onEditComment={async (commentId, body) => {
        await editComment({ commentId, body });
      }}
      onDeleteComment={async commentId => {
        await deleteComment({ commentId });
      }}
    />
  );
}

// ─── Request Comments Section ────────────────────────────────────────────────

export function RequestCommentsSection({
  orgSlug,
  requestId,
  currentUser,
}: {
  orgSlug: string;
  requestId: Id<'requests'>;
  currentUser: CommentAuthor | null;
}) {
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const localIdBase = useId();
  const comments = useCachedQuery(api.requests.queries.listComments, {
    requestId,
  });
  const pageSize = 10;
  const {
    results: activityResults,
    status: activityStatus,
    loadMore,
  } = usePaginatedQuery(
    api.activities.queries.listRequestActivity,
    { requestId },
    { initialNumItems: pageSize },
  );
  const addComment = useMutation(api.requests.mutations.addComment);
  const editComment = useMutation(api.requests.mutations.editComment);
  const deleteComment = useMutation(api.requests.mutations.deleteComment);

  const handleSubmitComment = useCallback(
    async (body: string, parentId?: Id<'comments'>) => {
      const localId = `${localIdBase}-${Date.now()}`;
      setPendingComments(previous => [
        ...previous,
        { localId, body, createdAt: Date.now(), parentId },
      ]);
      try {
        await addComment({ requestId, body, parentId });
      } catch (error) {
        toast.error('Failed to post comment');
        throw error;
      } finally {
        setPendingComments(previous =>
          previous.filter(comment => comment.localId !== localId),
        );
      }
    },
    [addComment, localIdBase, requestId],
  );

  if (comments === undefined) return <CommentsSkeleton />;

  return (
    <CommentsAndActivityFeed
      comments={comments as Comment[]}
      activityResults={activityResults as ActivityFeedItem[]}
      activityStatus={activityStatus}
      loadMore={loadMore}
      pageSize={pageSize}
      pendingComments={pendingComments}
      currentUser={currentUser}
      orgSlug={orgSlug}
      onSubmitComment={body => handleSubmitComment(body)}
      onReply={(parentId, body) => handleSubmitComment(body, parentId)}
      onEditComment={async (commentId, body) => {
        await editComment({ commentId, body });
      }}
      onDeleteComment={async commentId => {
        await deleteComment({ commentId });
      }}
    />
  );
}

// ─── Document Comments Section ───────────────────────────────────────────────

export function DocumentCommentsSection({
  orgSlug,
  documentId,
  currentUser,
}: {
  orgSlug: string;
  documentId: Id<'documents'>;
  currentUser: CommentAuthor | null;
}) {
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const localIdBase = useId();

  const comments = useCachedQuery(api.documents.queries.listComments, {
    documentId,
  });

  const addComment = useMutation(api.documents.mutations.addComment);
  const editComment = useMutation(api.issues.mutations.editComment);
  const deleteComment = useMutation(api.issues.mutations.deleteComment);

  const handleSubmitComment = useCallback(
    async (body: string, parentId?: Id<'comments'>) => {
      const localId = `${localIdBase}-${Date.now()}`;
      const pending: PendingComment = {
        localId,
        body,
        createdAt: Date.now(),
        parentId,
      };
      setPendingComments(prev => [...prev, pending]);

      try {
        await addComment({ documentId, body, parentId });
      } catch (error) {
        toast.error('Failed to post comment');
        throw error;
      } finally {
        setPendingComments(prev => prev.filter(p => p.localId !== localId));
      }
    },
    [documentId, addComment, localIdBase],
  );

  if (comments === undefined) {
    return <CommentsSkeleton />;
  }

  return (
    <CommentsAndActivityFeed
      comments={comments as Comment[]}
      activityResults={[]}
      activityStatus='Exhausted'
      pendingComments={pendingComments}
      currentUser={currentUser}
      orgSlug={orgSlug}
      onSubmitComment={body => handleSubmitComment(body)}
      onReply={(parentId, body) => handleSubmitComment(body, parentId)}
      onEditComment={async (commentId, body) => {
        await editComment({ commentId, body });
      }}
      onDeleteComment={async commentId => {
        await deleteComment({ commentId });
      }}
    />
  );
}

// ─── Shared Feed Renderer ───────────────────────────────────────────────────

type ActivityStatus =
  'LoadingFirstPage' | 'LoadingMore' | 'CanLoadMore' | 'Exhausted';

function CommentsAndActivityFeed({
  comments,
  activityResults,
  activityStatus,
  loadMore,
  pageSize,
  pendingComments,
  currentUser,
  orgSlug,
  onSubmitComment,
  onReply,
  onEditComment,
  onDeleteComment,
}: {
  comments: Comment[];
  activityResults: ActivityFeedItem[];
  activityStatus: ActivityStatus;
  loadMore?: (numItems: number) => void;
  pageSize?: number;
  pendingComments: PendingComment[];
  currentUser: CommentAuthor | null;
  orgSlug: string;
  onSubmitComment: (body: string) => Promise<void>;
  onReply: (parentId: Id<'comments'>, body: string) => Promise<void>;
  onEditComment: EditComment;
  onDeleteComment: DeleteComment;
}) {
  // Separate top-level comments from replies
  const topLevelComments = comments.filter(c => !c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parentId) {
      const existing = repliesByParent.get(String(c.parentId)) ?? [];
      existing.push(c);
      repliesByParent.set(String(c.parentId), existing);
    }
  }

  // Pending: split top-level vs replies
  const pendingTopLevel = pendingComments.filter(p => !p.parentId);
  const pendingRepliesByParent = new Map<string, PendingComment[]>();
  for (const p of pendingComments) {
    if (p.parentId) {
      const existing = pendingRepliesByParent.get(String(p.parentId)) ?? [];
      existing.push(p);
      pendingRepliesByParent.set(String(p.parentId), existing);
    }
  }

  // Build merged feed (only top-level comments + activity)
  const feed: FeedEntry[] = [];

  for (const comment of topLevelComments) {
    feed.push({
      type: 'comment',
      data: comment,
      timestamp: comment._creationTime,
    });
  }

  for (const activity of activityResults) {
    if (
      activity.eventType === 'issue_comment_added' ||
      activity.eventType === 'request_comment_added'
    )
      continue;
    feed.push({
      type: 'activity',
      data: activity,
      timestamp: activity.createdAt,
    });
  }

  for (const pending of pendingTopLevel) {
    feed.push({
      type: 'pending',
      data: pending,
      timestamp: pending.createdAt,
    });
  }

  feed.sort((a, b) => a.timestamp - b.timestamp);

  const currentUserId = currentUser?._id ?? '';

  return (
    <div>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>Activity</h2>
        {activityStatus === 'CanLoadMore' && loadMore && pageSize && (
          <Button
            variant='ghost'
            size='sm'
            className='text-muted-foreground h-6 cursor-pointer gap-1 px-2 text-xs'
            onClick={() => loadMore(pageSize)}
          >
            <ChevronUp className='size-3' />
            Show older
          </Button>
        )}
      </div>

      {feed.length === 0 ? (
        <p className='text-muted-foreground py-2 text-sm'>No activity yet.</p>
      ) : (
        <div>
          {feed.map((entry, idx) => {
            const prevEntry = feed[idx - 1];
            const needsGap =
              idx > 0 &&
              !(prevEntry?.type === 'activity' && entry.type === 'activity');

            if (entry.type === 'comment') {
              const commentReplies =
                repliesByParent.get(String(entry.data._id)) ?? [];
              const commentPendingReplies =
                pendingRepliesByParent.get(String(entry.data._id)) ?? [];
              return (
                <div
                  key={`c-${entry.data._id}`}
                  className={needsGap ? 'mt-2' : undefined}
                >
                  <CommentCard
                    comment={entry.data}
                    replies={commentReplies}
                    pendingReplies={commentPendingReplies}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    orgSlug={orgSlug}
                    onReply={onReply}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                  />
                </div>
              );
            }
            if (entry.type === 'pending') {
              const fakeComment: Comment = {
                _id: entry.data.localId as Id<'comments'>,
                _creationTime: entry.data.createdAt,
                authorId: (currentUserId ?? '') as Id<'users'>,
                body: entry.data.body,
                deleted: false,
                author: currentUser,
              };
              return (
                <div
                  key={`p-${entry.data.localId}`}
                  className={needsGap ? 'mt-2' : undefined}
                >
                  <CommentCard
                    comment={fakeComment}
                    replies={[]}
                    pendingReplies={[]}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    orgSlug={orgSlug}
                    isPending
                    onReply={onReply}
                    onEditComment={onEditComment}
                    onDeleteComment={onDeleteComment}
                  />
                </div>
              );
            }
            // Check if next entry is also an activity row
            const nextEntry = feed[idx + 1];
            const nextIsActivity =
              nextEntry?.type === 'activity' &&
              renderActivityDescription(nextEntry.data) !== null;
            return (
              <div
                key={`a-${entry.data._id}`}
                className={needsGap ? 'mt-2' : undefined}
              >
                <CompactActivityRow
                  item={entry.data}
                  isLast={!nextIsActivity}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className='mt-3'>
        <CommentInput orgSlug={orgSlug} onSubmit={onSubmitComment} />
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CommentsSkeleton() {
  return (
    <div>
      <Skeleton className='mb-3 h-4 w-16' />
      <div className='space-y-2'>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`a-${i}`} className='flex items-center gap-2 py-1.5'>
            <Skeleton className='size-6 shrink-0 rounded-full' />
            <Skeleton className='h-3.5 w-48' />
            <Skeleton className='ml-auto h-3 w-12' />
          </div>
        ))}
        <div className='rounded-lg border'>
          <div className='flex items-center gap-2 px-3 py-2'>
            <Skeleton className='size-6 shrink-0 rounded-full' />
            <Skeleton className='h-3.5 w-20' />
            <Skeleton className='h-3 w-12' />
          </div>
          <div className='px-3 pb-3'>
            <Skeleton className='h-10 w-full rounded-md' />
          </div>
        </div>
      </div>
      <div className='mt-3'>
        <Skeleton className='h-12 w-full rounded-lg' />
      </div>
    </div>
  );
}
