'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Paperclip,
  ArrowUp,
  X,
} from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { useMutation } from '@/lib/convex';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BarsSpinner } from '@/components/bars-spinner';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AssistantInput,
  type AssistantInputHandle,
  type AssistantInputIssueMention,
  type MentionRef,
} from './assistant-input';

const MODEL_STORAGE_KEY = 'vector.assistant.model';
const SKIP_CONFIRM_STORAGE_KEY = 'vector.assistant.skip-confirmations';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const MODEL_OPTIONS = [
  {
    value: '',
    label: 'Workspace default',
    hint: 'Use the workspace OpenRouter default',
  },
  {
    value: 'moonshotai/kimi-k2.5:nitro',
    label: 'Kimi K2.5',
    hint: 'Fast general-purpose default',
  },
  {
    value: 'anthropic/claude-sonnet-4',
    label: 'Claude Sonnet 4',
    hint: 'Stronger reasoning and writing',
  },
  {
    value: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
    hint: 'Compact OpenAI option',
  },
] as const;

type AssistantComposerVariant = 'dock' | 'thread';

export type AssistantComposerAttachment = {
  id: string;
  storageId: Id<'_storage'>;
  filename: string;
  mediaType: string;
  size: number;
  previewUrl?: string;
};

export type AssistantComposerSubmitOptions = {
  attachments: AssistantComposerAttachment[];
  model?: string;
  skipConfirmations: boolean;
};

export type AssistantComposerHandle = {
  submit: () => Promise<void>;
  focus: () => void;
  insertIssueMention: (issue: AssistantInputIssueMention) => void;
};

type AssistantComposerProps = {
  orgSlug: string;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  onSubmit: (
    text: string,
    mentions: MentionRef[],
    options: AssistantComposerSubmitOptions,
  ) => Promise<boolean> | boolean;
  onFocus?: () => void;
  variant?: AssistantComposerVariant;
  auxiliaryActions?: ReactNode;
  className?: string;
};

function formatBytes(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 102.4) / 10)} KB`;
  }
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

function modelLabel(value: string) {
  const builtIn = MODEL_OPTIONS.find(option => option.value === value);
  if (builtIn) return builtIn.label;
  if (!value.trim()) return 'Workspace default';
  return value;
}

export const AssistantComposer = forwardRef<
  AssistantComposerHandle,
  AssistantComposerProps
>(function AssistantComposer(
  {
    orgSlug,
    placeholder = 'Ask anything...',
    disabled = false,
    busy = false,
    onSubmit,
    onFocus,
    variant = 'thread',
    auxiliaryActions,
    className,
  },
  ref,
) {
  const inputRef = useRef<AssistantInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AssistantComposerAttachment[]>(
    [],
  );
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [model, setModel] = useState('');
  const [customModelDraft, setCustomModelDraft] = useState('');
  const [skipConfirmations, setSkipConfirmations] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const attachmentIdPrefix = useId();
  const attachmentsRef = useRef<AssistantComposerAttachment[]>([]);
  const generateAttachmentUploadUrl = useMutation(
    api.ai.mutations.generateAttachmentUploadUrl,
  );

  useEffect(() => {
    const storedModel = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (storedModel) {
      setModel(storedModel);
      setCustomModelDraft(storedModel);
    }

    setSkipConfirmations(
      window.localStorage.getItem(SKIP_CONFIRM_STORAGE_KEY) === 'true',
    );
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
    };
  }, []);

  const persistModel = useCallback((nextModel: string) => {
    setModel(nextModel);
    if (nextModel) {
      window.localStorage.setItem(MODEL_STORAGE_KEY, nextModel);
    } else {
      window.localStorage.removeItem(MODEL_STORAGE_KEY);
    }
  }, []);

  const handleToggleSkipConfirmations = useCallback(() => {
    setSkipConfirmations(current => {
      const next = !current;
      window.localStorage.setItem(
        SKIP_CONFIRM_STORAGE_KEY,
        next ? 'true' : 'false',
      );
      return next;
    });
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments(current => {
      const target = current.find(item => item.id === attachmentId);
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter(item => item.id !== attachmentId);
    });
  }, []);

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (files.length === 0) return;

      setIsUploadingAttachment(true);
      try {
        const uploadUrl = await generateAttachmentUploadUrl({ orgSlug });
        const uploaded: AssistantComposerAttachment[] = [];

        for (const [index, file] of files.entries()) {
          if (file.size > MAX_ATTACHMENT_BYTES) {
            throw new Error(
              `${file.name} is larger than ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
            );
          }

          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          const { storageId } = (await response.json()) as {
            storageId: Id<'_storage'>;
          };

          uploaded.push({
            id: `${attachmentIdPrefix}-${Date.now()}-${index}`,
            storageId,
            filename: file.name,
            mediaType: file.type || 'application/octet-stream',
            size: file.size,
            previewUrl: file.type.startsWith('image/')
              ? URL.createObjectURL(file)
              : undefined,
          });
        }

        setAttachments(current => [...current, ...uploaded]);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Attachment upload failed',
        );
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [attachmentIdPrefix, generateAttachmentUploadUrl, orgSlug],
  );

  const handleSubmit = useCallback(
    async (text: string, mentions: MentionRef[]) => {
      const shouldClear = await onSubmit(text, mentions, {
        attachments,
        model: model.trim() || undefined,
        skipConfirmations,
      });

      if (shouldClear !== false) {
        for (const attachment of attachments) {
          if (attachment.previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
        }
        setAttachments([]);
      }

      return shouldClear;
    },
    [attachments, model, onSubmit, skipConfirmations],
  );

  const canInteract = !disabled && !busy && !isUploadingAttachment;
  const triggerLabel = useMemo(() => modelLabel(model), [model]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => inputRef.current?.submit() ?? Promise.resolve(),
      focus: () => inputRef.current?.focus(),
      insertIssueMention: issue => inputRef.current?.insertIssueMention(issue),
    }),
    [],
  );

  const toolbarButtonClass =
    variant === 'dock'
      ? 'h-6 gap-1.5 rounded-md px-2 text-[11px]'
      : 'h-7 gap-1.5 rounded-md px-2.5 text-xs';
  const sendButtonClass =
    variant === 'dock' ? 'size-7 rounded-md p-0' : 'size-8 rounded-md p-0';
  const inputClass =
    variant === 'dock'
      ? 'min-h-8 flex-1 px-2 py-1.5 text-xs'
      : 'min-h-10 flex-1 px-3 py-2 text-sm';

  return (
    <div
      className={cn(
        'border-border/60 bg-background/80 overflow-hidden rounded-lg border',
        variant === 'thread' && 'backdrop-blur-sm',
        className,
      )}
    >
      <div className='border-border/50 flex flex-wrap items-center gap-1 border-b px-1.5 py-1'>
        <input
          ref={fileInputRef}
          type='file'
          className='hidden'
          multiple
          onChange={event => void handleFileSelect(event)}
          accept='image/*,.txt,.md,.json,.csv,.pdf,.js,.ts,.tsx,.jsx,.py,.go,.rs,.sh'
        />
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className={toolbarButtonClass}
          disabled={!canInteract}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploadingAttachment ? (
            <Loader2 className='size-3 animate-spin' />
          ) : (
            <Paperclip className='size-3' />
          )}
          Attach
        </Button>

        <Popover open={modelOpen} onOpenChange={setModelOpen}>
          <PopoverTrigger asChild>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              className={cn(toolbarButtonClass, 'min-w-0 justify-between')}
              disabled={!canInteract}
            >
              <span className='truncate'>{triggerLabel}</span>
              <ChevronDown className='size-3 shrink-0' />
            </Button>
          </PopoverTrigger>
          <PopoverContent align='start' className='w-[320px] p-0'>
            <Command>
              <CommandInput placeholder='Search model...' className='h-9' />
              <CommandList>
                <CommandEmpty>No models found.</CommandEmpty>
                <CommandGroup>
                  {MODEL_OPTIONS.map(option => (
                    <CommandItem
                      key={option.label}
                      value={`${option.label} ${option.value} ${option.hint}`}
                      onSelect={() => {
                        persistModel(option.value);
                        setCustomModelDraft(option.value);
                        setModelOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-3.5',
                          model === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-xs'>{option.label}</div>
                        <div className='text-muted-foreground truncate text-[10px]'>
                          {option.hint}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            <div className='border-border/60 space-y-2 border-t p-2'>
              <div className='text-muted-foreground text-[10px] tracking-[0.12em] uppercase'>
                Custom model ID
              </div>
              <div className='flex items-center gap-1.5'>
                <Input
                  value={customModelDraft}
                  onChange={event => setCustomModelDraft(event.target.value)}
                  placeholder='openrouter/model-id'
                  className='h-8 text-xs'
                />
                <Button
                  type='button'
                  size='sm'
                  className='h-8 px-2 text-xs'
                  onClick={() => {
                    persistModel(customModelDraft.trim());
                    setModelOpen(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <button
          type='button'
          className={cn(
            'border-border/60 hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors',
            variant === 'dock' ? 'h-6' : 'h-7 text-xs',
            skipConfirmations
              ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
              : 'text-muted-foreground',
          )}
          onClick={handleToggleSkipConfirmations}
        >
          <span
            className={cn(
              'inline-flex size-3 items-center justify-center rounded-sm border',
              skipConfirmations
                ? 'border-current bg-current text-white'
                : 'border-current/40 text-transparent',
            )}
          >
            <Check className='size-2.5' />
          </span>
          Skip confirms
        </button>
      </div>

      {attachments.length > 0 ? (
        <div className='border-border/50 flex flex-wrap gap-1.5 border-b px-2 py-2'>
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className='bg-muted/40 flex max-w-full items-center gap-2 rounded-md border px-2 py-1'
            >
              {attachment.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.previewUrl}
                  alt={attachment.filename}
                  className='size-8 rounded object-cover'
                />
              ) : (
                <div className='bg-background flex size-8 items-center justify-center rounded border'>
                  <FileText className='text-muted-foreground size-3.5' />
                </div>
              )}
              <div className='min-w-0'>
                <div className='max-w-[180px] truncate text-xs font-medium'>
                  {attachment.filename}
                </div>
                <div className='text-muted-foreground text-[10px]'>
                  {formatBytes(attachment.size)}
                </div>
              </div>
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground shrink-0'
                onClick={() => handleRemoveAttachment(attachment.id)}
                aria-label={`Remove ${attachment.filename}`}
              >
                <X className='size-3.5' />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className='flex items-center gap-1'>
        <AssistantInput
          ref={inputRef}
          orgSlug={orgSlug}
          onSubmit={handleSubmit}
          onFocus={onFocus}
          disabled={!canInteract}
          hasExternalContent={attachments.length > 0}
          className={inputClass}
          placeholder={placeholder}
        />
        <div className='flex shrink-0 items-center gap-0.5 pr-1'>
          {auxiliaryActions}
          <Button
            type='button'
            size='sm'
            className={sendButtonClass}
            disabled={!canInteract}
            onClick={() => inputRef.current?.submit()}
          >
            {busy || isUploadingAttachment ? (
              isUploadingAttachment ? (
                <Loader2 className='size-3 animate-spin' />
              ) : (
                <BarsSpinner size={variant === 'dock' ? 10 : 12} />
              )
            ) : (
              <ArrowUp
                className={cn(variant === 'dock' ? 'size-2.5' : 'size-3.5')}
              />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
