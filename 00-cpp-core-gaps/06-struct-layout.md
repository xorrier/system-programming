# `sizeof`, `alignof` & Struct Layout

> **Phase 0 · Topic 6** | Estimated Time: 2–3 hours

---

## Why This Matters

When you open a `.cab`, `.exe`, or `.msu` file and read raw bytes, you're dealing with **binary file formats**. To parse them correctly, your C++ structs must match the **exact byte layout** defined in the specification.

Without understanding struct padding and alignment, your binary parsing code will be silently wrong — reading fields from the wrong byte offsets.

---

## 1. `sizeof` Operator

Returns the size in **bytes** of a type or expression at compile time.

```cpp
sizeof(int)           // = 4 (on all 32/64-bit platforms)
sizeof(long)          // = 4 on Windows, 8 on Linux 64-bit ⚠️
sizeof(long long)     // = 8 everywhere
sizeof(void*)         // = 4 (32-bit) or 8 (64-bit)
sizeof(char)          // = 1 always (by definition)

// On an object:
int x = 0;
sizeof(x)             // = 4 (same as sizeof(int))
sizeof(x + 1.0)       // = 8 (sizeof double — expression type)

// On arrays:
int arr[10];
sizeof(arr)           // = 40 (10 * 4)
sizeof(arr) / sizeof(arr[0])  // = 10 (element count)

// On structs:
struct Point { int x; int y; };
sizeof(Point)         // = 8 (2 ints)
```

### Portable Integer Types

**Never use `int`, `long` for binary formats** — their sizes vary by platform. Use `<cstdint>`:

```cpp
#include <cstdint>

int8_t    // exactly 1 byte,  signed
uint8_t   // exactly 1 byte,  unsigned
int16_t   // exactly 2 bytes, signed
uint16_t  // exactly 2 bytes, unsigned
int32_t   // exactly 4 bytes, signed
uint32_t  // exactly 4 bytes, unsigned
int64_t   // exactly 8 bytes, signed
uint64_t  // exactly 8 bytes, unsigned
```

---

## 2. Alignment & `alignof`

CPUs read memory most efficiently when data is **aligned** — placed at addresses that are multiples of the data's size.

```
int (4 bytes) at address 0x00: ✅ aligned (0 % 4 == 0)
int (4 bytes) at address 0x01: ❌ misaligned (1 % 4 != 0) → can crash on some CPUs
int (4 bytes) at address 0x04: ✅ aligned
```

`alignof(T)` returns the required alignment of type `T`:

```cpp
alignof(char)     // = 1
alignof(int16_t)  // = 2
alignof(int32_t)  // = 4
alignof(int64_t)  // = 8
alignof(double)   // = 8
```

---

## 3. Struct Padding

The compiler adds **invisible padding bytes** between struct members to keep each member aligned. This makes the struct size larger than the sum of its fields.

```cpp
struct Padded {
    char   a;   // 1 byte
    // 3 bytes padding here (to align 'b' at offset 4)
    int    b;   // 4 bytes — must be at offset 4 (multiple of 4)
    char   c;   // 1 byte at offset 8
    // 3 bytes padding at end (to make struct size multiple of 4)
};
// sizeof(Padded) = 12, NOT 6!
```

```
Offset:  0   1   2   3   4   5   6   7   8   9  10  11
Field:  [a] [pad][pad][pad][  b  b  b  b ][c] [pad][pad][pad]
```

### Visualizing Padding

```cpp
struct A { char x; int y; char z; };
// sizeof(A) = 12

//  0: x (char, 1 byte)
//  1-3: padding
//  4: y (int, 4 bytes)
//  8: z (char, 1 byte)
//  9-11: tail padding (struct size must be multiple of 4)

// Reorder fields to reduce size:
struct B { int y; char x; char z; };
// sizeof(B) = 8

//  0: y (int, 4 bytes)
//  4: x (char, 1 byte)
//  5: z (char, 1 byte)
//  6-7: tail padding (multiple of 4)
```

**Rule**: Sort fields from **largest to smallest** to minimize padding.

---

## 4. `#pragma pack` — Packing for Binary Formats

File format structs must have **no padding** — every byte is defined by the spec. Use `#pragma pack` to disable padding:

```cpp
// DOS MZ executable header (exact binary layout from spec)
#pragma pack(push, 1)   // Save current packing, set to 1 byte

struct DOSHeader {
    uint16_t e_magic;     // 0x00: 'MZ' = 0x5A4D
    uint16_t e_cblp;      // 0x02: Bytes on last page of file
    uint16_t e_cp;        // 0x04: Pages in file
    uint16_t e_crlc;      // 0x06: Relocations
    uint16_t e_cparhdr;   // 0x08: Size of header in paragraphs
    uint16_t e_minalloc;  // 0x0A
    uint16_t e_maxalloc;  // 0x0C
    uint16_t e_ss;        // 0x0E
    uint16_t e_sp;        // 0x10
    uint16_t e_csum;      // 0x12
    uint16_t e_ip;        // 0x14
    uint16_t e_cs;        // 0x16
    uint16_t e_lfarlc;    // 0x18
    uint16_t e_ovno;      // 0x1A
    uint16_t e_res[4];    // 0x1C
    uint16_t e_oemid;     // 0x24
    uint16_t e_oeminfo;   // 0x26
    uint16_t e_res2[10];  // 0x28
    uint32_t e_lfanew;    // 0x3C: Offset to PE header (critical!)
};
// sizeof(DOSHeader) == 64 exactly (0x40)

#pragma pack(pop)   // Restore previous packing
```

### MSVC vs GCC/Clang

```cpp
// MSVC:
#pragma pack(push, 1)
struct MyStruct { ... };
#pragma pack(pop)

// GCC/Clang:
struct __attribute__((packed)) MyStruct { ... };
// Or
struct MyStruct { ... } __attribute__((packed));

// Cross-platform macro:
#ifdef _MSC_VER
#  define PACKED_BEGIN __pragma(pack(push, 1))
#  define PACKED_END   __pragma(pack(pop))
#  define PACKED
#else
#  define PACKED_BEGIN
#  define PACKED_END
#  define PACKED __attribute__((packed))
#endif

PACKED_BEGIN
struct Header { uint32_t magic; uint16_t version; } PACKED;
PACKED_END
```

---

## 5. Checking Your Layout

Always verify struct layout matches spec using `static_assert`:

```cpp
#pragma pack(push, 1)
struct DOSHeader {
    uint16_t e_magic;
    // ... 30 more fields ...
    uint32_t e_lfanew;
};
#pragma pack(pop)

// Verify at compile time
static_assert(sizeof(DOSHeader) == 64, "DOSHeader must be exactly 64 bytes");
static_assert(offsetof(DOSHeader, e_lfanew) == 0x3C, "e_lfanew must be at offset 60");
```

`offsetof(struct, field)` returns the byte offset of a field within a struct.

---

## 6. Memory Alignment for Performance

Even when not parsing binary files, alignment matters for performance:

```cpp
// ✅ Cache-friendly struct: fields accessed together, placed together
struct Particle {
    float x, y, z;     // 12 bytes (position — accessed together)
    float vx, vy, vz;  // 12 bytes (velocity — accessed together)
};

// ❌ Cache-unfriendly: intermixed hot/cold data
struct BadParticle {
    float x;
    char name[64];  // Cold data mixed with hot position
    float y, z;
};
```

### `alignas` — Specify Alignment

```cpp
// Force 64-byte alignment (one CPU cache line)
alignas(64) char buffer[1024];

// Useful for avoiding false sharing between threads:
struct alignas(64) PerThreadCounter {
    std::atomic<uint64_t> count{0};
    // Padding to 64 bytes prevents false sharing
};
```

---

## 7. Practical: PE File Header Walk

```cpp
#include <cstdio>
#include <cstdint>
#include <cstring>

#pragma pack(push, 1)
struct DOSHeader {
    uint16_t e_magic;
    uint8_t  _reserved[58];
    uint32_t e_lfanew;
};
#pragma pack(pop)

static_assert(sizeof(DOSHeader) == 64, "DOSHeader size mismatch");

int main() {
    FILE* f = fopen("C:\\Windows\\notepad.exe", "rb");
    if (!f) { perror("open"); return 1; }

    DOSHeader dos;
    fread(&dos, sizeof(dos), 1, f);

    printf("Magic: 0x%04X (should be 0x5A4D)\n", dos.e_magic);
    printf("PE header offset: 0x%08X\n", dos.e_lfanew);

    // Seek to PE header
    fseek(f, dos.e_lfanew, SEEK_SET);

    uint32_t peSig;
    fread(&peSig, 4, 1, f);
    printf("PE signature: 0x%08X (should be 0x00004550)\n", peSig);

    fclose(f);
    return 0;
}
```

---

## Summary

| Concept | Key Point |
|---------|-----------|
| `sizeof(T)` | Size in bytes; use `uint8_t` etc. for portable sizes |
| `alignof(T)` | Required alignment of T |
| Struct padding | Compiler adds invisible bytes for alignment |
| `#pragma pack(1)` | Disable padding for binary format structs |
| `offsetof(S, m)` | Byte offset of member `m` in struct `S` |
| `alignas(N)` | Force variable/struct to N-byte alignment |
| `static_assert` | Verify sizes and offsets at compile time |

---

## Practical Exercises

1. **sizeof quiz**: Without running, predict `sizeof` for 5 different structs with mixed field types. Then verify.

2. **Layout optimizer**: Given a struct with known sizes, reorder fields to minimize sizeof.

3. **PE reader**: Write the PE header reader above. Extend it to print the machine type (x86/x64) from the COFF header immediately after the PE signature.

4. **Padding visualizer**: Write a macro `SHOW_OFFSETS(Struct, field)` that uses `offsetof` to print each field's offset and verify against spec.

---

## Phase 0 Complete! 🎉

You've covered all C++ core gaps. Move on to low-level file I/O.

→ **Next Phase**: [`../01-file-io/01-c-style-file-io.md`](../01-file-io/01-c-style-file-io.md)
