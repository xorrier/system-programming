<template>
  <div class="playground">
    <!-- Toolbar -->
    <div class="pg-toolbar">
      <div class="pg-toolbar-left">
        <span class="pg-title">⚙ C++ Playground</span>
        <select v-model="selectedStd" class="pg-select">
          <option value="c++17">C++17</option>
          <option value="c++20">C++20</option>
          <option value="c++14">C++14</option>
        </select>
        <select v-model="selectedCompiler" class="pg-select">
          <option value="gcc-head">GCC (latest)</option>
          <option value="clang-head">Clang (latest)</option>
        </select>
      </div>
      <div class="pg-toolbar-right">
        <button class="pg-btn pg-btn-clear" @click="clearOutput">Clear</button>
        <button class="pg-btn pg-btn-reset" @click="resetCode">Reset</button>
        <button class="pg-btn pg-btn-run" :disabled="running" @click="runCode">
          <span v-if="running">⏳ Running…</span>
          <span v-else>▶ Run</span>
        </button>
      </div>
    </div>

    <!-- Editor -->
    <div class="pg-editor-wrap">
      <div ref="editorContainer" class="pg-editor"></div>
    </div>

    <!-- Output -->
    <div class="pg-output-wrap">
      <div class="pg-output-header">
        <span>Output</span>
        <span
          v-if="exitCode !== null"
          :class="['pg-exit-badge', exitCode === 0 ? 'ok' : 'err']"
        >
          exit {{ exitCode }}
        </span>
      </div>
      <pre class="pg-output" :class="{ 'has-error': hasError }">{{
        outputText
      }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";

// ── Default starter code ────────────────────────────────────────────────────
const DEFAULT_CODE = `#include <iostream>
#include <string>
#include <vector>

int main() {
    std::cout << "Hello, System Programming!\\n";

    std::vector<std::string> topics = {"RAII", "Move Semantics", "Smart Pointers"};
    for (const auto& t : topics) {
        std::cout << "  → " << t << "\\n";
    }

    return 0;
}
`;

// ── State ────────────────────────────────────────────────────────────────────
const editorContainer = ref<HTMLElement | null>(null);
const running = ref(false);
const exitCode = ref<number | null>(null);
const stdout = ref("");
const stderr = ref("");
const selectedStd = ref("c++17");
const selectedCompiler = ref("gcc-head");

let monacoEditor: any = null;
let monacoInstance: any = null;

// ── Computed output ──────────────────────────────────────────────────────────
const outputText = computed(() => {
  if (!stdout.value && !stderr.value)
    return "// Output will appear here after clicking ▶ Run";
  const parts: string[] = [];
  if (stdout.value) parts.push(stdout.value);
  if (stderr.value) parts.push(stderr.value);
  return parts.join("\n");
});

const hasError = computed(
  () => !!stderr.value || (exitCode.value !== null && exitCode.value !== 0),
);

// ── Load Monaco from CDN ─────────────────────────────────────────────────────
function loadMonaco(): Promise<any> {
  return new Promise((resolve) => {
    if ((window as any).monaco) {
      resolve((window as any).monaco);
      return;
    }
    // Load the Monaco AMD loader
    const loaderScript = document.createElement("script");
    loaderScript.src =
      "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs/loader.js";
    loaderScript.onload = () => {
      const require = (window as any).require;
      require.config({
        paths: {
          vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs",
        },
      });
      require(["vs/editor/editor.main"], () => {
        resolve((window as any).monaco);
      });
    };
    document.head.appendChild(loaderScript);
  });
}

// ── Init editor ──────────────────────────────────────────────────────────────
onMounted(async () => {
  const monaco = await loadMonaco();
  monacoInstance = monaco;

  // Match VitePress dark theme
  monaco.editor.defineTheme("vitepress-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#161b22",
      "editor.lineHighlightBackground": "#1c2128",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#c9d1d9",
    },
  });

  monacoEditor = monaco.editor.create(editorContainer.value!, {
    value: DEFAULT_CODE,
    language: "cpp",
    theme: "vitepress-dark",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontLigatures: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: "on",
    renderWhitespace: "none",
    tabSize: 4,
    automaticLayout: true,
    padding: { top: 12, bottom: 12 },
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  });
});

onBeforeUnmount(() => {
  monacoEditor?.dispose();
});

// ── Run code via Wandbox API ─────────────────────────────────────────────────
async function runCode() {
  if (!monacoEditor) return;
  running.value = true;
  stdout.value = "";
  stderr.value = "";
  exitCode.value = null;

  const code = monacoEditor.getValue();
  const options = `warning,${selectedStd.value}`;

  try {
    const res = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        compiler: selectedCompiler.value,
        options,
        "compiler-option-raw": "",
        save: false,
      }),
    });

    if (!res.ok) throw new Error(`Wandbox returned HTTP ${res.status}`);

    const data = await res.json();
    stdout.value = data.program_output ?? "";
    stderr.value = [data.compiler_error, data.program_error]
      .filter(Boolean)
      .join("\n");
    exitCode.value = parseInt(data.status ?? "0", 10);
  } catch (e: any) {
    stderr.value = `Failed to reach Wandbox API.\n${e.message}\n\nCheck your internet connection or try again in a moment.`;
    exitCode.value = -1;
  } finally {
    running.value = false;
  }
}

function clearOutput() {
  stdout.value = "";
  stderr.value = "";
  exitCode.value = null;
}

function resetCode() {
  monacoEditor?.setValue(DEFAULT_CODE);
  clearOutput();
}
</script>

<style scoped>
.playground {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  margin: 24px 0;
  display: flex;
  flex-direction: column;
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.pg-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  gap: 10px;
  flex-wrap: wrap;
}

.pg-toolbar-left,
.pg-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pg-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin-right: 6px;
}

.pg-select {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
}

.pg-select:focus {
  border-color: var(--vp-c-brand-1);
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.pg-btn {
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    opacity 0.15s,
    background 0.15s;
}

.pg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pg-btn-run {
  background: var(--vp-c-brand-1);
  color: #fff;
  border-color: var(--vp-c-brand-1);
  min-width: 88px;
}

.pg-btn-run:not(:disabled):hover {
  opacity: 0.85;
}

.pg-btn-reset,
.pg-btn-clear {
  background: transparent;
  border-color: var(--vp-c-divider);
  color: var(--vp-c-text-2);
}

.pg-btn-reset:hover,
.pg-btn-clear:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

/* ── Editor ──────────────────────────────────────────────────────────────── */
.pg-editor-wrap {
  width: 100%;
}

.pg-editor {
  width: 100%;
  height: 360px;
}

/* ── Output ──────────────────────────────────────────────────────────────── */
.pg-output-wrap {
  border-top: 1px solid var(--vp-c-divider);
}

.pg-output-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--vp-c-text-3);
}

.pg-exit-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 20px;
}

.pg-exit-badge.ok {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.pg-exit-badge.err {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.pg-output {
  margin: 0;
  padding: 14px 16px;
  background: #0d1117;
  color: #c9d1d9;
  font-family: "JetBrains Mono", monospace;
  font-size: 12.5px;
  line-height: 1.65;
  min-height: 80px;
  max-height: 260px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.pg-output.has-error {
  color: #f87171;
}
</style>
