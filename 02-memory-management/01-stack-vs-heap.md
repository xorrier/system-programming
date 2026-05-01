# Stack vs Heap

> **Phase 2 · Topic 1** | Estimated Time: 2–3 hours

---

## Process Memory Layout

When your program runs, the OS gives it a virtual address space. Here's how memory is organized:

```
High Addresses
┌─────────────────────┐
│    Kernel Space      │  ← OS memory (you can't touch this)
├─────────────────────┤
│       Stack          │  ← Grows downward ↓
│         ↓            │     Local variables, function call frames
│                      │
│       (gap)          │
│                      │
│         ↑            │
│       Heap           │  ← Grows upward ↑
│                      │     Dynamic allocations (new, malloc)
├─────────────────────┤
│    BSS Segment       │  ← Uninitialized global/static variables (zeroed)
├─────────────────────┤
│    Data Segment      │  ← Initialized global/static variables
├─────────────────────┤
│    Text Segment      │  ← Your compiled code (read-only)
└─────────────────────┘
Low Addresses
```

Let's understand each region:

| Segment | Contains | Lifetime | Example |
|---------|----------|----------|---------|
| **Text** | Machine code | Entire program | `int main() { ... }` |
| **Data** | Initialized globals | Entire program | `int count = 42;` (global) |
| **BSS** | Uninitialized globals | Entire program | `int buffer[1024];` (global) |
| **Heap** | Dynamic allocations | Until `free`/`delete` | `new int(42)` |
| **Stack** | Local variables, return addresses | Until function returns | `int x = 5;` (local) |

---

## The Stack

### How It Works

The stack is a **Last-In, First-Out (LIFO)** region of memory. Every time you call a function, a **stack frame** is pushed:

```
main() calls foo(), foo() calls bar():

┌───────────────┐  ← Stack Pointer (top)
│  bar() frame  │     - local variables of bar()
│               │     - return address (back to foo)
├───────────────┤
│  foo() frame  │     - local variables of foo()
│               │     - return address (back to main)
├───────────────┤
│  main() frame │     - local variables of main()
│               │     - argc, argv
└───────────────┘  ← Stack Base (bottom)
```

When `bar()` returns, its frame is popped and the stack pointer moves back up.

### What Lives on the Stack?

```cpp
void example() {
    int x = 42;              // ← Stack: 4 bytes
    double pi = 3.14;        // ← Stack: 8 bytes
    char name[64];           // ← Stack: 64 bytes
    std::string s = "hello"; // ← Stack: string object (pointer + size)
                              //   BUT the actual character data is on the HEAP
}
// Everything above is destroyed when example() returns
```

### Stack Properties

| Property | Value |
|----------|-------|
| **Speed** | ⚡ Extremely fast (just move the stack pointer) |
| **Size** | Small — typically **1MB** (Windows) or **8MB** (Linux) |
| **Allocation** | Automatic — compiler manages it |
| **Deallocation** | Automatic — happens when function returns |
| **Thread safety** | Each thread gets its own stack |
| **Fragmentation** | Never — always contiguous |

### Stack Overflow

If you use too much stack space (deep recursion, large local arrays), you get a **stack overflow**:

```cpp
// ❌ BAD — infinite recursion
void boom() {
    char buffer[4096];  // 4KB per frame
    boom();             // Each call adds 4KB to the stack
}
// After ~256 calls (1MB stack / 4KB per frame), CRASH: Stack Overflow!

// ❌ BAD — giant local array
void alsoBad() {
    int data[1000000];  // 4MB on the stack! Likely overflow.
}

// ✅ GOOD — use the heap for large allocations
void good() {
    std::vector<int> data(1000000);  // Allocated on the HEAP
}
```

---

## The Heap

### How It Works

The heap is a large pool of memory for **dynamic allocation**. You request memory, use it, and free it when done.

```cpp
// C style
int* p = (int*)malloc(sizeof(int));   // Request 4 bytes from heap
*p = 42;                               // Use it
free(p);                                // Return it to heap

// C++ style
int* p = new int(42);                  // Allocate + initialize
delete p;                              // Deallocate

// C++ style (array)
int* arr = new int[100];               // Allocate array of 100 ints
delete[] arr;                          // Must use delete[] for arrays!
```

### Heap Properties

| Property | Value |
|----------|-------|
| **Speed** | 🐢 Slower than stack (bookkeeping overhead) |
| **Size** | Large — limited by virtual memory (GBs) |
| **Allocation** | Manual — you call `new`/`malloc` |
| **Deallocation** | Manual — you call `delete`/`free` |
| **Thread safety** | Shared between threads (needs synchronization) |
| **Fragmentation** | Yes — over time, free blocks become scattered |

---

## Stack vs Heap — Side by Side

```cpp
void comparison() {
    // STACK allocation
    int stackVar = 42;           // Fast, automatic cleanup
    int stackArr[10];            // Fixed size, must be known at compile time

    // HEAP allocation
    int* heapVar = new int(42);  // Slower, must manually delete
    int* heapArr = new int[n];   // Can be any size (n known at runtime)
    delete heapVar;
    delete[] heapArr;
}
```

| Feature | Stack | Heap |
|---------|-------|------|
| **Speed** | ⚡ Very fast | 🐢 Slower |
| **Size limit** | ~1–8 MB | GBs (virtual memory) |
| **Lifetime** | Until function returns | Until you `free`/`delete` |
| **Size known at** | Compile time | Runtime |
| **Fragmentation** | No | Yes |
| **Thread sharing** | Private per thread | Shared (needs locks) |
| **Overflow risk** | Stack overflow | Out of memory |

### When to Use Which?

| Use Stack When... | Use Heap When... |
|-------------------|------------------|
| Data is small (< few KB) | Data is large (arrays, buffers) |
| Size known at compile time | Size determined at runtime |
| Data only needed in this function | Data must outlive the function |
| Performance is critical | Lifetime must be controlled explicitly |

---

## Memory Segments in Practice

```cpp
#include <cstdio>
#include <cstdlib>

// DATA segment — initialized global
int globalInit = 100;

// BSS segment — uninitialized global (zeroed by OS)
int globalUninit;

void printAddresses() {
    // STACK — local variable
    int stackVar = 42;

    // HEAP — dynamic allocation
    int* heapVar = (int*)malloc(sizeof(int));

    printf("Code (text):  %p\n", (void*)printAddresses);
    printf("Global (data): %p\n", (void*)&globalInit);
    printf("Global (BSS):  %p\n", (void*)&globalUninit);
    printf("Heap:          %p\n", (void*)heapVar);
    printf("Stack:         %p\n", (void*)&stackVar);

    free(heapVar);
}
```

Running this shows addresses in the expected order:
```
Code (text):  0x00401000  (low)
Global (data): 0x00403000
Global (BSS):  0x00404000
Heap:          0x00B21000
Stack:         0x0061FF00  (high)
```

---

## Common Mistakes

### Use-After-Free

```cpp
// ❌ BAD — using memory after freeing it
int* p = new int(42);
delete p;
*p = 99;  // UNDEFINED BEHAVIOR! p points to freed memory
```

### Double Free

```cpp
// ❌ BAD — freeing the same memory twice
int* p = new int(42);
delete p;
delete p;  // CRASH or heap corruption!
```

### Memory Leak

```cpp
// ❌ BAD — allocated but never freed
void leak() {
    int* p = new int(42);
    return;  // p is lost! Memory leaked.
}
```

### The Fix: Use RAII / Smart Pointers

```cpp
#include <memory>

void safe() {
    auto p = std::make_unique<int>(42);  // Allocated on heap
    // ... use *p ...
}   // Automatically deleted here — no leak possible!
```

---

## Practical Exercises

1. **Address inspector**: Write a program that prints the addresses of a global variable, a local variable, and a heap allocation. Verify they're in different memory regions.
2. **Stack depth counter**: Write a recursive function that counts how deep it can recurse before stack overflow. Print the count.
3. **Heap vs stack benchmark**: Allocate 1 million integers on the stack (via array) vs heap (via `new[]`). Measure time difference.
4. **Memory layout visualizer**: Create a program that maps out the approximate boundaries of text, data, heap, and stack segments.

---

## Key Takeaways

- ✅ Stack = fast, automatic, small, LIFO, per-thread
- ✅ Heap = slower, manual, large, shared between threads
- ✅ Use stack for small, short-lived data
- ✅ Use heap (via `std::vector`, `std::unique_ptr`) for large or long-lived data
- ✅ Every `new` must have a `delete` — or better, use RAII
- ❌ Don't put large arrays on the stack — use `std::vector`
- ❌ Never use memory after freeing it (use-after-free)

---

## Next

→ [`02-allocators.md`](./02-allocators.md) — malloc/free, new/delete, and custom allocators
