'use client';

import { useCallback, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/**
 * Hook that provides a promise-based confirm dialog to replace window.confirm().
 *
 * Usage:
 * ```tsx
 * const [confirm, ConfirmDialog] = useConfirm();
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({
 *     title: 'Delete item',
 *     description: 'This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     variant: 'destructive',
 *   });
 *   if (!ok) return;
 *   // proceed with deletion
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Delete</Button>
 *     <ConfirmDialog />
 *   </>
 * );
 * ```
 */
export function useConfirm(): [ConfirmFn, () => React.ReactElement | null] {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm: ConfirmFn = useCallback(options => {
    return new Promise<boolean>(resolve => {
      setState({ options, resolve });
    });
  }, []);

  const handleResponse = useCallback(
    (value: boolean) => {
      state?.resolve(value);
      setState(null);
    },
    [state],
  );

  const ConfirmDialog = useCallback(() => {
    if (!state) return null;
    const { options } = state;
    const isDestructive = options.variant === 'destructive';

    return (
      <AlertDialog
        open
        onOpenChange={open => {
          if (!open) handleResponse(false);
        }}
      >
        <AlertDialogContent className='gap-3 p-4 sm:max-w-sm'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-sm font-semibold'>
              {options.title}
            </AlertDialogTitle>
            <AlertDialogDescription className='text-xs'>
              {options.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex-row justify-end gap-2'>
            <AlertDialogCancel
              size='sm'
              variant='ghost'
              onClick={() => handleResponse(false)}
            >
              {options.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              size='sm'
              variant={isDestructive ? 'destructive' : 'default'}
              onClick={() => handleResponse(true)}
            >
              {options.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [state, handleResponse]);

  return [confirm, ConfirmDialog];
}
