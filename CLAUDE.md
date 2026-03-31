# VoiceStack: Rubik's Cube Voice Timer
**Tech Stack:** Next.js (App Router), Tailwind CSS, Web Speech API.

## 1. Core Logic & State
* **High-Precision Timing:** Use `requestAnimationFrame` for the main clock. Do NOT use `setInterval`.
* **State Management:**
    * `useRef` for timer values (prevents re-renders).
    * `useState` for the lap list and UI color states.

## 2. Voice Engine (Web Speech API)
* **Architecture:** `SpeechRecognition` in continuous mode, auto-restarted on `onend`.
* **Keyword Matching:** Strip punctuation from each word (`word.replace(/[^a-z]/g, "")`) before map lookup.
* **Command Mapping:**
    * **"Start" / "Begin"** → `startTimer()`. UI: `bg-blue-600`.
    * **"Split" / "Lap"** → `recordLap()`. UI: Flash `bg-white` for 150ms, then stay `bg-blue-600`.
    * **"Done" / "Finish"** → `stopTimer()`. UI: `bg-green-600`.
    * **"Reset"** → `clearTimer()`. UI: `bg-slate-900`.
* **Browser support:** Chrome/Edge only. Requires HTTPS or localhost.

## 3. UI & Styling (Tailwind)
* **Transitions:** `transition-colors duration-200` on the main wrapper.
* **Timer:** Large centered monospaced font (`font-mono text-8xl`).
* **Split flash:** `scale-110` + white background for 150ms; switch to `text-slate-900` during flash for readability.
* **Laps:** Scrollable list with total elapsed and delta (time since last lap) columns.
* **Transcript log:** Live debug box showing last 20 STT results.

## 4. Development Standards
* No "Start Session" button required — Web Speech API starts automatically on mount.
* Keep all logic in `app/page.tsx` unless the file grows unwieldy.
