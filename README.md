# 🖥️ System Programming in C++

> **Goal**: Transition from competitive programming (DSA/STL) → professional system-level C++ development, targeting the Microsoft WSD Windows Update Patch team.

---

## 📁 Documentation Structure

```
system-programming/
├── README.md                      ← You are here (master index)
│
├── 00-cpp-core-gaps/
│   ├── 01-raii.md                 ← RAII & resource management
│   ├── 02-move-semantics.md       ← Move semantics & std::move
│   ├── 03-pointers-smart-ptrs.md  ← Pointers, references, smart pointers
│   ├── 04-casting.md              ← C++ casts & reinterpret_cast
│   ├── 05-undefined-behavior.md   ← UB, volatile, const, constexpr
│   └── 06-struct-layout.md        ← sizeof, alignof, struct padding
│
├── 01-file-io/
│   ├── 01-c-style-file-io.md      ← fopen/fread/fclose
│   ├── 02-cpp-streams.md          ← ifstream/ofstream
│   ├── 03-memory-mapped-files.md  ← mmap / MapViewOfFile
│   ├── 04-filesystem-ops.md       ← Directories, attributes, symlinks
│   └── 05-binary-parsing.md       ← PE headers, CAB files, INF
│
├── 02-memory-management/
│   ├── 01-stack-vs-heap.md        ← Stack, heap, memory segments
│   ├── 02-allocators.md           ← malloc/free, new/delete, custom
│   ├── 03-virtual-memory.md       ← Pages, faults, VirtualAlloc
│   └── 04-debugging-memory.md     ← Valgrind, ASAN, leaks
│
├── 03-os-apis/
│   ├── 01-processes.md            ← fork/exec / CreateProcess
│   ├── 02-threads.md              ← pthreads / Win32 threads
│   ├── 03-ipc.md                  ← Pipes, shared memory, sockets
│   ├── 04-windows-registry.md     ← RegOpenKey, RegQueryValueEx
│   └── 05-windows-services.md     ← ServiceMain, SCM, Event Log
│
├── 04-concurrency/
│   ├── 01-threads-cpp.md          ← std::thread, mutex, cv
│   ├── 02-atomics.md              ← std::atomic, memory ordering
│   ├── 03-win32-sync.md           ← CRITICAL_SECTION, Event, SRWLOCK
│   └── 04-thread-patterns.md      ← Thread pool, IOCP, producer-consumer
│
└── 05-windows-internals/
    ├── 01-windows-update-arch.md  ← WU agent, CBS, DISM
    ├── 02-com-programming.md      ← CoCreate, IUnknown, WUA API
    ├── 03-error-handling.md       ← HRESULT, GetLastError, SEH
    └── 04-debugging-tools.md      ← WinDbg, ProcMon, ETW
```

---

## 🗺️ Learning Phases

| Phase | Topic | Timeline | Status |
|-------|-------|----------|--------|
| **Phase 0** | C++ Core Gaps (RAII, move, pointers) | Week 1–2 | 📖 Start Here |
| **Phase 1** | Low-Level File Handling | Week 3–5 | ⏳ Upcoming |
| **Phase 2** | Memory Management | Week 6–8 | ⏳ Upcoming |
| **Phase 3** | OS APIs & System Calls | Week 9–12 | ⏳ Upcoming |
| **Phase 4** | Concurrency & Synchronization | Week 13–16 | ⏳ Upcoming |
| **Phase 5** | Windows Update Internals | Week 17–22 | ⏳ Upcoming |

---

## ✅ Weekly Checkpoint

Before moving to the next topic, verify:
- [ ] Can you explain the concept without notes?
- [ ] Have you written at least one working program using it?
- [ ] Have you read the MSDN/man page for the core APIs?
- [ ] Have you debugged at least one bug using a proper debugger?

---

## 📚 Core Reading List

| Priority | Book | Phase |
|----------|------|-------|
| 1 | *Effective Modern C++* — Scott Meyers | Phase 0 |
| 2 | *The Linux Programming Interface* — Kerrisk | Phase 1–3 |
| 3 | *Windows Internals Part 1* — Yosifovich | Phase 3–5 |
| 4 | *Windows Internals Part 2* — Yosifovich | Phase 5 |
| 5 | *Programming Windows* — Petzold | Phase 3 |
| 6 | *C++ Concurrency in Action* — Williams | Phase 4 |

---

> **Start**: Head to [`00-cpp-core-gaps/01-raii.md`](./00-cpp-core-gaps/01-raii.md)
