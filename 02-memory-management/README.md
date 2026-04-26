# Phase 2 — Memory Management

> **Status**: ⏳ Upcoming (after Phase 1) | **Estimated Time**: 3 weeks

---

## Topics

| # | File | Topic |
|---|------|-------|
| 1 | [01-stack-vs-heap.md](./01-stack-vs-heap.md) | Stack, Heap, Memory Segments |
| 2 | [02-allocators.md](./02-allocators.md) | malloc/free, new/delete, Custom Allocators |
| 3 | [03-virtual-memory.md](./03-virtual-memory.md) | Virtual Memory, Page Tables, VirtualAlloc |
| 4 | [04-debugging-memory.md](./04-debugging-memory.md) | Valgrind, ASAN, Heap Debuggers |

---

## Projects to Build

- [ ] **Memory pool allocator**: Fixed-size block allocator with no fragmentation
- [ ] **Stack overflow detector**: Detect deep recursion using stack pointer tricks
- [ ] **Simple reference counter**: Replicate `shared_ptr` ref-counting manually

---

## Resources

- *The Linux Programming Interface* — Chapters 6–7 (memory layout), 48–49 (virtual memory)
- MSDN: `VirtualAlloc`, `VirtualFree`, `HeapCreate`, `HeapAlloc`
