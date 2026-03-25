'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'sonner';
import { Menu, Plus, Shield, Trash2 } from 'lucide-react';
import { api, useQuery, useMutation } from '@/lib/convex';
import { UserMenu } from '@/components/user-menu';
import { PlatformAdminSidebar } from './platform-admin-sidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PLATFORM_ADMIN_ROLE = 'platform_admin';

type ModelEntry = {
  modelId: string;
  name: string;
  hint: string;
};

function AssistantPageSkeleton() {
  return (
    <div className='bg-secondary flex h-screen'>
      <aside className='hidden w-56 lg:block'>
        <div className='flex h-full flex-col'>
          <div className='flex-1 overflow-y-auto'>
            <div className='space-y-4 p-2 pt-0'>
              <Skeleton className='h-8 w-full rounded-md' />
              <div className='space-y-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-8 w-full rounded-md' />
                <Skeleton className='h-8 w-full rounded-md' />
              </div>
            </div>
          </div>
          <div className='border-border border-t p-2'>
            <div className='flex items-center gap-2 p-2'>
              <Skeleton className='size-8 rounded-full' />
              <Skeleton className='h-4 w-28' />
            </div>
          </div>
        </div>
      </aside>
      <main className='bg-background m-2 ml-0 flex-1 overflow-y-auto rounded-md border'>
        <div className='border-b'>
          <div className='flex items-center p-1 pl-8 lg:pl-1'>
            <Skeleton className='h-5 w-32' />
          </div>
        </div>
        <div className='space-y-4 p-3'>
          <Skeleton className='h-7 w-48' />
          <Skeleton className='h-4 w-80' />
          <Skeleton className='h-40 w-full rounded-md' />
        </div>
      </main>
    </div>
  );
}

export function PlatformAssistantPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const userQuery = useQuery(api.users.currentUser);
  const user = userQuery.data;
  const modelsQuery = useQuery(
    api.platformAdmin.queries.getAssistantModels,
    user?.role === PLATFORM_ADMIN_ROLE ? {} : 'skip',
  );

  const updateModels = useMutation(
    api.platformAdmin.mutations.updateAssistantModels,
  );

  const [models, setModels] = useState<ModelEntry[]>([]);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync server state to local
  useEffect(() => {
    if (!modelsQuery.data || hasLocalEdits) return;
    setModels(
      modelsQuery.data.map(m => ({
        modelId: m.modelId,
        name: m.name,
        hint: m.hint ?? '',
      })),
    );
  }, [modelsQuery.data, hasLocalEdits]);

  // Auth guard
  useEffect(() => {
    if (userQuery.isPending) return;
    if (user === null) {
      router.replace(`/auth/login?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user?.role !== PLATFORM_ADMIN_ROLE) {
      router.replace('/403');
    }
  }, [pathname, router, user, userQuery.isPending]);

  if (
    userQuery.isPending ||
    (user?.role === PLATFORM_ADMIN_ROLE && modelsQuery.isPending)
  ) {
    return <AssistantPageSkeleton />;
  }

  if (userQuery.isError || user?.role !== PLATFORM_ADMIN_ROLE) {
    return null;
  }

  const handleAddModel = () => {
    setModels(current => [...current, { modelId: '', name: '', hint: '' }]);
    setHasLocalEdits(true);
  };

  const handleUpdateModel = (
    index: number,
    field: keyof ModelEntry,
    value: string,
  ) => {
    setModels(current =>
      current.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
    setHasLocalEdits(true);
  };

  const handleRemoveModel = (index: number) => {
    setModels(current => current.filter((_, i) => i !== index));
    setHasLocalEdits(true);
  };

  const handleSave = async () => {
    const valid = models.filter(m => m.modelId.trim() && m.name.trim());
    setIsSaving(true);
    try {
      await updateModels({
        models: valid.map(m => ({
          modelId: m.modelId.trim(),
          name: m.name.trim(),
          hint: m.hint.trim() || undefined,
        })),
      });
      setHasLocalEdits(false);
      toast.success('Assistant models updated');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save models',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='bg-secondary flex h-screen'>
      <aside className='hidden w-56 lg:block'>
        <div className='flex h-full flex-col'>
          <div className='flex-1 overflow-y-auto'>
            <PlatformAdminSidebar />
          </div>
          <div className='border-border border-t p-2'>
            <UserMenu />
          </div>
        </div>
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent
          side='left'
          showCloseButton={false}
          className='bg-secondary w-56 p-0 sm:max-w-56'
        >
          <SheetTitle className='sr-only'>Platform admin navigation</SheetTitle>
          <div className='flex h-full flex-col'>
            <div className='flex-1 overflow-y-auto'>
              <PlatformAdminSidebar />
            </div>
            <div className='border-border border-t p-2'>
              <UserMenu />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <main className='bg-background relative m-2 ml-0 flex-1 overflow-y-auto rounded-md border'>
        <button
          onClick={() => setIsMobileOpen(true)}
          className='hover:bg-accent/80 absolute top-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-md transition-colors lg:hidden'
          aria-label='Open platform admin menu'
        >
          <Menu className='text-muted-foreground size-4' />
        </button>

        <div className='border-b'>
          <div className='flex items-center p-1 pl-8 lg:pl-1'>
            <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
              <Shield className='size-3.5' />
              Platform Admin
            </span>
          </div>
        </div>

        <div className='space-y-4 p-3'>
          <div className='space-y-1'>
            <h1 className='text-lg font-semibold tracking-tight'>
              Assistant Models
            </h1>
            <p className='text-muted-foreground text-sm'>
              Configure which AI models appear in the assistant model selector
              for all users. If no models are configured, a built-in fallback
              list is used.
            </p>
          </div>

          <div className='space-y-3'>
            {models.map((entry, index) => (
              <div
                key={index}
                className='bg-muted/30 flex items-start gap-2 rounded-lg border p-3'
              >
                <div className='grid min-w-0 flex-1 gap-2 sm:grid-cols-3'>
                  <Input
                    value={entry.modelId}
                    onChange={e =>
                      handleUpdateModel(index, 'modelId', e.target.value)
                    }
                    placeholder='openrouter/model-id'
                    className='h-8 font-mono text-xs'
                  />
                  <Input
                    value={entry.name}
                    onChange={e =>
                      handleUpdateModel(index, 'name', e.target.value)
                    }
                    placeholder='Display name'
                    className='h-8 text-xs'
                  />
                  <Input
                    value={entry.hint}
                    onChange={e =>
                      handleUpdateModel(index, 'hint', e.target.value)
                    }
                    placeholder='Short description (optional)'
                    className='h-8 text-xs'
                  />
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground hover:text-destructive size-8 shrink-0 p-0'
                  onClick={() => handleRemoveModel(index)}
                >
                  <Trash2 className='size-3.5' />
                </Button>
              </div>
            ))}

            <Button
              type='button'
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={handleAddModel}
            >
              <Plus className='size-3.5' />
              Add model
            </Button>
          </div>

          <div className='flex items-center gap-2 pt-2'>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasLocalEdits}
              size='sm'
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            {hasLocalEdits && (
              <span className='text-muted-foreground text-xs'>
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
