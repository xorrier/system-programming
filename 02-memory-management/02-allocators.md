# Allocators — malloc, new, and Custom Allocators

> **Phase 2 · Topic 2** | Estimated Time: 3 hours

---

## Why Understand Allocators?

Every `new`, `malloc`, `std::vector`, and `std::string` uses an allocator to request memory from the OS. Understanding allocators helps you:

- Debug memory corruption and leaks
- Write high-performance code (avoid allocation bottlenecks)
- Understand how Windows heap APIs work (important for WSD team)
- Build custom allocators for specific workloads

---

## Level 1: C-Style — `malloc` / `free`

The simplest allocator. Requests raw bytes from the heap.

```cpp
#include <cstdlib>
#include <cstdio>
#include <cstring>

void cStyleAllocation() {
    // Allocate 100 bytes of raw memory
    void* raw = malloc(100);
    if (!raw) {
        perror("malloc failed");
        return;
    }

    // malloc returns void* — you must cast
    char* buffer = static_cast<char*>(raw);
    strcpy(buffer, "Hello, System Programming!");
    printf("%s\n", buffer);

    // Free when done — MUST match every malloc
    free(buffer);
}
```

### The `malloc` Family

| Function | Purpose |
|----------|---------|
| `malloc(size)` | Allocate `size` bytes (uninitialized) |
| `calloc(count, size)` | Allocate `count × size` bytes (**zeroed**) |
| `realloc(ptr, newSize)` | Resize an existing allocation |
| `free(ptr)` | Release memory |

```cpp
// calloc — allocates AND zeros memory
int* arr = (int*)calloc(100, sizeof(int));  // 100 ints, all 0

// realloc — resize (may move the block!)
arr = (int*)realloc(arr, 200 * sizeof(int));  // Now 100→200 ints
// WARNING: old pointer is INVALID after realloc if block moved!

free(arr);
```

### Rules

- ❌ `malloc` returns `nullptr` on failure — always check
- ❌ `free(nullptr)` is safe (does nothing), but `free` on an invalid pointer = crash
- ❌ Don't mix: `malloc` with `delete`, or `new` with `free`
- ❌ `malloc` does NOT call constructors — it's raw bytes

---

## Level 2: C++ — `new` / `delete`

`new` does two things: **allocate memory** + **call the constructor**.

```cpp
// Single object
int* p = new int(42);         // Allocate + initialize to 42
delete p;                      // Call destructor + free memory

// Array
int* arr = new int[100];       // Allocate 100 ints (default-initialized)
delete[] arr;                  // MUST use delete[] for arrays!

// Class objects — constructor/destructor called automatically
class Widget {
public:
    Widget()  { printf("Constructed!\n"); }
    ~Widget() { printf("Destroyed!\n"); }
};

Widget* w = new Widget();     // Prints "Constructed!"
delete w;                     // Prints "Destroyed!"
```

### `new` vs `malloc` — What's the Difference?

| Feature | `malloc` | `new` |
|---------|----------|-------|
| Returns | `void*` | Typed pointer |
| On failure | Returns `nullptr` | Throws `std::bad_alloc` |
| Constructors | ❌ Not called | ✅ Called |
| Destructors | ❌ Not called by `free` | ✅ Called by `delete` |
| Size | Manual: `sizeof(T)` | Automatic |

### `new` Failure Handling

```cpp
// Default: throws std::bad_alloc
try {
    int* p = new int[1000000000000ULL];  // Too much memory
} catch (const std::bad_alloc& e) {
    std::cerr << "Allocation failed: " << e.what() << "\n";
}

// No-throw version: returns nullptr
int* p = new(std::nothrow) int[1000000000000ULL];
if (!p) {
    std::cerr << "Allocation failed\n";
}
```

---

## Level 3: Placement New

**Placement new** constructs an object at a specific memory address — you control where it lives.

```cpp
#include <new>       // Required for placement new
#include <cstdlib>
#include <cstdio>

class Sensor {
public:
    Sensor(int id) : id_(id) { printf("Sensor %d created\n", id_); }
    ~Sensor() { printf("Sensor %d destroyed\n", id_); }
    int id_;
};

void placementNewExample() {
    // 1. Allocate raw memory (no constructor called)
    void* memory = malloc(sizeof(Sensor));

    // 2. Construct the object at that address
    Sensor* s = new(memory) Sensor(42);  // Placement new!
    // Prints: "Sensor 42 created"

    // 3. Must call destructor MANUALLY
    s->~Sensor();                         // Explicit destructor call
    // Prints: "Sensor 42 destroyed"

    // 4. Free the raw memory
    free(memory);
}
```

**When is placement new useful?**
- Memory pools — pre-allocate a big chunk, construct objects within it
- Memory-mapped regions — construct objects in shared memory
- Embedded systems — objects at specific hardware addresses

---

## Level 4: Win32 Heap APIs

Windows provides its own heap management, separate from the C runtime:

| Function | Purpose |
|----------|---------|
| `GetProcessHeap()` | Get handle to process's default heap |
| `HeapCreate(flags, init, max)` | Create a private heap |
| `HeapAlloc(hHeap, flags, size)` | Allocate from a heap |
| `HeapReAlloc(hHeap, flags, ptr, size)` | Resize allocation |
| `HeapFree(hHeap, flags, ptr)` | Free from a heap |
| `HeapDestroy(hHeap)` | Destroy entire heap (frees everything!) |

```cpp
#include <windows.h>
#include <cstdio>

void win32HeapExample() {
    // Use the default process heap
    HANDLE hHeap = GetProcessHeap();

    // Allocate 1024 bytes
    void* ptr = HeapAlloc(hHeap, HEAP_ZERO_MEMORY, 1024);
    if (!ptr) {
        printf("HeapAlloc failed\n");
        return;
    }

    // Use the memory...
    char* buf = static_cast<char*>(ptr);
    strcpy_s(buf, 1024, "Hello from Win32 heap!");
    printf("%s\n", buf);

    // Free it
    HeapFree(hHeap, 0, ptr);
}
```

### Private Heaps — Why?

Creating a **private heap** isolates allocations. Advantages:
- **Fast cleanup**: `HeapDestroy()` frees everything at once — no need to track individual allocations
- **Reduced fragmentation**: different allocation patterns don't interfere
- **Debugging**: easier to find leaks in a specific heap

```cpp
void privateHeapExample() {
    // Create a private heap (initial 4KB, grows as needed, 0 = no max)
    HANDLE hHeap = HeapCreate(0, 4096, 0);
    if (!hHeap) return;

    // Allocate from private heap
    int* data1 = (int*)HeapAlloc(hHeap, 0, sizeof(int) * 100);
    int* data2 = (int*)HeapAlloc(hHeap, 0, sizeof(int) * 200);

    // Use data...

    // Destroy heap — frees ALL allocations at once!
    HeapDestroy(hHeap);
    // No need to HeapFree data1 and data2 individually
}
```

---

## Level 5: Custom Allocators

### Arena Allocator (Bump Allocator)

The simplest custom allocator: allocate by bumping a pointer forward. Free everything at once.

```cpp
#include <cstdint>
#include <cstdlib>
#include <stdexcept>

class Arena {
public:
    explicit Arena(size_t capacity)
        : buffer_(static_cast<uint8_t*>(malloc(capacity)))
        , capacity_(capacity)
        , offset_(0)
    {
        if (!buffer_) throw std::bad_alloc();
    }

    ~Arena() { free(buffer_); }

    // Allocate n bytes — just bump the pointer
    void* alloc(size_t n) {
        // Align to 8 bytes
        n = (n + 7) & ~7;

        if (offset_ + n > capacity_) {
            throw std::bad_alloc();
        }
        void* ptr = buffer_ + offset_;
        offset_ += n;
        return ptr;
    }

    // Reset — "free" everything at once (no destructors called!)
    void reset() { offset_ = 0; }

    size_t used() const { return offset_; }

    // No copying
    Arena(const Arena&) = delete;
    Arena& operator=(const Arena&) = delete;

private:
    uint8_t* buffer_;
    size_t capacity_;
    size_t offset_;
};
```

Usage:

```cpp
void arenaExample() {
    Arena arena(1024 * 1024);  // 1 MB arena

    // Fast allocation — just pointer bumps
    int* a = static_cast<int*>(arena.alloc(sizeof(int)));
    int* b = static_cast<int*>(arena.alloc(sizeof(int) * 100));
    char* s = static_cast<char*>(arena.alloc(256));

    *a = 42;
    b[0] = 1;
    strcpy(s, "Arena-allocated string");

    printf("Used: %zu bytes\n", arena.used());

    // Free everything at once — extremely fast
    arena.reset();
}
```

### Pool Allocator (Fixed-Size Block)

For objects of the same size — like a pool of network connections:

```cpp
#include <vector>
#include <cstdint>

class PoolAllocator {
public:
    PoolAllocator(size_t blockSize, size_t blockCount)
        : blockSize_(blockSize)
        , memory_(blockSize * blockCount)
    {
        // Build free list
        for (size_t i = 0; i < blockCount; ++i) {
            freeList_.push_back(memory_.data() + i * blockSize);
        }
    }

    void* alloc() {
        if (freeList_.empty()) return nullptr;
        void* ptr = freeList_.back();
        freeList_.pop_back();
        return ptr;
    }

    void free(void* ptr) {
        freeList_.push_back(static_cast<uint8_t*>(ptr));
    }

private:
    size_t blockSize_;
    std::vector<uint8_t> memory_;
    std::vector<uint8_t*> freeList_;
};
```

---

## `std::allocator` and STL Allocators

Every STL container uses an allocator (defaulting to `std::allocator<T>`):

```cpp
// These are equivalent:
std::vector<int> v1;
std::vector<int, std::allocator<int>> v2;

// You can provide a custom allocator to any STL container:
// std::vector<int, MyAllocator<int>> v3;
```

---

## Practical Exercises

1. **Allocation benchmark**: Compare speed of `malloc`, `new`, `HeapAlloc`, and arena allocator for 1 million allocations.
2. **Arena allocator**: Build the arena above, use it to allocate 1000 structs, then `reset()` and verify memory reuse.
3. **Pool allocator**: Build a pool for fixed-size 64-byte blocks, allocate/free in random order, verify correctness.
4. **Memory tracker**: Override `new`/`delete` globally to track total allocations and detect leaks.

---

## Key Takeaways

- ✅ `malloc`/`free` = raw bytes, no constructors, C-style
- ✅ `new`/`delete` = typed, calls constructors/destructors, C++ style
- ✅ Placement new = construct at a specific address
- ✅ Win32 `HeapCreate`/`HeapDestroy` = private heaps with bulk cleanup
- ✅ Arena allocators are the fastest — just bump a pointer
- ❌ Never mix `malloc`/`free` with `new`/`delete`
- ❌ Always use `delete[]` for arrays allocated with `new[]`

---

## Next

→ [`03-virtual-memory.md`](./03-virtual-memory.md) — Virtual memory, pages, and `VirtualAlloc`
