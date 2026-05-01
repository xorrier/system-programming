# Undefined Behavior, `volatile`, `const` & `constexpr`

> **Phase 0 · Topic 5** | Estimated Time: 3 hours

---

## 1. Undefined Behavior (UB)

### What Is UB?

The C++ standard says: when a program exhibits **undefined behavior**, the compiler may do *anything* — including crashing, producing wrong output, silently corrupting data, or seemingly working correctly today and breaking tomorrow after a new compiler version.

In competitive programming, UB usually just gives wrong answers. In system programming, **UB can corrupt the OS, cause security vulnerabilities, or silently corrupt patch files**.

---

### The Most Common UBs in System Code

#### 1. Out-of-Bounds Array Access

```cpp
char buf[256];
buf[256] = 'X';  // ❌ UB — writes one past the end
// May overwrite stack variables, return addresses → security exploit
```

#### 2. Null/Dangling Pointer Dereference

```cpp
char* p = nullptr;
*p = 5;          // ❌ UB → segfault on most platforms, but not always!

char* q = new char[10];
delete[] q;
q[0] = 'A';      // ❌ UB — memory already freed
```

#### 3. Signed Integer Overflow

```cpp
int x = INT_MAX;
x++;             // ❌ UB — signed overflow
// Compiler may optimize assuming x + 1 > x is always true!
// Use unsigned or check before adding
```

```cpp
// ✅ Safe
if (x < INT_MAX) x++;

// ✅ Or use unsigned (well-defined wraparound)
uint32_t u = UINT32_MAX;
u++;   // u == 0 — defined behavior
```

#### 4. Uninitialized Variables

```cpp
int x;
int y = x + 1;   // ❌ UB — x has garbage value
// Compiler may assume x was initialized; can optimize in surprising ways
```

#### 5. Data Races

```cpp
// Thread 1            // Thread 2
counter++;             counter++;
// ❌ UB — concurrent access to non-atomic shared variable
// Use std::atomic<int> or protect with mutex
```

#### 6. Strict Aliasing Violation (see 04-casting.md)

```cpp
float f = 1.0f;
int* p = reinterpret_cast<int*>(&f);
int bits = *p;   // ❌ UB — unless using char* or memcpy
```

---

### Why UB is Especially Dangerous in System Code

The compiler's optimizer uses UB as a license for transformation:

```cpp
// You wrote this:
if (p != nullptr) {
    // The compiler sees: "if p is used here, p != null was guaranteed"
    // So it may eliminate the null check above as 'always true'
    *p = 5;  // If p is somehow null, you got UB → compiler removes the if
}
```

This is not theoretical. Real security vulnerabilities in kernel code have been caused by UB-based optimization removing security checks.

---

### Tools to Detect UB

| Tool | How to Use |
|------|-----------|
| **AddressSanitizer (ASAN)** | `-fsanitize=address` (GCC/Clang) |
| **UndefinedBehaviorSanitizer (UBSAN)** | `-fsanitize=undefined` (GCC/Clang) |
| **Valgrind** | `valgrind --tool=memcheck ./program` |
| **Visual Studio ASAN** | Enable in project settings: "Address Sanitizer" |
| **`/RTC1`** | MSVC: Runtime Checks — catches some UBs in debug builds |

```bash
# On Linux/Mac — catch UB at runtime
g++ -fsanitize=address,undefined -g -o prog prog.cpp
./prog

# On Windows (MSVC) — compile flags
/fsanitize=address
```

---

## 2. `const` — Immutability

`const` tells both you and the compiler that a value won't change. It enables optimizations and prevents bugs.

### `const` Variables

```cpp
const int MAX_RETRIES = 3;          // Can't change after init
const char* CONFIG_PATH = "/etc";   // Pointer itself can change, data can't

// ✅ Use const for all values that shouldn't change
void connect(const std::string& host, int port);
```

### `const` Pointers — Two Positions

```cpp
const int* p1 = &x;   // Pointer to const int: can't change *p1, can change p1
int* const p2 = &x;   // Const pointer to int: can change *p2, can't change p2
const int* const p3 = &x;  // Both const: can't change either

// Mnemonic: read right-to-left
// p3 is a const pointer to a const int
```

### `const` Methods

```cpp
class FileReader {
public:
    size_t size() const { return size_; }  // const method: doesn't modify object
    void read();                            // non-const: modifies object
private:
    size_t size_ = 0;
};

void printSize(const FileReader& reader) {
    reader.size();   // ✅ OK: const method on const object
    // reader.read(); ❌ Error: can't call non-const method on const ref
}
```

---

## 3. `constexpr` — Compile-Time Computation

`constexpr` means "evaluate this at compile time if possible". The result is embedded into the binary — no runtime cost.

### `constexpr` Variables

```cpp
constexpr size_t PAGE_SIZE = 4096;            // Compile-time constant
constexpr uint32_t PE_SIGNATURE = 0x00004550; // 'PE\0\0'
constexpr uint16_t MZ_MAGIC = 0x5A4D;        // 'MZ'

// Unlike #define: typed, scoped, debuggable
// Unlike const: guaranteed to be compile-time
```

### `constexpr` Functions

```cpp
constexpr size_t kilobytes(size_t n) { return n * 1024; }
constexpr size_t megabytes(size_t n) { return kilobytes(n) * 1024; }

// Used at compile time:
constexpr size_t BUFFER_SIZE = megabytes(16);   // 16 MB — computed at compile time
char buffer[BUFFER_SIZE];                        // Stack array with compile-time size
```

### Common Patterns in System Code

```cpp
// ✅ Use constexpr for buffer sizes, magic numbers, masks
constexpr uint32_t FLAG_READ    = 0x0001;
constexpr uint32_t FLAG_WRITE   = 0x0002;
constexpr uint32_t FLAG_EXECUTE = 0x0004;

constexpr bool hasReadFlag(uint32_t f) { return (f & FLAG_READ) != 0; }

// ✅ Endian utility as constexpr
constexpr uint32_t makeTag(char a, char b, char c, char d) {
    return (uint32_t)a | ((uint32_t)b << 8) | ((uint32_t)c << 16) | ((uint32_t)d << 24);
}
constexpr uint32_t TAG_RIFF = makeTag('R', 'I', 'F', 'F');
```

---

## 4. `volatile` — Hardware Registers & Signal Handlers

`volatile` tells the compiler: **"don't optimize away accesses to this variable — something outside the program may read or change it."**

### Use Cases

```cpp
// 1. Memory-mapped hardware registers (driver development)
volatile uint32_t* const STATUS_REG = reinterpret_cast<volatile uint32_t*>(0xFFFE0000);

while (!(*STATUS_REG & 0x01)) {
    // Spin until the device sets the ready bit
    // Without volatile: compiler may hoist the read out of the loop
    //                   and cache it forever!
}

// 2. Signal handler communication (must use sig_atomic_t, not bool)
volatile std::sig_atomic_t g_shutdown = 0;

void signalHandler(int sig) {
    g_shutdown = 1;  // Called from signal handler context
}

while (!g_shutdown) {
    doWork();
    // Without volatile: compiler might hoist g_shutdown read out of the loop
}
```

### What `volatile` Does NOT Do

❌ `volatile` does NOT make accesses thread-safe (no memory ordering guarantees).  
❌ `volatile` does NOT prevent data races between CPU cores.

For multithreaded code, use `std::atomic<T>`:

```cpp
// ❌ Wrong (data race)
volatile bool done = false;    // Thread 1 sets it, Thread 2 reads it — RACE!

// ✅ Correct
std::atomic<bool> done = false;  // Thread-safe: atomic read/write
```

### `volatile` in System Programming

In Windows kernel/driver code, hardware registers must be `volatile`. However in userspace Windows Update code, `volatile` is rare. You'll mostly use `std::atomic` for shared state between threads.

---

## Summary Table

| Keyword | Effect | Common Use |
|---------|--------|-----------|
| `const` | Can't modify the value after init | Function params, method guarantees |
| `constexpr` | Definitely compile-time constant | Sizes, magic numbers, inline math |
| `volatile` | Every access hits memory, no caching | Hardware registers, signal flags |
| `mutable` | Allow modification of member in const method | Caches, lazy init inside `const` functions |

---

## The `mutable` Keyword (Bonus)

Allows a member to be modified even in a `const` method. Used for caches:

```cpp
class FileStats {
public:
    size_t cachedSize() const {
        if (!cacheValid_) {
            // Compute size — this "modifies" the object,
            // but it's just a cache so logically it's still const:
            size_ = computeSize();
            cacheValid_ = true;
        }
        return size_;
    }
private:
    mutable size_t size_ = 0;
    mutable bool cacheValid_ = false;
};
```

---

## Practical Exercises

1. **UB Safari**: Write programs that trigger each of the following, then run with ASAN/UBSAN:
   - Array out-of-bounds
   - Use-after-free
   - Signed integer overflow
   - Uninitialized variable

2. **constexpr toolkit**: Write a compile-time library with:
   - `kilobytes(n)`, `megabytes(n)`, `gigabytes(n)`
   - `makeTag(a, b, c, d)` for 4-char file type identifiers
   - `alignUp(size, alignment)` — round up to next multiple

3. **volatile spin**: Write a program with a signal handler that sets a `volatile bool`, and a main loop that exits when it's set. Test with Ctrl+C.

---

## Next

→ [`06-struct-layout.md`](./06-struct-layout.md) — `sizeof`, `alignof`, struct padding & binary protocols
