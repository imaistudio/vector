'use client';

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';
import { useTouchPrimary } from '@/hooks/use-has-primary-touch';

const ScrollAreaContext = React.createContext<boolean>(false);

type Mask = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

type ScrollbarVisibility = 'both' | 'vertical' | 'horizontal' | 'none';

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    viewportClassName?: string;
    viewportStyle?: React.CSSProperties;
    maskHeight?: number;
    maskClassName?: string;
    viewportRef?: React.ForwardedRef<HTMLDivElement>;
    scrollTopContainer?: boolean;
    scrollbars?: ScrollbarVisibility;
  }
>(
  (
    {
      className,
      children,
      scrollHideDelay = 0,
      viewportClassName,
      viewportStyle,
      maskClassName,
      maskHeight = 30,
      viewportRef: externalViewportRef,
      scrollTopContainer = false,
      scrollbars = 'both',
      ...props
    },
    ref,
  ) => {
    const [showMask, setShowMask] = React.useState<Mask>({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });
    const internalViewportRef = React.useRef<HTMLDivElement>(null);
    const scrollCheckFrameRef = React.useRef<number | null>(null);
    const isTouch = useTouchPrimary();
    const showVerticalScrollbar =
      scrollbars === 'both' || scrollbars === 'vertical';
    const showHorizontalScrollbar =
      scrollbars === 'both' || scrollbars === 'horizontal';

    React.useImperativeHandle(
      externalViewportRef,
      () => internalViewportRef.current as HTMLDivElement,
    );

    React.useEffect(() => {
      if (showHorizontalScrollbar) return;
      const element = internalViewportRef.current;
      if (!element || element.scrollLeft === 0) return;
      element.scrollLeft = 0;
    }, [showHorizontalScrollbar]);

    const checkScrollability = React.useCallback(() => {
      const element = internalViewportRef.current;
      if (!element) return;

      const {
        scrollTop,
        scrollLeft,
        scrollWidth,
        clientWidth,
        scrollHeight,
        clientHeight,
      } = element;

      const computed = window.getComputedStyle(element);
      const overflowX = computed.overflowX;
      const horizontalHidden = overflowX === 'hidden' || overflowX === 'clip';

      setShowMask(prev => {
        const next = {
          top: scrollTop > 0,
          bottom: scrollTop + clientHeight < scrollHeight - 1,
          left: horizontalHidden ? false : scrollLeft > 0,
          right: horizontalHidden
            ? false
            : scrollLeft + clientWidth < scrollWidth - 1,
        };

        if (
          prev.top === next.top &&
          prev.bottom === next.bottom &&
          prev.left === next.left &&
          prev.right === next.right
        ) {
          return prev;
        }

        return next;
      });
    }, []);

    const scheduleScrollabilityCheck = React.useCallback(() => {
      if (typeof window === 'undefined') return;
      if (scrollCheckFrameRef.current !== null) return;

      scrollCheckFrameRef.current = window.requestAnimationFrame(() => {
        scrollCheckFrameRef.current = null;
        checkScrollability();
      });
    }, [checkScrollability]);

    React.useEffect(() => {
      if (typeof window === 'undefined') return;
      if (maskHeight <= 0) return;

      const element = internalViewportRef.current;
      if (!element) return;

      const controller = new AbortController();
      const { signal } = controller;

      const resizeObserver = new ResizeObserver(scheduleScrollabilityCheck);
      resizeObserver.observe(element);

      element.addEventListener('scroll', scheduleScrollabilityCheck, {
        signal,
        passive: true,
      });
      window.addEventListener('resize', scheduleScrollabilityCheck, { signal });

      checkScrollability();

      return () => {
        controller.abort();
        resizeObserver.disconnect();
        if (scrollCheckFrameRef.current !== null) {
          window.cancelAnimationFrame(scrollCheckFrameRef.current);
          scrollCheckFrameRef.current = null;
        }
      };
    }, [checkScrollability, isTouch, maskHeight, scheduleScrollabilityCheck]);

    return (
      <ScrollAreaContext.Provider value={isTouch}>
        {isTouch ? (
          <div
            ref={ref}
            role='group'
            data-slot='scroll-area'
            aria-roledescription='scroll area'
            className={cn(
              'relative max-w-full min-w-0 overflow-hidden',
              className,
            )}
            {...props}
          >
            <div
              ref={internalViewportRef}
              data-slot='scroll-area-viewport'
              data-scroll-top-container={
                scrollTopContainer ? 'true' : undefined
              }
              className={cn(
                'size-full max-w-full min-w-0 rounded-[inherit]',
                scrollbars === 'both' && 'overflow-auto',
                scrollbars === 'vertical' &&
                  'overflow-x-hidden overflow-y-auto',
                scrollbars === 'horizontal' &&
                  'overflow-x-auto overflow-y-hidden',
                scrollbars === 'none' && 'overflow-hidden',
                viewportClassName,
              )}
              style={viewportStyle}
              tabIndex={0}
            >
              {children}
            </div>

            {maskHeight > 0 ? (
              <ScrollMask
                showMask={showMask}
                className={maskClassName}
                maskHeight={maskHeight}
              />
            ) : null}
          </div>
        ) : (
          <ScrollAreaPrimitive.Root
            ref={ref}
            data-slot='scroll-area'
            scrollHideDelay={scrollHideDelay}
            className={cn(
              'relative max-w-full min-w-0 overflow-hidden',
              className,
            )}
            {...props}
          >
            <ScrollAreaPrimitive.Viewport
              ref={internalViewportRef}
              data-slot='scroll-area-viewport'
              data-scroll-top-container={
                scrollTopContainer ? 'true' : undefined
              }
              className={cn(
                'size-full max-w-full min-w-0 rounded-[inherit]',
                !showHorizontalScrollbar &&
                  '[&>div]:!block [&>div]:!w-full [&>div]:!max-w-full [&>div]:!min-w-0 [&>div]:!overflow-x-hidden',
                viewportClassName,
              )}
              style={viewportStyle}
            >
              {children}
            </ScrollAreaPrimitive.Viewport>

            {maskHeight > 0 ? (
              <ScrollMask
                showMask={showMask}
                className={maskClassName}
                maskHeight={maskHeight}
              />
            ) : null}
            {showVerticalScrollbar ? (
              <ScrollBar orientation='vertical' />
            ) : null}
            {showHorizontalScrollbar ? (
              <ScrollBar orientation='horizontal' />
            ) : null}
            {showVerticalScrollbar && showHorizontalScrollbar ? (
              <ScrollAreaPrimitive.Corner />
            ) : null}
          </ScrollAreaPrimitive.Root>
        )}
      </ScrollAreaContext.Provider>
    );
  },
);

ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => {
  const isTouch = React.useContext(ScrollAreaContext);

  if (isTouch) return null;

  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      data-slot='scroll-area-scrollbar'
      className={cn(
        'hover:bg-muted dark:hover:bg-muted/50 data-[state=visible]:fade-in-0 data-[state=hidden]:fade-out-0 data-[state=visible]:animate-in data-[state=hidden]:animate-out z-50 flex touch-none p-px transition-[width,height,background-color] duration-150 select-none',
        orientation === 'vertical' && 'h-full w-1 border-l-0 hover:w-2',
        orientation === 'horizontal' &&
          'h-1 flex-col border-t-0 px-1 pr-1.25 hover:h-2',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot='scroll-area-thumb'
        className={cn(
          'bg-border/60 relative flex-1 origin-center rounded-full transition-[transform,background-color]',
          orientation === 'vertical' && 'my-1 active:scale-y-95',
          orientation === 'horizontal' && 'active:scale-x-98',
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});

ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

function ScrollMask({
  showMask,
  maskHeight,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  showMask: Mask;
  maskHeight: number;
}) {
  return (
    <>
      <div
        {...props}
        aria-hidden='true'
        style={
          {
            '--top-fade-height': showMask.top ? `${maskHeight}px` : '0px',
            '--bottom-fade-height': showMask.bottom ? `${maskHeight}px` : '0px',
          } as React.CSSProperties
        }
        className={cn(
          'pointer-events-none absolute inset-0 z-10',
          "before:absolute before:inset-x-0 before:top-0 before:transition-[height,opacity] before:duration-300 before:content-['']",
          "after:absolute after:inset-x-0 after:bottom-0 after:transition-[height,opacity] after:duration-300 after:content-['']",
          'before:h-(--top-fade-height) after:h-(--bottom-fade-height)',
          showMask.top ? 'before:opacity-100' : 'before:opacity-0',
          showMask.bottom ? 'after:opacity-100' : 'after:opacity-0',
          'before:from-background before:bg-gradient-to-b before:to-transparent',
          'after:from-background after:bg-gradient-to-t after:to-transparent',
          className,
        )}
      />
      <div
        {...props}
        aria-hidden='true'
        style={
          {
            '--left-fade-width': showMask.left ? `${maskHeight}px` : '0px',
            '--right-fade-width': showMask.right ? `${maskHeight}px` : '0px',
          } as React.CSSProperties
        }
        className={cn(
          'pointer-events-none absolute inset-0 z-10',
          "before:absolute before:inset-y-0 before:left-0 before:transition-[width,opacity] before:duration-300 before:content-['']",
          "after:absolute after:inset-y-0 after:right-0 after:transition-[width,opacity] after:duration-300 after:content-['']",
          'before:w-(--left-fade-width) after:w-(--right-fade-width)',
          showMask.left ? 'before:opacity-100' : 'before:opacity-0',
          showMask.right ? 'after:opacity-100' : 'after:opacity-0',
          'before:from-background before:bg-gradient-to-r before:to-transparent',
          'after:from-background after:bg-gradient-to-l after:to-transparent',
          className,
        )}
      />
    </>
  );
}

export { ScrollArea, ScrollBar };
