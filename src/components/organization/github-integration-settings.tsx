'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  GitPullRequest,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Webhook,
} from 'lucide-react';
import { FaGithub as Github } from 'react-icons/fa6';
import { api, useCachedQuery, useMutation, useAction } from '@/lib/convex';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOptimisticValue } from '@/hooks/use-optimistic';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateHuman } from '@/lib/date';
import { toast } from 'sonner';

const REQUIRED_EVENTS = ['push', 'pull_request', 'issues'] as const;

function IntegrationRow({
  icon,
  label,
  value,
  meta,
  action,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className='flex items-center gap-3 px-3 py-2'>
      <div className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-md'>
        {icon}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium'>{label}</div>
        <div className='text-muted-foreground text-xs'>{value}</div>
        {meta ? <div className='mt-1'>{meta}</div> : null}
      </div>
      {action ? <div className='shrink-0'>{action}</div> : null}
    </div>
  );
}

export function GitHubIntegrationSettings({ orgSlug }: { orgSlug: string }) {
  const settings = useCachedQuery(api.github.queries.getOrgSettings, {
    orgSlug,
  });
  const developmentInbox = useCachedQuery(
    api.github.queries.listDevelopmentInbox,
    {
      orgSlug,
    },
  );
  const rotateWebhookSecret = useAction(api.github.actions.rotateWebhookSecret);
  const setAutomationPolicies = useMutation(
    api.github.mutations.setAutomationPolicies,
  );

  const [copiedField, setCopiedField] = useState<'url' | 'secret' | null>(null);
  const [revealedSecret, setRevealedSecret] = useState('');
  const [isRotatingSecret, setIsRotatingSecret] = useState(false);

  useEffect(() => {
    if (!copiedField) return;

    const timeout = window.setTimeout(() => setCopiedField(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [copiedField]);

  const serverPolicies = useMemo(
    () => ({
      keyLinkEnabled: settings?.effectiveAuth.keyLinkEnabled ?? true,
      aiMatchEnabled: settings?.effectiveAuth.aiMatchEnabled ?? true,
      unmatchedArtifactPolicy:
        settings?.effectiveAuth.unmatchedArtifactPolicy ?? 'development_inbox',
      stateAutomationPolicy:
        settings?.effectiveAuth.stateAutomationPolicy ?? 'manual',
      identityContributionPolicy:
        settings?.effectiveAuth.identityContributionPolicy ?? 'contributors',
      githubNotificationPolicy:
        settings?.effectiveAuth.githubNotificationPolicy ?? 'action_only',
    }),
    [
      settings?.effectiveAuth.aiMatchEnabled,
      settings?.effectiveAuth.githubNotificationPolicy,
      settings?.effectiveAuth.identityContributionPolicy,
      settings?.effectiveAuth.keyLinkEnabled,
      settings?.effectiveAuth.stateAutomationPolicy,
      settings?.effectiveAuth.unmatchedArtifactPolicy,
    ],
  );
  const [policies, setOptimisticPolicies] = useOptimisticValue(serverPolicies);

  const webhookUrl = useMemo(() => {
    const configuredBaseUrl =
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
      process.env.NEXT_PUBLIC_CONVEX_URL;
    const baseUrl =
      configuredBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    return `${baseUrl.replace(/\/$/, '')}/webhooks/github?org=${encodeURIComponent(
      orgSlug,
    )}`;
  }, [orgSlug]);

  const handleCopy = async (field: 'url' | 'secret', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(
        field === 'url' ? 'Webhook URL copied' : 'Webhook secret copied',
      );
    } catch (error) {
      console.error(error);
      toast.error(
        field === 'url'
          ? 'Failed to copy webhook URL'
          : 'Failed to copy webhook secret',
      );
    }
  };

  const handleRotateSecret = async () => {
    if (!settings?.canManage) return;

    setIsRotatingSecret(true);
    try {
      const result = await rotateWebhookSecret({ orgSlug });
      setRevealedSecret(result.webhookSecret);
      toast.success('Workspace webhook secret generated');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate webhook secret');
    } finally {
      setIsRotatingSecret(false);
    }
  };

  const updatePolicies = async (patch: Partial<typeof policies>) => {
    if (!settings?.canManage) return;
    const next = { ...policies, ...patch };
    setOptimisticPolicies(next);
    try {
      await setAutomationPolicies({ orgSlug, ...next });
    } catch (error) {
      console.error(error);
      toast.error('Failed to update GitHub automation policies');
    }
  };

  if (settings === undefined) {
    return (
      <div className='space-y-3'>
        <div className='rounded-xl border'>
          <div className='flex items-start gap-3 px-4 py-4'>
            <Skeleton className='size-10 rounded-xl' />
            <div className='min-w-0 flex-1 space-y-2'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-4 w-72' />
            </div>
          </div>
        </div>
        <Skeleton className='h-56 w-full rounded-xl' />
      </div>
    );
  }

  const hasWebhookSecret = settings.effectiveAuth.hasWebhookSecret;
  const hasApiAccess = settings.effectiveAuth.hasUsableAuth;
  const repositoryCount = settings.repositories.length;
  const lastWebhookAt = settings.integration?.lastWebhookAt ?? null;
  const secretFingerprint =
    settings.integration?.webhookSecretFingerprint ?? 'Not generated yet';
  const webhookStatus = !hasWebhookSecret
    ? {
        label: 'Needs setup',
        variant: 'outline' as const,
        activity: 'Generate a secret and send a GitHub test delivery.',
      }
    : !lastWebhookAt
      ? {
          label: 'Awaiting delivery',
          variant: 'outline' as const,
          activity:
            'Configured, but no GitHub deliveries have been received yet.',
        }
      : {
          label: 'Connected',
          variant: 'secondary' as const,
          activity: `Last delivery ${formatDateHuman(new Date(lastWebhookAt))}`,
        };

  return (
    <div className='space-y-3'>
      <div className='rounded-xl border'>
        <div className='flex items-start gap-3 px-4 py-4'>
          <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl'>
            <Github className='size-5' />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-sm font-semibold'>GitHub</h2>
              <Badge
                variant={webhookStatus.variant}
                className='h-5 rounded-md px-1.5 text-[10px]'
              >
                {webhookStatus.label}
              </Badge>
              {hasApiAccess ? (
                <Badge
                  variant='outline'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  API access enabled
                </Badge>
              ) : null}
            </div>
            <p className='text-muted-foreground mt-1 text-sm leading-5'>
              Workspace-scoped webhook ingestion for pull requests, issues, and
              commits. Each workspace has its own endpoint URL and secret.
            </p>
            <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-4 text-xs'>
              <span>{repositoryCount} repositories seen</span>
              <span>{webhookStatus.activity}</span>
            </div>
          </div>
        </div>
      </div>

      <div className='overflow-hidden rounded-xl border'>
        <IntegrationRow
          icon={<Webhook className='text-muted-foreground size-4' />}
          label='Webhook endpoint'
          value='Copy this full Convex URL into the GitHub webhook configuration for this workspace.'
          meta={
            <Input
              value={webhookUrl}
              readOnly
              className='h-8 font-mono text-xs'
            />
          }
          action={
            <Button
              size='sm'
              variant='outline'
              onClick={() => void handleCopy('url', webhookUrl)}
            >
              {copiedField === 'url' ? (
                <Check className='size-3.5' />
              ) : (
                <Copy className='size-3.5' />
              )}
              {copiedField === 'url' ? 'Copied' : 'Copy'}
            </Button>
          }
        />

        <Separator />

        <IntegrationRow
          icon={<Shield className='text-muted-foreground size-4' />}
          label='Webhook secret'
          value={
            hasWebhookSecret
              ? `Configured (${secretFingerprint})`
              : 'Generate a workspace secret, then paste it into GitHub.'
          }
          meta={
            <Input
              value={
                revealedSecret ||
                (hasWebhookSecret
                  ? 'Generated and stored securely. Regenerate to reveal a new value.'
                  : 'No workspace webhook secret has been generated yet.')
              }
              readOnly
              className='h-8 font-mono text-xs'
            />
          }
          action={
            <div className='flex items-center gap-2'>
              {revealedSecret ? (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => void handleCopy('secret', revealedSecret)}
                >
                  {copiedField === 'secret' ? (
                    <Check className='size-3.5' />
                  ) : (
                    <Copy className='size-3.5' />
                  )}
                  {copiedField === 'secret' ? 'Copied' : 'Copy'}
                </Button>
              ) : null}
              {settings.canManage ? (
                <Button
                  size='sm'
                  variant='outline'
                  disabled={isRotatingSecret}
                  onClick={() => void handleRotateSecret()}
                >
                  <RefreshCw
                    className={`size-3.5 ${isRotatingSecret ? 'animate-spin' : ''}`}
                  />
                  {hasWebhookSecret ? 'Regenerate' : 'Generate'}
                </Button>
              ) : (
                <Badge
                  variant='outline'
                  className='h-5 rounded-md px-1.5 text-[10px]'
                >
                  View only
                </Badge>
              )}
            </div>
          }
        />

        <Separator />

        <IntegrationRow
          icon={<SlidersHorizontal className='text-muted-foreground size-4' />}
          label='Linking and matching'
          value='Choose how GitHub evidence finds existing Work.'
          meta={
            <div className='mt-1 flex flex-wrap gap-3 text-xs'>
              <label className='flex items-center gap-1.5'>
                <Checkbox
                  checked={policies.keyLinkEnabled}
                  disabled={!settings.canManage}
                  onCheckedChange={checked =>
                    void updatePolicies({ keyLinkEnabled: checked === true })
                  }
                />
                Key matching
              </label>
              <label className='flex items-center gap-1.5'>
                <Checkbox
                  checked={policies.aiMatchEnabled}
                  disabled={!settings.canManage}
                  onCheckedChange={checked =>
                    void updatePolicies({ aiMatchEnabled: checked === true })
                  }
                />
                AI suggestions
              </label>
              <label className='flex items-center gap-1.5'>
                <Checkbox
                  checked={
                    policies.identityContributionPolicy === 'contributors'
                  }
                  disabled={!settings.canManage}
                  onCheckedChange={checked =>
                    void updatePolicies({
                      identityContributionPolicy:
                        checked === true ? 'contributors' : 'none',
                    })
                  }
                />
                Authors become contributors
              </label>
            </div>
          }
          action={
            <Badge variant='outline' className='h-5 text-[10px]'>
              {policies.keyLinkEnabled || policies.aiMatchEnabled
                ? 'On'
                : 'Off'}
            </Badge>
          }
        />

        <Separator />

        <IntegrationRow
          icon={<Github className='text-muted-foreground size-4' />}
          label='Unmatched pull requests'
          value='Pull requests are development evidence, not Work by default.'
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='h-7 text-xs'>
                  {policies.unmatchedArtifactPolicy.replaceAll('_', ' ')}
                  <ChevronRight className='size-3.5 rotate-90' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {(
                  [
                    'development_inbox',
                    'create_request',
                    'create_work',
                    'ignore',
                  ] as const
                ).map(value => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() =>
                      void updatePolicies({ unmatchedArtifactPolicy: value })
                    }
                  >
                    {value.replaceAll('_', ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <Separator />

        <IntegrationRow
          icon={<Check className='text-muted-foreground size-4' />}
          label='State automation'
          value='Merged or closed artifacts are evidence. Manual is the safest default.'
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='h-7 text-xs'>
                  {policies.stateAutomationPolicy}
                  <ChevronRight className='size-3.5 rotate-90' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {(['manual', 'evidence', 'github'] as const).map(value => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() =>
                      void updatePolicies({ stateAutomationPolicy: value })
                    }
                  >
                    {value}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <Separator />

        <IntegrationRow
          icon={<Github className='text-muted-foreground size-4' />}
          label='Tracked events'
          value='Subscribe GitHub to these webhook events for this workspace.'
          meta={
            <div className='flex flex-wrap gap-1'>
              {REQUIRED_EVENTS.map(event => (
                <Badge
                  key={event}
                  variant='outline'
                  className='h-5 rounded-md px-1.5 font-mono text-[10px]'
                >
                  {event}
                </Badge>
              ))}
            </div>
          }
          action={<ChevronRight className='text-muted-foreground size-4' />}
        />
      </div>

      {(developmentInbox === undefined || developmentInbox.length > 0) && (
        <div className='overflow-hidden rounded-xl border'>
          <div className='flex items-start gap-3 border-b px-3 py-3'>
            <div className='bg-muted flex size-8 items-center justify-center rounded-md'>
              <GitPullRequest className='text-muted-foreground size-4' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='text-sm font-medium'>Development inbox</div>
              <p className='text-muted-foreground text-xs'>
                Unmatched pull requests stay visible here until they are linked
                to Work, turned into a Request by policy, or deliberately
                ignored.
              </p>
            </div>
            {developmentInbox && (
              <Badge variant='outline' className='h-5 text-[10px]'>
                {
                  developmentInbox.filter(item => item.status === 'untriaged')
                    .length
                }{' '}
                untriaged
              </Badge>
            )}
          </div>
          {developmentInbox === undefined ? (
            <div className='space-y-2 p-3'>
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
            </div>
          ) : (
            developmentInbox.slice(0, 20).map(item => {
              const artifact = item.pullRequest ?? item.githubIssue;
              if (!artifact) return null;
              return (
                <div
                  key={item._id}
                  className='hover:bg-muted/30 flex min-h-10 items-center gap-3 border-b px-3 last:border-b-0'
                >
                  <GitPullRequest className='text-muted-foreground size-3.5' />
                  <span className='min-w-0 flex-1 truncate text-xs'>
                    {artifact.title}
                  </span>
                  <Badge variant='outline' className='h-5 text-[10px]'>
                    {item.status}
                  </Badge>
                  {item.createdRequest ? (
                    <Link
                      href={`/${orgSlug}/requests/${item.createdRequest.key}`}
                      className='text-muted-foreground hover:text-foreground text-[11px]'
                    >
                      {item.createdRequest.key}
                    </Link>
                  ) : null}
                  <Link
                    href={artifact.url}
                    target='_blank'
                    rel='noreferrer'
                    className='text-muted-foreground hover:text-foreground'
                  >
                    <ExternalLink className='size-3.5' />
                  </Link>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
