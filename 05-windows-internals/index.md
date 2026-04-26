# Phase 5 — Windows Update Internals

> **Status**: ⏳ Upcoming (after Phase 4) | **Estimated Time**: 6 weeks

---

## Topics

| # | File | Topic |
|---|------|-------|
| 1 | [01-windows-update-arch.md](./01-windows-update-arch.md) | WU Architecture (CBS, DISM, UsoSvc) |
| 2 | [02-com-programming.md](./02-com-programming.md) | COM Programming & WUA API |
| 3 | [03-error-handling.md](./03-error-handling.md) | HRESULT, GetLastError, SEH |
| 4 | [04-debugging-tools.md](./04-debugging-tools.md) | WinDbg, ProcMon, ETW Tracing |

---

## Windows Update Architecture

```
Windows Update Client (wuauclt.exe / UsoClient.exe)
    ↓
Windows Update Agent (wuauserv service)
    ↓
Update Orchestrator Service (UsoSvc)
    ↓
Windows Update (WU) Server / Microsoft Update
```

---

## Projects to Build

- [ ] **Update query tool**: Use WUA COM API to list available updates
- [ ] **CBS log parser**: Parse `C:\Windows\Logs\CBS\CBS.log` for error codes
- [ ] **Package integrity checker**: Verify hash of `.msu` before applying
- [ ] **Mini patch applier**: Apply a delta to a file (binary diff patching)

---

## Resources

- *Windows Internals Part 1 & 2* — Yosifovich (the WSD Bible)
- MSDN: IUpdateSession, IUpdateSearcher, IUpdateDownloader, IUpdateInstaller
- CBS.log format (internal Microsoft documentation)
