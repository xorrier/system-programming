# Virtual Memory

> **Phase 2 · Topic 3** | Estimated Time: 3 hours

---

## What Is Virtual Memory?

Every process thinks it has the **entire address space to itself**. This is an illusion created by the OS using **virtual memory**.

```
Process A sees:              Process B sees:
┌──────────────┐             ┌──────────────┐
│ 0x0000...    │             │ 0x0000...    │
│ My code      │             │ My code      │
│ My data      │             │ My data      │
│ My heap      │             │ My heap      │
│ My stack     │             │ My stack     │
└──────────────┘             └──────────────┘
     ↓ (page table)                ↓ (page table)
     ↓                             ↓
┌───────────────────────────────────────────┐
│              Physical RAM                 │
│  [A's page] [B's page] [A's page] [...]   │
└───────────────────────────────────────────┘
```

**Why virtual memory?**
- **Isolation**: Process A can't read Process B's memory
- **Simplicity**: Every process starts at address 0 (conceptually)
- **Overcommit**: Total virtual memory can exceed physical RAM (disk-backed)
- **Protection**: Read-only, no-execute, guard pages

---

## Pages and Page Tables

Memory is managed in fixed-size chunks called **pages**:

| Property | Value |
|----------|-------|
| Page size (x86/x64) | **4 KB** (4096 bytes) |
| Large pages (x64) | **2 MB** |
| Huge pages (x64) | **1 GB** |

The **page table** maps virtual addresses → physical addresses:

```
Virtual Address: 0x00401234
                 ├──────┤├──┤
                 Page #   Offset within page
                 0x00401  0x234

Page Table:
  Virtual Page 0x00401 → Physical Frame 0x7A3
  
Physical Address: 0x7A3234
```

### TLB (Translation Lookaside Buffer)

The CPU caches recent page table entries in the **TLB** for speed. A TLB miss means the CPU must walk the page table (slow).

---

## Page Faults

When you access a virtual page that isn't in physical RAM, the CPU triggers a **page fault**:

| Type | What Happens | Example |
|------|-------------|---------|
| **Soft fault** | Page is in RAM but not mapped yet; OS maps it | First access to a newly allocated page |
| **Hard fault** | Page must be loaded from disk (swap/pagefile) | Accessing swapped-out memory |
| **Invalid fault** | Bad address — OS kills the process | Dereferencing `nullptr`, accessing freed memory |

> Memory-mapped files work through page faults — when you access a byte, the OS loads that page from the file on demand.

---

## Reserved vs Committed Memory

On Windows, virtual memory has two states:

| State | Meaning | Physical RAM Used? |
|-------|---------|-------------------|
| **Reserved** | Address range claimed, but no backing memory | ❌ No |
| **Committed** | Backing memory (RAM or pagefile) assigned | ✅ Yes |

Think of it like reserving a table at a restaurant (reserved) vs actually sitting down and ordering (committed).

---

## Win32: `VirtualAlloc` / `VirtualFree`

The most fundamental memory API on Windows. This is what `malloc` and `HeapAlloc` are built on.

```cpp
#include <windows.h>
#include <cstdio>

void virtualAllocBasic() {
    // Allocate 64 KB of committed, readable/writable memory
    void* ptr = VirtualAlloc(
        nullptr,              // Let OS choose the address
        64 * 1024,            // 64 KB
        MEM_COMMIT | MEM_RESERVE, // Reserve AND commit
        PAGE_READWRITE        // Read + write access
    );

    if (!ptr) {
        printf("VirtualAlloc failed: %lu\n", GetLastError());
        return;
    }

    // Use it like any pointer
    char* buf = static_cast<char*>(ptr);
    strcpy_s(buf, 64 * 1024, "Hello from VirtualAlloc!");
    printf("%s\n", buf);

    // Free the memory
    VirtualFree(ptr, 0, MEM_RELEASE);
}
```

### Two-Phase Allocation (Reserve, then Commit)

For large, growable data structures (like a stack or arena):

```cpp
void twoPhaseAlloc() {
    const size_t RESERVE_SIZE = 1024 * 1024;  // 1 MB reserved
    const size_t PAGE_SIZE = 4096;

    // Phase 1: RESERVE 1 MB (no physical memory used yet)
    void* base = VirtualAlloc(nullptr, RESERVE_SIZE, MEM_RESERVE, PAGE_READWRITE);
    if (!base) return;

    printf("Reserved 1 MB at %p (no RAM used yet)\n", base);

    // Phase 2: COMMIT pages as needed
    void* page1 = VirtualAlloc(base, PAGE_SIZE, MEM_COMMIT, PAGE_READWRITE);
    printf("Committed first 4 KB — now using RAM\n");

    char* next = static_cast<char*>(base) + PAGE_SIZE;
    void* page2 = VirtualAlloc(next, PAGE_SIZE, MEM_COMMIT, PAGE_READWRITE);
    printf("Committed second 4 KB\n");

    // Use committed memory
    strcpy_s(static_cast<char*>(page1), PAGE_SIZE, "Page 1 data");

    // Release everything
    VirtualFree(base, 0, MEM_RELEASE);
}
```

### Memory Protection Flags

| Flag | Meaning |
|------|---------|
| `PAGE_READONLY` | Read-only access |
| `PAGE_READWRITE` | Read + write |
| `PAGE_EXECUTE` | Execute only |
| `PAGE_EXECUTE_READ` | Execute + read |
| `PAGE_EXECUTE_READWRITE` | Execute + read + write |
| `PAGE_NOACCESS` | No access (guard page) |
| `PAGE_GUARD` | Trigger exception on first access |

### Changing Protection at Runtime

```cpp
void changeProtection() {
    // Allocate read-write memory
    void* ptr = VirtualAlloc(nullptr, 4096, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);

    // Write some data
    strcpy_s(static_cast<char*>(ptr), 4096, "Secret data");

    // Make it read-only
    DWORD oldProtect;
    VirtualProtect(ptr, 4096, PAGE_READONLY, &oldProtect);

    // Now writing will cause an access violation!
    // strcpy(static_cast<char*>(ptr), "crash");  // CRASH!

    // Restore write access
    VirtualProtect(ptr, 4096, PAGE_READWRITE, &oldProtect);

    VirtualFree(ptr, 0, MEM_RELEASE);
}
```

---

## POSIX: `mmap` for Anonymous Memory

On Linux/macOS, `mmap` with `MAP_ANONYMOUS` allocates virtual memory (not backed by a file):

```cpp
#include <sys/mman.h>
#include <cstdio>

void posixVirtualAlloc() {
    size_t size = 64 * 1024;  // 64 KB

    void* ptr = mmap(
        nullptr,                         // Let OS choose address
        size,
        PROT_READ | PROT_WRITE,         // Read + write
        MAP_PRIVATE | MAP_ANONYMOUS,    // Private, not file-backed
        -1,                              // No file descriptor
        0                                // No offset
    );

    if (ptr == MAP_FAILED) {
        perror("mmap");
        return;
    }

    // Use it
    char* buf = static_cast<char*>(ptr);
    sprintf(buf, "Hello from mmap!");
    printf("%s\n", buf);

    // Free
    munmap(ptr, size);
}
```

### Changing Protection (POSIX)

```cpp
#include <sys/mman.h>

// Make memory read-only
mprotect(ptr, size, PROT_READ);

// Make it executable (JIT compilers do this)
mprotect(ptr, size, PROT_READ | PROT_EXEC);
```

---

## Working Set and Memory Queries

### Querying Memory Info (Win32)

```cpp
#include <windows.h>
#include <psapi.h>
#include <cstdio>

void printMemoryUsage() {
    PROCESS_MEMORY_COUNTERS pmc;
    if (GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc))) {
        printf("Working Set:       %zu KB\n", pmc.WorkingSetSize / 1024);
        printf("Peak Working Set:  %zu KB\n", pmc.PeakWorkingSetSize / 1024);
        printf("Pagefile Usage:    %zu KB\n", pmc.PagefileUsage / 1024);
    }
}

// Query info about a specific virtual address
void queryAddress(void* addr) {
    MEMORY_BASIC_INFORMATION mbi;
    VirtualQuery(addr, &mbi, sizeof(mbi));

    printf("Base Address:    %p\n", mbi.BaseAddress);
    printf("Region Size:     %zu\n", mbi.RegionSize);
    printf("State:           %s\n",
           mbi.State == MEM_COMMIT ? "Committed" :
           mbi.State == MEM_RESERVE ? "Reserved" : "Free");
    printf("Protection:      0x%lx\n", mbi.Protect);
}
```

---

## Practical Exercises

1. **VirtualAlloc explorer**: Reserve 1 MB, commit pages one at a time, query each page's state with `VirtualQuery`.
2. **Guard page demo**: Create a page with `PAGE_GUARD`, access it, catch the exception using SEH, then see that the guard is removed.
3. **Memory usage monitor**: Print your process's working set before and after a large allocation.
4. **Page protection demo**: Write data, make it read-only, try to write again (catch the access violation).

---

## Key Takeaways

- ✅ Virtual memory gives each process its own isolated address space
- ✅ Memory is managed in **pages** (4 KB on x86/x64)
- ✅ **Reserved** = address space claimed; **Committed** = RAM/pagefile assigned
- ✅ `VirtualAlloc` is the foundation — `malloc` and `HeapAlloc` build on it
- ✅ `VirtualProtect` / `mprotect` change page permissions at runtime
- ✅ Page faults are normal — they're how demand-paging works
- ❌ Don't confuse virtual memory size with actual RAM usage

---

## Next

→ [`04-debugging-memory.md`](./04-debugging-memory.md) — Debugging memory bugs with Valgrind, ASAN, and Windows tools
