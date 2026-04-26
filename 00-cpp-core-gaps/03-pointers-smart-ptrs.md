# Pointers, References & Smart Pointers

> **Phase 0 · Topic 3** | Estimated Time: 3–4 hours

---

## Overview

In competitive programming you mostly used `int*` for arrays or skipped pointers entirely. In system programming, **pointer mastery is non-negotiable** — system APIs return raw pointers, memory-mapped files give you `void*`, and COM objects are all raw pointer-based.

```
Raw Pointers → Dangerous but necessary for OS APIs
References  → Safe aliases; use by default in function params
Smart Ptrs  → Safe ownership; use by default for heap memory
```

---

## 1. Raw Pointers

### Basics Recap

```cpp
int x = 42;
int* ptr = &x;     // ptr holds address of x
*ptr = 99;         // dereference: changes x to 99
ptr = nullptr;     // null pointer — safe "no value" state
```

### Pointer Arithmetic (Critical for Binary Parsing)

```cpp
char buffer[1024];
char* p = buffer;

p += 4;        // Advance 4 bytes
*(int*)p;      // Read 4 bytes as int at current position
p++;           // Move 1 byte forward

// Computing offset
size_t offset = p - buffer;  // How far into the buffer are we?
```

### `void*` — Generic Byte Pointer

Win32 and POSIX use `void*` everywhere (memory maps, heap allocations, IPC buffers):

```cpp
void* raw = VirtualAlloc(nullptr, 4096, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);

// Cast to usable type before using
BYTE* bytes = static_cast<BYTE*>(raw);
bytes[0] = 0xFF;

// Or use reinterpret_cast for binary overlays
MyHeader* header = reinterpret_cast<MyHeader*>(raw);
```

### Common Raw Pointer Mistakes

```cpp
// ❌ Dangling pointer — use after free
int* p = new int(5);
delete p;
*p = 10;  // Undefined behavior! Memory already freed.

// ❌ Double free
delete p;
delete p;  // Crash or heap corruption

// ❌ Wild pointer — uninitialized
int* q;
*q = 5;  // Undefined behavior! q could point anywhere.

// ✅ Always initialize pointers
int* q = nullptr;
```

---

## 2. References

A reference is an **alias** — another name for an existing object. Unlike pointers:
- Cannot be null
- Cannot be reseated (always refers to same object)
- No pointer arithmetic

```cpp
int x = 10;
int& ref = x;   // ref IS x — same memory
ref = 20;       // x is now 20

// Function parameter: pass by reference (avoids copy)
void fillBuffer(std::vector<char>& buf) {
    buf.resize(1024);   // Modifies caller's vector
}

// const reference: read only, avoids copy
void processBuffer(const std::vector<char>& buf) {
    // Can read buf but not modify it
}
```

### When to Use What

| Situation | Use |
|-----------|-----|
| Optional value (may be null) | `T*` (raw pointer) |
| Aliasing / function params | `T&` or `const T&` |
| Transferring ownership | `std::unique_ptr<T>` |
| Shared ownership | `std::shared_ptr<T>` |
| Non-owning observer | `T*` or `std::weak_ptr<T>` |

---

## 3. Smart Pointers

Smart pointers wrap raw pointers and manage lifetime automatically (RAII).

### `std::unique_ptr<T>` — Exclusive Ownership

One owner, destroyed when it goes out of scope. Zero overhead vs raw pointer.

```cpp
#include <memory>

// Create
auto buf = std::make_unique<char[]>(1024);   // 1024-byte buffer
auto obj = std::make_unique<MyStruct>();     // Single object

// Use
buf[0] = 0xFF;
obj->field = 42;

// Get raw pointer (for OS APIs)
ReadFile(hFile, buf.get(), 1024, &bytesRead, nullptr);

// Transfer ownership (move)
auto buf2 = std::move(buf);   // buf is now nullptr, buf2 owns it

// Release ownership (get raw pointer, stop managing it)
char* raw = buf2.release();   // You are now responsible for delete[]
delete[] raw;
```

#### Custom Deleter (for Win32 handles with `unique_ptr`)

```cpp
// Instead of writing a full RAII class, use unique_ptr with custom deleter
auto handleDeleter = [](HANDLE h) { 
    if (h != INVALID_HANDLE_VALUE) CloseHandle(h); 
};
using WinHandle = std::unique_ptr<std::remove_pointer_t<HANDLE>, decltype(handleDeleter)>;

WinHandle h(CreateFile(L"test.bin", GENERIC_READ, 0, nullptr, 
                        OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr), 
             handleDeleter);
// CloseHandle called automatically when h goes out of scope
```

---

### `std::shared_ptr<T>` — Shared Ownership

Multiple owners. Uses reference counting. Destroyed when last owner is gone.

```cpp
auto data = std::make_shared<std::vector<char>>(1024);
// ref count = 1

{
    auto data2 = data;   // ref count = 2
    // data2 goes out of scope
}   // ref count = 1

// When data goes out of scope → ref count = 0 → freed
```

#### When to Use `shared_ptr` vs `unique_ptr`

```
unique_ptr: 99% of the time. Zero overhead. Clear ownership.
shared_ptr: When multiple components genuinely share the same resource
            (caches, event handlers, thread-shared data).
```

⚠️ **Don't default to `shared_ptr`** — it's expensive (atomic ref-counting, heap allocation for control block). Use `unique_ptr` unless shared ownership is explicitly needed.

---

### `std::weak_ptr<T>` — Non-Owning Observer

Used to break **circular reference** cycles in `shared_ptr`:

```cpp
struct Node {
    std::shared_ptr<Node> next;
    std::weak_ptr<Node> parent;   // ← weak to avoid cycle
};

auto root = std::make_shared<Node>();
auto child = std::make_shared<Node>();
root->next = child;
child->parent = root;   // weak_ptr — doesn't keep root alive

// To use a weak_ptr, lock() it first
if (auto p = child->parent.lock()) {
    // p is a shared_ptr, valid as long as we hold it
    p->doSomething();
}
```

---

## 4. Pointer to Pointer (`**`)

Common in Win32 APIs that return a pointer via output parameter:

```cpp
// Win32 pattern: function allocates, you receive via **
BYTE* buffer = nullptr;
DWORD size = 0;
SomeWin32Api(&buffer, &size);   // Function sets buffer and size
// ... use buffer ...
HeapFree(GetProcessHeap(), 0, buffer);
```

Or for arrays of strings:

```cpp
wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
for (int i = 0; i < argc; i++) {
    wprintf(L"%s\n", argv[i]);
}
LocalFree(argv);   // Must free with LocalFree!
```

---

## 5. Pointer Casting

```cpp
int x = 0x41424344;  // 'ABCD' in ASCII

// reinterpret_cast: bit-level reinterpretation (no conversion)
char* bytes = reinterpret_cast<char*>(&x);
// bytes[0] = 0x44 on little-endian ('D')

// static_cast: type-safe numeric conversion
void* raw = malloc(1024);
char* buf = static_cast<char*>(raw);    // void* → char* is safe

// const_cast: remove const (use rarely, a code smell)
const char* str = "hello";
char* mutable_str = const_cast<char*>(str);  // ⚠️ Dangerous

// C-style cast: avoid in C++ (does whichever cast compiles)
char* bad = (char*)raw;  // ❌ Prefer static_cast
```

---

## Memory Diagram: Stack vs Heap

```
Stack (automatic, fast, limited ~1-8 MB)
┌──────────────────┐
│  int x = 10      │  ← x lives here
│  char buf[256]   │  ← buf lives here
│  ptr = 0x5000    │  ← ptr holds heap address
└──────────────────┘
         │
         ↓
Heap (manual/smart_ptr, slow, large)
┌──────────────────────────────┐  address 0x5000
│  [1024 bytes allocated]      │  ← unique_ptr manages this
└──────────────────────────────┘
```

---

## Smart Pointer Decision Tree

```
Do I need to own this resource?
├── No  → use T* (non-owning observer)
└── Yes → is ownership shared between multiple parties?
          ├── No  → std::unique_ptr<T>   (default choice)
          └── Yes → std::shared_ptr<T>
                    └── Do I need to break a cycle?
                        └── Yes → std::weak_ptr<T> for back-references
```

---

## Practical Exercises

1. **Buffer class**: Write a `Buffer` class using `unique_ptr<char[]>`, exposing `data()`, `size()`, move constructor, no copy.

2. **Win32 handle**: Use `unique_ptr` with a custom deleter for `HANDLE`. Open a file, read it, verify the handle closes automatically.

3. **Shared cache**: Create a simple cache with `unordered_map<string, shared_ptr<Buffer>>`. Multiple "consumers" hold a `shared_ptr` to the same entry.

---

## Next

→ [`04-casting.md`](./04-casting.md) — C++ casts & type punning
