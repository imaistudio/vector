'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useTheme } from 'next-themes';
import { useCachedQuery, useMutation } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const TERMINAL_THEME_DARK = {
  background: '#000000',
  foreground: '#c7c7c7',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selectionBackground: '#ffffff40',
  black: '#000000',
  red: '#c91b00',
  green: '#00c200',
  yellow: '#c7c400',
  blue: '#0225c7',
  magenta: '#c930c7',
  cyan: '#00c5c7',
  white: '#c7c7c7',
  brightBlack: '#676767',
  brightRed: '#ff6d67',
  brightGreen: '#5ff967',
  brightYellow: '#fefb67',
  brightBlue: '#6871ff',
  brightMagenta: '#ff76ff',
  brightCyan: '#5ffdff',
  brightWhite: '#feffff',
} as const;

const TERMINAL_THEME_LIGHT = {
  background: '#ffffff',
  foreground: '#000000',
  cursor: '#000000',
  cursorAccent: '#ffffff',
  selectionBackground: '#00000040',
  black: '#000000',
  red: '#c91b00',
  green: '#00c200',
  yellow: '#c7c400',
  blue: '#0225c7',
  magenta: '#c930c7',
  cyan: '#00c5c7',
  white: '#c7c7c7',
  brightBlack: '#676767',
  brightRed: '#ff6d67',
  brightGreen: '#5ff967',
  brightYellow: '#fefb67',
  brightBlue: '#6871ff',
  brightMagenta: '#ff76ff',
  brightCyan: '#5ffdff',
  brightWhite: '#feffff',
} as const;

// Prefix for control messages over DataChannel (resize, etc.)
const CONTROL_PREFIX = '\x00';

export function WorkSessionTerminal({
  snapshot,
  tmuxSessionName,
  workSessionId,
  isTerminal,
}: {
  snapshot: string;
  tmuxSessionName?: string;
  workSessionId?: Id<'workSessions'>;
  isTerminal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [rtcConnected, setRtcConnected] = useState(false);
  const processedSignalsRef = useRef(new Set<string>());
  const { resolvedTheme } = useTheme();

  const terminalTheme = useMemo(
    () =>
      resolvedTheme === 'dark' ? TERMINAL_THEME_DARK : TERMINAL_THEME_LIGHT,
    [resolvedTheme],
  );

  const canUseRtc = Boolean(tmuxSessionName && workSessionId && !isTerminal);

  // Signaling: send offer/candidate to Convex
  const sendSignal = useMutation(api.agentBridge.mutations.sendTerminalSignal);

  // Signaling: get answer/candidate from bridge
  const signals = useCachedQuery(
    api.agentBridge.queries.getTerminalSignals,
    canUseRtc && workSessionId
      ? { workSessionId, for: 'browser' as const }
      : 'skip',
  );

  // Process incoming signals from bridge (answer + ICE candidates)
  useEffect(() => {
    if (!signals || !pcRef.current) return;

    for (const signal of signals) {
      if (processedSignalsRef.current.has(signal._id)) continue;
      processedSignalsRef.current.add(signal._id);

      if (signal.type === 'answer') {
        const answer = JSON.parse(signal.data);
        pcRef.current
          .setRemoteDescription(new RTCSessionDescription(answer))
          .catch(() => {
            // ignore
          });
      } else if (signal.type === 'candidate') {
        const candidate = JSON.parse(signal.data);
        pcRef.current
          .addIceCandidate(
            new RTCIceCandidate({
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid ?? '0',
            }),
          )
          .catch(() => {
            // ignore
          });
      }
    }
  }, [signals]);

  // Set up WebRTC connection
  const startRtc = useCallback(
    async (terminal: Terminal, fitAddon: FitAddon) => {
      if (!canUseRtc || !workSessionId) return;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Create DataChannel
      const dc = pc.createDataChannel('terminal', {
        ordered: true,
      });
      dcRef.current = dc;

      dc.onopen = () => {
        setRtcConnected(true);
        terminal.write('\u001b[2J\u001b[H'); // Clear snapshot content

        // Send initial resize
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          dc.send(
            CONTROL_PREFIX +
              JSON.stringify({
                type: 'resize',
                cols: dims.cols,
                rows: dims.rows,
              }),
          );
        }
      };

      dc.onmessage = event => {
        if (typeof event.data === 'string') {
          terminal.write(event.data);
        }
      };

      dc.onclose = () => {
        setRtcConnected(false);
      };

      // Send ICE candidates to Convex
      pc.onicecandidate = event => {
        if (event.candidate) {
          void sendSignal({
            workSessionId,
            from: 'browser',
            type: 'candidate',
            data: JSON.stringify({
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
            }),
          });
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal({
        workSessionId,
        from: 'browser',
        type: 'offer',
        data: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type,
        }),
      });
    },
    [canUseRtc, workSessionId, sendSignal],
  );

  // Initialize xterm.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container || terminalRef.current) return;

    const terminal = new Terminal({
      allowTransparency: false,
      convertEol: !canUseRtc,
      cursorBlink: true,
      cursorStyle: 'block',
      disableStdin: false,
      drawBoldTextInBrightColors: true,
      fontFamily:
        '"SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: terminalTheme,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    // Forward keystrokes to DataChannel
    terminal.onData(data => {
      const dc = dcRef.current;
      if (dc && dc.readyState === 'open') {
        dc.send(data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const dc = dcRef.current;
      const dims = fitAddon.proposeDimensions();
      if (dc && dc.readyState === 'open' && dims) {
        dc.send(
          CONTROL_PREFIX +
            JSON.stringify({
              type: 'resize',
              cols: dims.cols,
              rows: dims.rows,
            }),
        );
      }
    });
    resizeObserver.observe(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    resizeObserverRef.current = resizeObserver;

    // Start WebRTC
    void startRtc(terminal, fitAddon);

    return () => {
      // Close WebRTC
      dcRef.current?.close();
      pcRef.current?.close();
      dcRef.current = null;
      pcRef.current = null;
      setRtcConnected(false);

      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      resizeObserverRef.current = null;
    };
  }, [terminalTheme, canUseRtc, startRtc]);

  // Update theme
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = terminalTheme;
  }, [terminalTheme]);

  // Render snapshots only when NOT connected via WebRTC
  useEffect(() => {
    if (rtcConnected) return;
    const terminal = terminalRef.current;
    if (!terminal) return;

    terminal.write('\u001b[2J\u001b[H');
    if (snapshot.trim()) {
      terminal.write(snapshot.replace(/\r?\n/g, '\r\n'));
    }
    fitAddonRef.current?.fit();
  }, [snapshot, rtcConnected]);

  return (
    <div className='overflow-hidden rounded-md'>
      <div
        ref={containerRef}
        className='vector-terminal h-[350px] w-full'
        style={{
          backgroundColor: terminalTheme.background,
        }}
      />
    </div>
  );
}
