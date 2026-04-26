# Phase 4 — Concurrency & Synchronization

> **Status**: ⏳ Upcoming (after Phase 3) | **Estimated Time**: 4 weeks

---

## Topics

| # | File | Topic |
|---|------|-------|
| 1 | [01-threads-cpp.md](./01-threads-cpp.md) | `std::thread`, `mutex`, `condition_variable` |
| 2 | [02-atomics.md](./02-atomics.md) | `std::atomic`, Memory Ordering |
| 3 | [03-win32-sync.md](./03-win32-sync.md) | CRITICAL_SECTION, Event, SRWLOCK |
| 4 | [04-thread-patterns.md](./04-thread-patterns.md) | Thread Pool, IOCP, Producer-Consumer |

---

## Projects to Build

- [ ] **Parallel file downloader**: Download N files with a thread pool
- [ ] **Thread-safe logger**: Multi-producer, single-consumer writer
- [ ] **IOCP echo server**: High-performance async I/O server

---

## Resources

- *C++ Concurrency in Action* — Anthony Williams (the definitive book)
- MSDN: `CreateThreadpoolWork`, `InitializeCriticalSection`, `IOCP`
