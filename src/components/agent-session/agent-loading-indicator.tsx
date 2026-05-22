'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const;

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('spinner', className)}
      role='status'
      aria-label='Loading'
    >
      <span className='spinner-cube' />
      <span className='spinner-cube' />
      <span className='spinner-cube' />
      <span className='spinner-cube' />
      <span className='spinner-cube' />
      <span className='spinner-cube' />
      <span className='spinner-cube' />
      <span className='spinner-cube' />
      <span className='spinner-cube' />
    </span>
  );
}

export function LoadingIndicator({
  label,
  animated = true,
  showSpinner = true,
  showElapsed = false,
  className,
  spinnerClassName,
  labelClassName,
  elapsedClassName,
}: {
  label?: string;
  animated?: boolean;
  showSpinner?: boolean;
  showElapsed?: boolean | number;
  className?: string;
  spinnerClassName?: string;
  labelClassName?: string;
  elapsedClassName?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showElapsed) return;

    if (typeof showElapsed === 'number') {
      startTimeRef.current = showElapsed;
    } else if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Date.now() - startTimeRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [showElapsed]);

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {showSpinner ? (
        animated ? (
          <Spinner className={spinnerClassName} />
        ) : (
          <span className='inline-flex h-[1em] w-[1em] items-center justify-center'>
            ●
          </span>
        )
      ) : null}
      {label !== undefined ? (
        <AnimatePresence mode='popLayout' initial={false}>
          <motion.span
            key={label}
            className={cn('text-muted-foreground', labelClassName)}
            initial={reduceMotion ? false : { opacity: 0, filter: 'blur(3px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, filter: 'blur(3px)' }
            }
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      ) : null}
      {showElapsed && elapsed >= 1000 ? (
        <span
          className={cn(
            'text-muted-foreground/60 tabular-nums',
            elapsedClassName,
          )}
        >
          ({formatDuration(elapsed)})
        </span>
      ) : null}
    </span>
  );
}

export function AgentLoadingIndicator() {
  return (
    <div className='space-y-2 px-3 py-3'>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className='bg-foreground/[0.025] flex items-start gap-3 rounded-[12px] px-3 py-2.5'
        >
          <Skeleton className='size-6 rounded-full' />
          <div className='min-w-0 flex-1 space-y-2 py-0.5'>
            <Skeleton className='h-3.5 w-2/5' />
            <Skeleton className='h-3.5 w-full' />
          </div>
        </div>
      ))}
    </div>
  );
}
