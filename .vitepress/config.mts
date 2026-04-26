import { defineConfig } from "vitepress";

export default defineConfig({
  title: "System Programming in C++",
  description:
    "Comprehensive C++ system programming documentation: RAII, file I/O, memory management, OS APIs, concurrency, and Windows internals.",

  // GitHub Pages deployment — set base to your repo name
  // e.g. if your repo is github.com/yourname/system-programming, set base: '/system-programming/'
  base: "/system-programming/",

  // Stub pages don't have .md files yet — ignore dead links during build
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [{ text: "Home", link: "/" }],

    sidebar: [
      {
        text: "C++ Basics & OOP",
        collapsed: false,
        items: [
          { text: "Overview", link: "/cpp-basics/" },
          { text: "Classes & Objects", link: "/cpp-basics/01-classes-objects" },
          {
            text: "Constructors & Rule of Five",
            link: "/cpp-basics/02-constructors-destructors",
          },
          {
            text: "Inheritance & Polymorphism",
            link: "/cpp-basics/03-inheritance-polymorphism",
          },
          {
            text: "std:: & Standard Library",
            link: "/cpp-basics/04-std-library",
          },
        ],
      },
      {
        text: "Phase 0 — C++ Core Gaps",
        collapsed: false,
        items: [
          { text: "Overview", link: "/00-cpp-core-gaps/" },
          { text: "RAII", link: "/00-cpp-core-gaps/01-raii" },
          {
            text: "Move Semantics",
            link: "/00-cpp-core-gaps/02-move-semantics",
          },
          {
            text: "Pointers & Smart Ptrs",
            link: "/00-cpp-core-gaps/03-pointers-smart-ptrs",
          },
          { text: "Casting", link: "/00-cpp-core-gaps/04-casting" },
          {
            text: "Undefined Behavior",
            link: "/00-cpp-core-gaps/05-undefined-behavior",
          },
          { text: "Struct Layout", link: "/00-cpp-core-gaps/06-struct-layout" },
        ],
      },
      {
        text: "Phase 1 — File I/O",
        collapsed: false,
        items: [
          { text: "Overview", link: "/01-file-io/" },
          { text: "C-Style File I/O", link: "/01-file-io/01-c-style-file-io" },
          { text: "C++ Streams", link: "/01-file-io/02-cpp-streams" },
          {
            text: "Memory-Mapped Files",
            link: "/01-file-io/03-memory-mapped-files",
          },
          { text: "Filesystem Ops", link: "/01-file-io/04-filesystem-ops" },
          { text: "Binary Parsing", link: "/01-file-io/05-binary-parsing" },
        ],
      },
      {
        text: "Phase 2 — Memory Management",
        collapsed: false,
        items: [
          { text: "Overview", link: "/02-memory-management/" },
          {
            text: "Stack vs Heap",
            link: "/02-memory-management/01-stack-vs-heap",
          },
          { text: "Allocators", link: "/02-memory-management/02-allocators" },
          {
            text: "Virtual Memory",
            link: "/02-memory-management/03-virtual-memory",
          },
          {
            text: "Debugging Memory",
            link: "/02-memory-management/04-debugging-memory",
          },
        ],
      },
      {
        text: "Phase 3 — OS APIs",
        collapsed: false,
        items: [
          { text: "Overview", link: "/03-os-apis/" },
          { text: "Processes", link: "/03-os-apis/01-processes" },
          { text: "Threads", link: "/03-os-apis/02-threads" },
          { text: "IPC", link: "/03-os-apis/03-ipc" },
          { text: "Windows Registry", link: "/03-os-apis/04-windows-registry" },
          { text: "Windows Services", link: "/03-os-apis/05-windows-services" },
        ],
      },
      {
        text: "Phase 4 — Concurrency",
        collapsed: false,
        items: [
          { text: "Overview", link: "/04-concurrency/" },
          { text: "Threads in C++", link: "/04-concurrency/01-threads-cpp" },
          { text: "Atomics", link: "/04-concurrency/02-atomics" },
          {
            text: "Win32 Sync Primitives",
            link: "/04-concurrency/03-win32-sync",
          },
          {
            text: "Thread Patterns",
            link: "/04-concurrency/04-thread-patterns",
          },
        ],
      },
      {
        text: "Phase 5 — Windows Internals",
        collapsed: false,
        items: [
          { text: "Overview", link: "/05-windows-internals/" },
          {
            text: "WU Architecture",
            link: "/05-windows-internals/01-windows-update-arch",
          },
          {
            text: "COM Programming",
            link: "/05-windows-internals/02-com-programming",
          },
          {
            text: "Error Handling",
            link: "/05-windows-internals/03-error-handling",
          },
          {
            text: "Debugging Tools",
            link: "/05-windows-internals/04-debugging-tools",
          },
        ],
      },
    ],

    // Sidebar search (built-in)
    search: {
      provider: "local",
    },

    // Edit links — update to your actual GitHub repo
    editLink: {
      pattern: "https://github.com/xorrier/system-programming/edit/main/:path",
      text: "Edit this page on GitHub",
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/xorrier/system-programming",
      },
    ],

    footer: {
      message: "System Programming in C++",
    },
  },

  // Shiki syntax highlighting — same engine as GitHub & VS Code
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
    lineNumbers: true,
  },
});
