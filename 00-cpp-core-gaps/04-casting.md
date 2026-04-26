# C++ Casts & Type Punning

> **Phase 0 · Topic 4** | Estimated Time: 2 hours

---

## Why Casting Matters in System Programming

System code constantly deals with:
- `void*` buffers from OS memory allocations
- Binary file data that needs to be interpreted as structs
- Win32 APIs that return opaque `HANDLE` or `LPVOID`
- Byte-level manipulation of integers (endian conversion, checksums)

Knowing **which cast to use and why** is essential for writing correct low-level code.

---

## The Four C++ Casts

### 1. `static_cast<T>` — Safe, Compile-Time Cast

Used for well-defined, type-safe conversions. The compiler checks compatibility.

```cpp
// Numeric conversions
double d = 3.14;
int i = static_cast<int>(d);      // 3 (truncates)

// void* → concrete type (safe pattern for OS APIs)
void* raw = malloc(1024);
char* buf = static_cast<char*>(raw);

// Pointer up/down class hierarchy
class Base {};
class Derived : public Base {};
Base* b = new Derived();
Derived* d2 = static_cast<Derived*>(b);  // OK (you know it's a Derived)
```

**When to use**: Numeric conversions, `void*` to typed pointer, class hierarchy traversal when you're certain of the type.

---

### 2. `reinterpret_cast<T>` — Bit-Level Reinterpretation

Tells the compiler: "treat these bytes as a completely different type". **No conversion happens** — the bits stay the same, only the interpretation changes.

```cpp
// Reading a struct from a binary buffer
struct PEHeader {
    uint16_t magic;       // 0x5A4D for 'MZ'
    uint16_t lastPageSize;
    uint16_t pageCount;
    // ...
};

char buffer[512];
// Read file into buffer...

// Interpret raw bytes as a struct (common in binary parsing)
PEHeader* header = reinterpret_cast<PEHeader*>(buffer);
if (header->magic == 0x5A4D) {
    printf("Valid PE file!\n");
}

// Integer → pointer (for hardware/driver code)
uintptr_t addr = 0xFFFF0000;
volatile uint32_t* reg = reinterpret_cast<volatile uint32_t*>(addr);
*reg = 0x1;   // Write to hardware register
```

**When to use**: 
- Binary struct overlay on byte buffers
- Hardware register access
- Converting between pointer types with no semantic relationship

⚠️ **Warning**: `reinterpret_cast` bypasses the type system. Wrong use causes UB.

---

### 3. `const_cast<T>` — Remove or Add `const`

Removes `const` from a pointer or reference. Rarely needed in good code.

```cpp
const char* str = "hello";

// Call a legacy C API that incorrectly doesn't take const
void legacyCAPI(char* s);  // Old API, should be const char* but isn't
legacyCAPI(const_cast<char*>(str));  // OK only if the API won't modify it

// ❌ Actually modifying a const object = UB
const int x = 5;
int* p = const_cast<int*>(&x);
*p = 10;  // UNDEFINED BEHAVIOR
```

**When to use**: Only when calling legacy C APIs that aren't `const`-correct, and you know the data won't be modified. Treat it as a code smell.

---

### 4. `dynamic_cast<T>` — Runtime Type Check

Safe downcast in inheritance hierarchies. Requires virtual functions (RTTI).

```cpp
class Shape { virtual ~Shape() {} };
class Circle : public Shape { int radius; };
class Square : public Shape { int side; };

Shape* s = getShape();  // Could be Circle or Square

Circle* c = dynamic_cast<Circle*>(s);
if (c != nullptr) {
    // It IS a Circle
    printf("Radius: %d\n", c->radius);
} else {
    // Not a Circle
}
```

**When to use**: Polymorphic code where you need to check runtime type. **Avoid in system code** — it's slow (RTTI) and rarely needed. Prefer virtual dispatch or `static_cast` with certainty.

---

## C-Style Cast — Avoid It

The old C-style cast `(Type)value` does whichever C++ cast compiles, in order:
1. `const_cast`
2. `static_cast`
3. `static_cast` then `const_cast`
4. `reinterpret_cast`
5. `reinterpret_cast` then `const_cast`

```cpp
int x = 10;
double* dp = (double*)&x;  // ❌ Which cast is this? Unclear → could be reinterpret_cast + UB

// ✅ Be explicit
double* dp = reinterpret_cast<double*>(&x);  // At least it's obvious
```

**Rule**: Never use C-style casts in C++ code. They hide intent and can silently do dangerous things.

---

## Type Punning — The Right Way

**Type punning** = reading the same bytes as different types (e.g., reading a `float`'s raw bit pattern as `uint32_t`).

### ❌ Wrong: `reinterpret_cast` on non-char types causes UB

```cpp
float f = 3.14f;
uint32_t* p = reinterpret_cast<uint32_t*>(&f);
uint32_t bits = *p;  // ❌ UNDEFINED BEHAVIOR — violates strict aliasing
```

### ✅ Right: `memcpy` (safe, compiler optimizes to zero cost)

```cpp
#include <cstring>
float f = 3.14f;
uint32_t bits;
std::memcpy(&bits, &f, sizeof(bits));  // ✅ Well-defined
printf("0x%08X\n", bits);  // Bit pattern of 3.14f
```

### ✅ Right: `std::bit_cast` (C++20, cleanest)

```cpp
#include <bit>
float f = 3.14f;
uint32_t bits = std::bit_cast<uint32_t>(f);  // ✅ C++20
```

### ✅ Right: `union` (C allowed, C++ technically UB but works in practice)

```cpp
union FloatBits {
    float f;
    uint32_t bits;
};
FloatBits fb;
fb.f = 3.14f;
uint32_t bits = fb.bits;  // Works on all major compilers but technically UB in C++
```

---

## Strict Aliasing Rule

The compiler assumes that pointers of different types **don't alias** (don't point to the same memory). This allows aggressive optimization.

```cpp
void update(float* f, int* i) {
    *i = 1;
    *f = 2.0f;
    // Compiler assumes f and i don't overlap — may reorder these!
    printf("%d\n", *i);  // Might print 1 even if you hacked f to alias i
}
```

**Exception**: `char*`, `unsigned char*`, and `std::byte*` can alias anything. This is why binary buffer code always uses `char*` or `uint8_t*`.

---

## System Programming Patterns

### Pattern 1: Struct Overlay (PE/CAB header parsing)

```cpp
#pragma pack(push, 1)  // Disable padding for exact binary layout
struct DOSHeader {
    uint16_t e_magic;    // 'MZ' = 0x5A4D
    uint16_t e_cblp;
    uint16_t e_cp;
    // ...
    uint32_t e_lfanew;   // Offset to PE signature
};
#pragma pack(pop)

// Read file into buffer
std::vector<uint8_t> data = readFile("program.exe");

// Overlay struct (buffer points to start of file)
const DOSHeader* dos = reinterpret_cast<const DOSHeader*>(data.data());
if (dos->e_magic != 0x5A4D) {
    throw std::runtime_error("Not a valid PE file");
}
uint32_t peOffset = dos->e_lfanew;
```

### Pattern 2: Casting OS API Return `void*`

```cpp
// mmap returns void*
void* mapped = mmap(nullptr, size, PROT_READ, MAP_PRIVATE, fd, 0);
if (mapped == MAP_FAILED) return;

// Cast to byte pointer for safe traversal
const uint8_t* bytes = static_cast<const uint8_t*>(mapped);

// Cast to struct for header fields
const DOSHeader* header = reinterpret_cast<const DOSHeader*>(mapped);
```

### Pattern 3: Big-Endian ↔ Little-Endian

Network data and some file formats use big-endian. x86/x64 is little-endian.

```cpp
#include <cstdint>

// Reverse byte order (swap endianness)
uint32_t byteSwap32(uint32_t x) {
    return ((x & 0xFF000000) >> 24) |
           ((x & 0x00FF0000) >> 8)  |
           ((x & 0x0000FF00) << 8)  |
           ((x & 0x000000FF) << 24);
}

// Or use compiler built-ins
#ifdef _MSC_VER
#include <stdlib.h>
uint32_t big = _byteswap_ulong(littleEndian);
#else
uint32_t big = __builtin_bswap32(littleEndian);
#endif
```

---

## Cast Decision Chart

```
Need to cast?
│
├── Converting between numeric types (int→float, double→int)?
│   └── static_cast<T>
│
├── Casting void* to a typed pointer?
│   └── static_cast<T*>
│
├── Overlaying a struct on raw bytes / treating memory as another type?
│   └── reinterpret_cast<T*> on the source pointer
│       (use memcpy or bit_cast if accessing the VALUE, not pointer)
│
├── Removing const to call a legacy API?
│   └── const_cast<T*> (use sparingly)
│
├── Checking runtime type in a polymorphic hierarchy?
│   └── dynamic_cast<T*> (avoid in system code)
│
└── C-style (Type)value ?
    └── ❌ Never use — replace with one of the above
```

---

## Practical Exercises

1. **Endian checker**: Write a program that detects host endianness using `reinterpret_cast` or `memcpy`.

2. **PE header reader**: Open `notepad.exe`, read 64 bytes, overlay a `DOSHeader` struct, print the `e_magic` and `e_lfanew` fields.

3. **Float bit inspector**: Use `std::bit_cast` (or `memcpy`) to print the sign, exponent, and mantissa bits of a `float`.

---

## Next

→ [`05-undefined-behavior.md`](./05-undefined-behavior.md) — UB, `volatile`, `const`, `constexpr`
