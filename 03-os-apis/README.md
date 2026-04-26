# Phase 3 — OS APIs & System Calls

> **Status**: ⏳ Upcoming (after Phase 2) | **Estimated Time**: 4 weeks

---

## Topics

| # | File | Topic |
|---|------|-------|
| 1 | [01-processes.md](./01-processes.md) | Processes — fork/exec / CreateProcess |
| 2 | [02-threads.md](./02-threads.md) | Threads — pthreads / Win32 CreateThread |
| 3 | [03-ipc.md](./03-ipc.md) | IPC — Pipes, Shared Memory, COM/RPC |
| 4 | [04-windows-registry.md](./04-windows-registry.md) | Windows Registry APIs |
| 5 | [05-windows-services.md](./05-windows-services.md) | Windows Services (ServiceMain, SCM) |

---

## Projects to Build

- [ ] **Process monitor**: List all running processes + memory usage
- [ ] **Named pipe server/client**: Two programs communicating
- [ ] **Windows service**: Heartbeat logger service
- [ ] **Registry browser**: Enumerate keys under a given path

---

## Resources

- *Windows Internals Part 1* — Chapters 3 (processes), 4 (threads), 8 (I/O)
- MSDN: `CreateProcess`, `CreateThread`, `CreateNamedPipe`, `RegOpenKeyEx`
