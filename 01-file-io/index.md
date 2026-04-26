# Phase 1 — Low-Level File Handling

> **Status**: ⏳ Upcoming (after Phase 0) | **Estimated Time**: 3 weeks

---

## Why File I/O First?

Windows Update packages are large binary files: `.cab`, `.msu`, `.bin`. The update engine reads, verifies, and writes gigabytes of patch data. File I/O is the first OS-level skill you need.

---

## Topics

| # | File | Topic | Time |
|---|------|-------|------|
| 1 | [01-c-style-file-io.md](./01-c-style-file-io.md) | C-Style File I/O (`fopen`/`fread`) | 2 hrs |
| 2 | [02-cpp-streams.md](./02-cpp-streams.md) | C++ Streams (`ifstream`/`ofstream`) | 2 hrs |
| 3 | [03-memory-mapped-files.md](./03-memory-mapped-files.md) | Memory-Mapped Files (mmap / MapViewOfFile) | 3 hrs |
| 4 | [04-filesystem-ops.md](./04-filesystem-ops.md) | Filesystem Operations & Attributes | 2 hrs |
| 5 | [05-binary-parsing.md](./05-binary-parsing.md) | Binary File Parsing (PE, CAB, INF) | 4 hrs |

---

## Projects to Build

- [ ] **Hex editor**: Read a binary file and display hex + ASCII output (like `xxd`)
- [ ] **File hasher**: Compute SHA-256 of large files using chunked reading
- [ ] **CAB file reader**: Parse the CAB header and list its contents

---

## Resources

- *The Linux Programming Interface* — Chapters 4–5 (file I/O), Ch 49 (mmap)
- MSDN: `CreateFile`, `ReadFile`, `WriteFile`, `MapViewOfFile`, `GetFileSize`
