# Memory-Mapped Files

> **Phase 1 · Topic 3** | Estimated Time: 3 hours

---

## What Is Memory Mapping?

Normally, to read a file you call `read()` which copies bytes from disk into a buffer. **Memory mapping** skips this copy. Instead, the OS maps the file directly into your process's virtual address space. You access file bytes through a **pointer** — like reading an array.

```
Traditional I/O:         Memory-Mapped I/O:
┌──────────┐             ┌──────────┐
│   File   │             │   File   │
│ on Disk  │             │ on Disk  │
└────┬─────┘             └────┬─────┘
     │ read()                 │ (page fault → auto-load)
     ▼                        ▼
┌──────────┐             ┌──────────────────────┐
│  Buffer  │             │ Virtual Address Space │
│ (copy!)  │             │ (direct pointer)      │
└──────────┘             └──────────────────────┘
```

---

## Why Is It Faster?

| Aspect | `read()`/`fread()` | Memory Mapping |
|--------|--------------------|----------------|
| Data copies | 2 copies (kernel→user) | 0 extra copies |
| System calls | One per `read()` | Only initial setup |
| Random access | Must `seek()` + `read()` | Pointer arithmetic: `data[offset]` |
| Large files | Must manage chunking | OS pages in/out automatically |

> Memory mapping is powerful for **read-only random access** — like parsing PE headers or searching large log files.

---

## POSIX: `mmap()` and Friends

| Function | Purpose |
|----------|---------|
| `mmap(addr, length, prot, flags, fd, offset)` | Map file into memory |
| `munmap(addr, length)` | Unmap the region |
| `msync(addr, length, flags)` | Flush changes to disk |

### Read a File with `mmap`

```cpp
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstdio>
#include <cstdint>

void readWithMmap(const char* path) {
    // 1. Open the file
    int fd = open(path, O_RDONLY);
    if (fd < 0) { perror("open"); return; }

    // 2. Get file size
    struct stat sb;
    fstat(fd, &sb);
    size_t fileSize = sb.st_size;

    // 3. Map the file into memory
    void* mapped = mmap(
        nullptr,        // Let OS choose the address
        fileSize,       // Map entire file
        PROT_READ,      // Read-only
        MAP_PRIVATE,    // Private mapping
        fd,             // File descriptor
        0               // Offset from start
    );

    if (mapped == MAP_FAILED) {
        perror("mmap"); close(fd); return;
    }

    // 4. Use it — just pointer access!
    const uint8_t* data = static_cast<const uint8_t*>(mapped);
    printf("First 4 bytes: %02x %02x %02x %02x\n",
           data[0], data[1], data[2], data[3]);

    // 5. Cleanup
    munmap(mapped, fileSize);
    close(fd);
}
```

### Protection and Mapping Flags

| Prot Flag | Meaning |
|-----------|---------|
| `PROT_READ` | Can read the mapped region |
| `PROT_WRITE` | Can write to the mapped region |
| `PROT_EXEC` | Can execute code from the region |

| Map Flag | Meaning |
|----------|---------|
| `MAP_PRIVATE` | Copy-on-write: changes NOT written to file |
| `MAP_SHARED` | Changes ARE written back to the file |
| `MAP_ANONYMOUS` | Memory not backed by any file |

---

## Win32: `CreateFileMapping` + `MapViewOfFile`

Windows uses a two-step process: create a mapping object, then map a view.

| Function | Purpose |
|----------|---------|
| `CreateFileMapping(hFile, ...)` | Create a mapping object |
| `MapViewOfFile(hMap, ...)` | Map a view into your process |
| `UnmapViewOfFile(addr)` | Unmap the view |
| `FlushViewOfFile(addr, size)` | Flush changes to disk |

### Read a File with MapViewOfFile

```cpp
#include <windows.h>
#include <cstdio>
#include <cstdint>
#include <stdexcept>

void readWithMapView(const wchar_t* path) {
    // 1. Open the file
    HANDLE hFile = CreateFileW(
        path, GENERIC_READ, FILE_SHARE_READ,
        nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr
    );
    if (hFile == INVALID_HANDLE_VALUE)
        throw std::runtime_error("CreateFileW failed");

    // 2. Get file size
    LARGE_INTEGER fileSize;
    GetFileSizeEx(hFile, &fileSize);

    // 3. Create a file mapping object
    HANDLE hMap = CreateFileMappingW(
        hFile, nullptr, PAGE_READONLY, 0, 0, nullptr
    );
    if (!hMap) {
        CloseHandle(hFile);
        throw std::runtime_error("CreateFileMappingW failed");
    }

    // 4. Map a view into our address space
    void* view = MapViewOfFile(hMap, FILE_MAP_READ, 0, 0, 0);
    if (!view) {
        CloseHandle(hMap); CloseHandle(hFile);
        throw std::runtime_error("MapViewOfFile failed");
    }

    // 5. Use it — direct pointer access!
    const uint8_t* data = static_cast<const uint8_t*>(view);
    printf("First 4 bytes: %02x %02x %02x %02x\n",
           data[0], data[1], data[2], data[3]);

    // 6. Cleanup (reverse order)
    UnmapViewOfFile(view);
    CloseHandle(hMap);
    CloseHandle(hFile);
}
```

---

## RAII Wrapper for Memory-Mapped Files

```cpp
#include <windows.h>
#include <stdexcept>
#include <cstdint>

class MemoryMappedFile {
public:
    explicit MemoryMappedFile(const wchar_t* path) {
        hFile_ = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ,
                             nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (hFile_ == INVALID_HANDLE_VALUE)
            throw std::runtime_error("Cannot open file");

        LARGE_INTEGER li;
        GetFileSizeEx(hFile_, &li);
        size_ = static_cast<size_t>(li.QuadPart);

        hMap_ = CreateFileMappingW(hFile_, nullptr, PAGE_READONLY, 0, 0, nullptr);
        if (!hMap_) { cleanup(); throw std::runtime_error("Cannot create mapping"); }

        view_ = MapViewOfFile(hMap_, FILE_MAP_READ, 0, 0, 0);
        if (!view_) { cleanup(); throw std::runtime_error("Cannot map view"); }
    }

    ~MemoryMappedFile() { cleanup(); }

    // No copying
    MemoryMappedFile(const MemoryMappedFile&) = delete;
    MemoryMappedFile& operator=(const MemoryMappedFile&) = delete;

    const uint8_t* data() const { return static_cast<const uint8_t*>(view_); }
    size_t size() const { return size_; }

    template<typename T>
    const T* readAt(size_t offset) const {
        if (offset + sizeof(T) > size_) throw std::out_of_range("Read past end");
        return reinterpret_cast<const T*>(data() + offset);
    }

private:
    void cleanup() {
        if (view_) UnmapViewOfFile(view_);
        if (hMap_) CloseHandle(hMap_);
        if (hFile_ != INVALID_HANDLE_VALUE) CloseHandle(hFile_);
    }
    HANDLE hFile_ = INVALID_HANDLE_VALUE;
    HANDLE hMap_  = nullptr;
    void*  view_  = nullptr;
    size_t size_  = 0;
};
```

Usage:

```cpp
void inspectPE(const wchar_t* path) {
    MemoryMappedFile mmf(path);

    if (mmf.size() >= 2 && mmf.data()[0] == 'M' && mmf.data()[1] == 'Z') {
        auto peOffset = *mmf.readAt<uint32_t>(0x3C);
        auto peSig    = *mmf.readAt<uint32_t>(peOffset);
        printf("PE signature: 0x%08X\n", peSig);
    }
    // Everything cleaned up automatically
}
```

---

## Read-Write and Copy-on-Write

```cpp
// POSIX — Read-write, changes saved to file
void* mapped = mmap(nullptr, size, PROT_READ | PROT_WRITE,
                     MAP_SHARED, fd, 0);
msync(mapped, size, MS_SYNC);  // Flush to disk

// POSIX — Copy-on-write (changes NOT saved to file)
void* mapped = mmap(nullptr, size, PROT_READ | PROT_WRITE,
                     MAP_PRIVATE, fd, 0);

// Win32 — Read-write
HANDLE hMap = CreateFileMappingW(hFile, nullptr, PAGE_READWRITE, 0, 0, nullptr);
void* view  = MapViewOfFile(hMap, FILE_MAP_ALL_ACCESS, 0, 0, 0);

// Win32 — Copy-on-write
HANDLE hMap = CreateFileMappingW(hFile, nullptr, PAGE_WRITECOPY, 0, 0, nullptr);
void* view  = MapViewOfFile(hMap, FILE_MAP_COPY, 0, 0, 0);
```

---

## When NOT to Use Memory Mapping

| Situation | Why Not |
|-----------|---------|
| **Small files (< 64KB)** | `fread()` is simpler and fast enough |
| **Sequential-only access** | Buffered I/O is equally fast |
| **Writing new files** | Must pre-set file size; can't grow dynamically |
| **Network drives** | I/O errors become crashes (SIGBUS / access violations) |
| **32-bit + huge files** | Limited virtual address space (4GB max) |

---

## Practical Exercises

1. **Hex dump**: Memory-map a file, print 16 bytes per row in hex + ASCII.
2. **String searcher**: Memory-map a large text file, search for a substring via pointer.
3. **PE magic checker**: Memory-map an `.exe`, verify MZ and PE signatures.
4. **File comparator**: Memory-map two files, compare byte-by-byte, print first difference.

---

## Key Takeaways

- ✅ Memory mapping gives **direct pointer access** to file contents
- ✅ The OS handles paging — no manual `read()` calls
- ✅ Best for **large files** with **random access** patterns
- ✅ Always wrap in RAII to avoid handle/mapping leaks
- ✅ Use `MAP_PRIVATE` / `FILE_MAP_COPY` for safe experimentation
- ❌ Don't use for network files — I/O errors become crashes
- ❌ On Win32, close both the mapping handle AND the file handle

---

## Next

→ [`04-filesystem-ops.md`](./04-filesystem-ops.md) — Filesystem operations with `std::filesystem` and Win32
