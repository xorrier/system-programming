# Memory-Mapped Files

> **Phase 1 · Topic 3** | Estimated Time: 3 hours

> 🚧 **Coming Soon** — This document will cover:

---

## Topics Planned

- What is memory mapping and why it's faster than `read()`
- POSIX: `mmap()`, `munmap()`, `msync()`
- Win32: `CreateFileMapping()` + `MapViewOfFile()` + `UnmapViewOfFile()`
- RAII wrappers for mapped regions
- Read-only vs read-write mappings
- Large file handling (32-bit vs 64-bit offsets)
- Copy-on-write mappings
- When NOT to use memory-mapped files

## Key Code Snippet Preview

```cpp
// Win32: Map a file into memory
HANDLE hFile = CreateFileW(L"update.cab", GENERIC_READ, FILE_SHARE_READ,
                            nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
HANDLE hMap  = CreateFileMappingW(hFile, nullptr, PAGE_READONLY, 0, 0, nullptr);
void*  view  = MapViewOfFile(hMap, FILE_MAP_READ, 0, 0, 0);

// Access bytes directly via pointer arithmetic:
const uint8_t* bytes = static_cast<const uint8_t*>(view);

UnmapViewOfFile(view);
CloseHandle(hMap);
CloseHandle(hFile);
```

---

## Next

→ [`04-filesystem-ops.md`](./04-filesystem-ops.md)
