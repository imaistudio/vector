'use client';

import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Responsive Dialog — Dialog on desktop, bottom Sheet (drawer) on mobile
// ---------------------------------------------------------------------------

interface ResponsiveDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function ResponsiveDialog({ children, ...props }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <Sheet {...props}>{children}</Sheet>;
  }
  return <Dialog {...props}>{children}</Dialog>;
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

function ResponsiveDialogTrigger({
  className,
  asChild,
  ...props
}: React.ComponentProps<typeof DialogTrigger> & { asChild?: boolean }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <SheetTrigger className={className} asChild={asChild} {...props} />;
  }
  return <DialogTrigger className={className} asChild={asChild} {...props} />;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  showCloseButton?: boolean;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <SheetContent
        side='bottom'
        showCloseButton={showCloseButton}
        className={cn(
          'max-h-[85dvh] overflow-y-auto rounded-t-xl px-4 pb-16',
          className,
        )}
        {...(props as React.ComponentProps<typeof SheetContent>)}
      >
        {/* Drag handle */}
        <div className='bg-muted-foreground/30 mx-auto mt-3 mb-4 h-1 w-10 shrink-0 rounded-full' />
        {children}
      </SheetContent>
    );
  }
  return (
    <DialogContent
      className={className}
      showCloseButton={showCloseButton}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <SheetHeader className={cn('px-0', className)} {...props} />;
  }
  return <DialogHeader className={className} {...props} />;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <SheetFooter className={cn('px-0', className)} {...props} />;
  }
  return <DialogFooter className={className} {...props} />;
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <SheetTitle className={className} {...props} />;
  }
  return <DialogTitle className={className} {...props} />;
}

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <SheetDescription className={className} {...props} />;
  }
  return <DialogDescription className={className} {...props} />;
}

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

function ResponsiveDialogClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <SheetClose {...(props as React.ComponentProps<typeof SheetClose>)} />
    );
  }
  return <DialogClose {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
};
