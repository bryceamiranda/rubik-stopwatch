"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type TimerState = "idle" | "running" | "stopped";
type Command = "start" | "split" | "done" | "reset";

interface Lap {
  index: number;
  elapsed: number; // ms from timer start
  delta: number;   // ms since previous lap
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(ms: number): string {
  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const centiseconds = Math.floor((totalMs % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

// Strip punctuation then map keyword → command
const KEYWORD_MAP: Record<string, Command> = {
  start:  "start",
  begin:  "start",
  split:  "split",
  lap:    "split",
  done:   "done",
  finish: "done",
  reset:  "reset",
};

// ── Background colors ──────────────────────────────────────────────────────
const BG: Record<string, string> = {
  idle:    "bg-slate-900",
  running: "bg-blue-600",
  split:   "bg-white",
  stopped: "bg-green-600",
};

// ── Component ──────────────────────────────────────────────────────────────
export default function VoiceTimer() {
  const [timerState, setTimerState]       = useState<TimerState>("idle");
  const [elapsed, setElapsed]             = useState(0);
  const [laps, setLaps]                   = useState<Lap[]>([]);
  const [bgColor, setBgColor]             = useState(BG.idle);
  const [splitFlash, setSplitFlash]       = useState(false);
  const [lastCommand, setLastCommand]     = useState<string>("—");
  const [micActive, setMicActive]         = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [transcriptLog, setTranscriptLog] = useState<string[]>([]);

  // Refs — timer
  const timerStateRef     = useRef<TimerState>("idle");
  const startTimeRef      = useRef(0);
  const elapsedAtPauseRef = useRef(0);
  const rafRef            = useRef(0);
  const lapCountRef       = useRef(0);
  const lastLapElapsedRef = useRef(0);

  // Refs — voice
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ── Timer RAF ─────────────────────────────────────────────────────────────
  const startRaf = useCallback(() => {
    startTimeRef.current = performance.now() - elapsedAtPauseRef.current;
    const tick = () => {
      setElapsed(performance.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    elapsedAtPauseRef.current = performance.now() - startTimeRef.current;
  }, []);

  // ── Command handler ───────────────────────────────────────────────────────
  const handleCommand = useCallback(
    (cmd: Command) => {
      const state = timerStateRef.current;
      setLastCommand(cmd.toUpperCase());

      if (cmd === "start" && state !== "running") {
        timerStateRef.current = "running";
        setTimerState("running");
        setBgColor(BG.running);
        lapCountRef.current = 0;
        lastLapElapsedRef.current = 0;
        setLaps([]);
        startRaf();
      } else if (cmd === "split" && state === "running") {
        const now = performance.now() - startTimeRef.current;
        const delta = now - lastLapElapsedRef.current;
        lastLapElapsedRef.current = now;
        lapCountRef.current += 1;
        setLaps((prev) => [
          ...prev,
          { index: lapCountRef.current, elapsed: now, delta },
        ]);
        // Flash white 150 ms then return to running blue
        setBgColor(BG.split);
        setSplitFlash(true);
        setTimeout(() => {
          setBgColor(BG.running);
          setSplitFlash(false);
        }, 150);
      } else if (cmd === "done" && state === "running") {
        stopRaf();
        timerStateRef.current = "stopped";
        setTimerState("stopped");
        setBgColor(BG.stopped);
      } else if (cmd === "reset") {
        stopRaf();
        elapsedAtPauseRef.current = 0;
        timerStateRef.current = "idle";
        setTimerState("idle");
        setElapsed(0);
        setLaps([]);
        lapCountRef.current = 0;
        lastLapElapsedRef.current = 0;
        setBgColor(BG.idle);
        setLastCommand("—");
      }
    },
    [startRaf, stopRaf]
  );

  // ── Web Speech API ────────────────────────────────────────────────────────
  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SR) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript
          .trim()
          .toLowerCase();

      setTranscriptLog((prev) => [transcript, ...prev].slice(0, 20));

      for (const word of transcript.split(/\s+/)) {
        const cmd = KEYWORD_MAP[word.replace(/[^a-z]/g, "")];
        if (cmd) {
          handleCommand(cmd);
          break;
        }
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("SpeechRecognition error:", e.error);
      }
    };

    recognition.onend = () => {
      // Keep alive — restart unless the component is unmounting
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* already starting */ }
      }
    };

    recognition.start();
    setMicActive(true);

    return () => {
      recognitionRef.current = null;
      recognition.abort();
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleCommand]);

  // Dark text during white split flash
  const textColor = splitFlash ? "text-slate-900" : "text-white";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main
      className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-200 ${bgColor}`}
    >
      {/* Timer display */}
      <div
        className={`text-8xl font-mono font-bold drop-shadow-lg select-none
          transition-all duration-150 ${textColor}
          ${splitFlash ? "scale-110" : "scale-100"}`}
      >
        {formatTime(elapsed)}
      </div>

      {/* Status row */}
      <div className={`mt-6 flex items-center gap-4 ${textColor} text-sm font-mono opacity-80`}>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              micActive ? "bg-green-400 animate-pulse" : "bg-red-500"
            }`}
          />
          {speechSupported
            ? micActive ? "Listening" : "Mic off"
            : "Speech API not supported"}
        </span>
        <span className="opacity-40">|</span>
        <span>
          State: <span className="font-semibold uppercase">{timerState}</span>
        </span>
        <span className="opacity-40">|</span>
        <span>
          Last: <span className="font-semibold">{lastCommand}</span>
        </span>
      </div>

      {/* Transcript log */}
      <div className="mt-6 w-full max-w-sm">
        <h2 className="text-white/50 text-xs font-mono uppercase tracking-widest mb-1 text-center">
          Mic transcript
        </h2>
        <div className="bg-black/30 rounded-lg px-4 py-2 h-28 overflow-y-auto flex flex-col gap-0.5">
          {transcriptLog.length === 0 ? (
            <span className="text-white/30 text-xs font-mono italic">say something…</span>
          ) : (
            transcriptLog.map((t, i) => (
              <span
                key={i}
                className={`font-mono text-xs ${i === 0 ? "text-white" : "text-white/40"}`}
              >
                {t}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Keyword reference */}
      <div className="mt-8 grid grid-cols-4 gap-3 text-center text-xs text-white/60 font-mono">
        {[
          { words: "Start / Begin", color: "bg-blue-600/40"  },
          { words: "Split / Lap",   color: "bg-white/20"     },
          { words: "Done / Finish", color: "bg-green-600/40" },
          { words: "Reset",         color: "bg-slate-700/40" },
        ].map(({ words, color }) => (
          <div key={words} className={`rounded-lg px-3 py-2 ${color}`}>
            {words}
          </div>
        ))}
      </div>

      {/* Lap list with delta column */}
      {laps.length > 0 && (
        <div className="mt-8 w-full max-w-xs">
          <h2 className="text-white/70 text-xs font-mono uppercase tracking-widest mb-2 text-center">
            Splits
          </h2>
          <ul className="flex flex-col gap-1.5">
            {laps.map((lap) => (
              <li
                key={lap.index}
                className="flex justify-between items-center bg-white/10 rounded-lg px-4 py-1.5 font-mono text-sm text-white"
              >
                <span className="text-white/50 w-6">#{lap.index}</span>
                <span>{formatTime(lap.elapsed)}</span>
                <span className="text-white/50 text-xs">+{formatTime(lap.delta)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
