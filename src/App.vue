<script setup lang="ts">
import AppShell from './app/AppShell.vue'
</script>

<template>
  <AppShell />
</template>

<style>
/* ═══════════════════════════════════════════════
   gcode-viewer — Design Tokens
   Aesthetic: "Precision Workshop"
   Industrial dark theme with amber accent lighting
   ═══════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

:root {
  /* ── Palette ─────────────────────────────── */
  --color-bg: #0d1117;
  --color-surface: #161b22;
  --color-editor-bg: #0d1117;
  --color-border: #30363d;
  --color-hover: rgba(177, 186, 196, 0.06);
  --color-active: rgba(177, 186, 196, 0.1);

  /* ── Text ────────────────────────────────── */
  --color-text: #e6edf3;
  --color-text-secondary: #c9d1d9;
  --color-text-muted: #8b949e;

  /* ── Accent ──────────────────────────────── */
  --color-amber: #e8a838;
  --color-amber-hover: #d49830;
  --color-blue: #58a6ff;
  --color-green: #3fb950;
  --color-warning: #d29922;
  --color-error: #f85149;
  --color-error-hover: #d63c36;

  /* ── Typography ──────────────────────────── */
  --font-ui: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
}

/* ── Reset ──────────────────────────────────── */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100%;
}

/* ── Scrollbar — thin, matching theme ──────── */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(139, 148, 158, 0.25);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 148, 158, 0.4);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* ── Selection ─────────────────────────────── */
::selection {
  background: rgba(88, 166, 255, 0.2);
}

/* ── Focus visible ─────────────────────────── */
:focus-visible {
  outline: 1px solid var(--color-amber);
  outline-offset: 1px;
}

/* ── Subtle background texture ─────────────── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background-image:
    repeating-linear-gradient(
      90deg,
      rgba(232, 168, 56, 0.008) 0px,
      rgba(232, 168, 56, 0.008) 1px,
      transparent 1px,
      transparent 60px
    ),
    repeating-linear-gradient(
      0deg,
      rgba(232, 168, 56, 0.008) 0px,
      rgba(232, 168, 56, 0.008) 1px,
      transparent 1px,
      transparent 60px
    );
}

/* ── Dialog Buttons ────────────────────────── */
.dialog__btn {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 400;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.12s;
}

.dialog__btn--secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}
.dialog__btn--secondary:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.dialog__btn--primary {
  background: var(--color-amber);
  border: 1px solid var(--color-amber);
  color: #0d1117;
  font-weight: 600;
}
.dialog__btn--primary:hover {
  background: var(--color-amber-hover);
  border-color: var(--color-amber-hover);
}

.dialog__btn--danger {
  background: var(--color-error);
  border: 1px solid var(--color-error);
  color: white;
}
.dialog__btn--danger:hover {
  background: var(--color-error-hover);
  border-color: var(--color-error-hover);
  box-shadow: 0 2px 8px rgba(248, 81, 73, 0.35);
}
</style>
