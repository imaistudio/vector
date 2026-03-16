'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Github, Shield, Webhook } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/convex';
import { useQuery } from 'convex/react';
import { toast } from 'sonner';

const REQUIRED_EVENTS = [
  'push',
  'pull_request',
  'issues',
  'installation',
  'installation_repositories',
] as const;

export function GitHubIntegrationSettings({ orgSlug }: { orgSlug: string }) {
  const settings = useQuery(api.github.queries.getOrgSettings, { orgSlug });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const webhookUrl = useMemo(() => {
    const configuredBaseUrl =
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
      process.env.NEXT_PUBLIC_CONVEX_URL;

    const baseUrl =
      configuredBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    return `${baseUrl.replace(/\/$/, '')}/webhooks/github`;
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success('Webhook URL copied');
    } catch (error) {
      console.error(error);
      toast.error('Failed to copy webhook URL');
    }
  };

  if (settings === undefined) {
    return (
      <div className='space-y-3 rounded-lg border p-3'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <Skeleton className='size-4 rounded-md' />
            <Skeleton className='h-4 w-24' />
          </div>
          <Skeleton className='h-5 w-20 rounded-md' />
        </div>
        <Skeleton className='h-24 w-full rounded-lg' />
        <Skeleton className='h-28 w-full rounded-lg' />
      </div>
    );
  }

  const hasWebhookSecret = settings.effectiveAuth.hasWebhookSecret;

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Github className='size-4' />
          <h3 className='text-sm font-medium'>GitHub Webhooks</h3>
        </div>
        <Badge
          variant={hasWebhookSecret ? 'secondary' : 'outline'}
          className='h-5 rounded-md px-1.5 text-[10px]'
        >
          {hasWebhookSecret ? 'Ready' : 'Needs setup'}
        </Badge>
      </div>

      <div className='space-y-2 rounded-lg border p-3'>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <Webhook className='text-muted-foreground size-3.5' />
            <span className='text-sm font-medium'>Webhook endpoint</span>
          </div>
          <Button size='sm' variant='outline' onClick={() => void handleCopy()}>
            {copied ? (
              <Check className='size-3.5' />
            ) : (
              <Copy className='size-3.5' />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <Input value={webhookUrl} readOnly className='font-mono text-xs' />

        <p className='text-muted-foreground text-xs leading-5'>
          Point GitHub at this Convex webhook URL. Workspace development linking
          is currently webhook-driven, so this endpoint and the shared secret
          are the active setup path here.
        </p>
      </div>

      <div className='grid gap-3 lg:grid-cols-2'>
        <div className='space-y-2 rounded-lg border p-3'>
          <div className='flex items-center gap-2'>
            <Shield className='text-muted-foreground size-3.5' />
            <span className='text-sm font-medium'>Shared secret</span>
          </div>
          <p className='text-muted-foreground text-xs leading-5'>
            {hasWebhookSecret
              ? 'Platform webhook secret is configured. Use the same secret in GitHub so Vector can verify deliveries.'
              : 'A platform admin still needs to save the GitHub webhook secret before deliveries to this endpoint will be trusted.'}
          </p>
          <Badge
            variant={hasWebhookSecret ? 'secondary' : 'outline'}
            className='h-5 w-fit rounded-md px-1.5 text-[10px]'
          >
            {hasWebhookSecret ? 'Secret configured' : 'Secret missing'}
          </Badge>
        </div>

        <div className='space-y-2 rounded-lg border p-3'>
          <div className='flex items-center gap-2'>
            <Github className='text-muted-foreground size-3.5' />
            <span className='text-sm font-medium'>Events to subscribe</span>
          </div>
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
          <p className='text-muted-foreground text-xs leading-5'>
            These deliveries power PR, issue, and commit linking on workspace
            issues. Other workspace GitHub controls stay hidden here while
            webhook-only setup is in use.
          </p>
        </div>
      </div>
    </div>
  );
}
