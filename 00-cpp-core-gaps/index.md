# Phase 0 — C++ Core Gaps

> **Status**: 📖 Active | **Estimated Time**: 2 weeks (1–2 hrs/day)

---

## Topics

| # | File | Topic | Time |
|---|------|-------|------|
| 1 | [01-raii.md](./01-raii.md) | RAII & Resource Management | 2–3 hrs |
| 2 | [02-move-semantics.md](./02-move-semantics.md) | Move Semantics & `std::move` | 3–4 hrs |
| 3 | [03-pointers-smart-ptrs.md](./03-pointers-smart-ptrs.md) | Pointers, References, Smart Pointers | 3–4 hrs |
| 4 | [04-casting.md](./04-casting.md) | C++ Casts & Type Punning | 2 hrs |
| 5 | [05-undefined-behavior.md](./05-undefined-behavior.md) | UB, `volatile`, `const`, `constexpr` | 3 hrs |
| 6 | [06-struct-layout.md](./06-struct-layout.md) | `sizeof`, `alignof`, Struct Padding | 2–3 hrs |

---

## Why These Topics First?

These are the **gaps between competitive C++ and system C++**. DSA/STL knowledge is great, but system code requires:

- **RAII** — because you own OS resources (handles, memory, locks) with no GC
- **Move semantics** — because you pass around multi-GB patch file buffers
- **Smart pointers** — because manual memory management in long-running services causes leaks
- **Casting** — because Win32 APIs return `void*` and you parse binary file formats
- **UB awareness** — because corrupting the OS or a patch file is catastrophic
- **Struct layout** — because CAB/PE/MSU files have exact byte-level binary formats

---

## Completion Checklist

- [ ] RAII — written a working file/handle RAII wrapper
- [ ] Move semantics — zero-copy buffer passing implemented
- [ ] Smart pointers — `unique_ptr` with Win32 custom deleter working
- [ ] Casting — PE header bytes parsed with `reinterpret_cast`
- [ ] UB / tools — ASAN/UBSAN set up and at least one UB caught
- [ ] Struct layout — `sizeof` and `offsetof` verified against PE spec

---

## Next Phase

→ [`../01-file-io/`](../01-file-io/) — Low-Level File Handling
