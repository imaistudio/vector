'use client';

import { useEffect, useMemo, useRef } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useTheme } from 'next-themes';

const LIGHT_TERMINAL_THEME = {
  background: '#f6f7fb',
  foreground: '#111827',
  cursor: '#2563eb',
  cursorAccent: '#f6f7fb',
  selectionBackground: '#c7d2fe',
  black: '#0f172a',
  red: '#dc2626',
  green: '#15803d',
  yellow: '#b45309',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#e5e7eb',
  brightBlack: '#475569',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#f59e0b',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
} as const;

const DARK_TERMINAL_THEME = {
  background: '#111827',
  foreground: '#e5edf7',
  cursor: '#60a5fa',
  cursorAccent: '#111827',
  selectionBackground: '#334155',
  black: '#0f172a',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#cbd5e1',
  brightBlack: '#64748b',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f8fafc',
} as const;

export function WorkSessionTerminal({
  snapshot,
  workspacePath,
  paneId,
  branch,
  providerLabel,
}: {
  snapshot: string;
  workspacePath?: string;
  paneId?: string;
  branch?: string;
  providerLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { resolvedTheme } = useTheme();

  const terminalTheme = useMemo(
    () =>
      resolvedTheme === 'dark' ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,
    [resolvedTheme],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: false,
      cursorStyle: 'bar',
      disableStdin: true,
      drawBoldTextInBrightColors: true,
      fontFamily:
        'var(--font-geist-mono), "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.4,
      minimumContrastRatio: 4.5,
      scrollback: 2000,
      theme: terminalTheme,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      resizeObserverRef.current = null;
    };
  }, [terminalTheme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    terminal.options.theme = terminalTheme;
  }, [terminalTheme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    terminal.write('\u001b[2J\u001b[H');
    if (snapshot.trim()) {
      terminal.write(snapshot.replace(/\r?\n/g, '\r\n'));
    }
    fitAddonRef.current?.fit();
  }, [snapshot]);

  return (
    <div className='bg-muted/20 overflow-hidden rounded-lg border'>
      <div className='bg-background/80 border-b px-3 py-2'>
        <div className='flex items-center gap-2 text-[11px]'>
          <span className='bg-background rounded-full border px-1.5 py-0.5 font-medium'>
            tmux
          </span>
          {providerLabel && (
            <span className='text-muted-foreground rounded-full border px-1.5 py-0.5'>
              {providerLabel}
            </span>
          )}
          {branch && (
            <span className='text-muted-foreground font-mono'>{branch}</span>
          )}
          {paneId && (
            <span className='text-muted-foreground ml-auto font-mono'>
              {paneId}
            </span>
          )}
        </div>
        {workspacePath && (
          <div className='text-muted-foreground truncate pt-1 font-mono text-[11px]'>
            {workspacePath}
          </div>
        )}
      </div>
      <div className='vector-terminal px-3 py-2'>
        <div ref={containerRef} className='h-[280px] w-full' />
      </div>
    </div>
  );
}
