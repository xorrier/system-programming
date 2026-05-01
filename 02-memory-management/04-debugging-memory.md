# Debugging Memory Issues

> **Phase 2 · Topic 4** | Estimated Time: 3 hours

---

## Why Memory Debugging Matters

Memory bugs are the **#1 source of security vulnerabilities** and crashes in system code:
- Buffer overflows → code execution exploits
- Use-after-free → data corruption, crashes
- Memory leaks → services run out of memory over time
- Double free → heap corruption

These bugs are hard to find because they often **don't crash immediately** — they corrupt memory silently and crash later in unrelated code.

---

## Common Memory Bugs

### 1. Buffer Overflow

Writing past the end of a buffer:

```cpp
// ❌ BAD — writing past the array
char buf[8];
strcpy(buf, "This string is way too long!");  // Overflows!
// Overwrites adjacent memory — could corrupt stack frame, return address
```

### 2. Use-After-Free

Accessing memory after it's been freed:

```cpp
// ❌ BAD
int* p = new int(42);
delete p;
printf("%d\n", *p);  // p points to freed memory — undefined behavior!
```

### 3. Double Free

Freeing the same memory twice:

```cpp
// ❌ BAD
int* p = new int(42);
delete p;
delete p;  // Heap corruption!
```

### 4. Memory Leak

Allocating without ever freeing:

```cpp
// ❌ BAD
void processRequest() {
    char* data = new char[4096];
    // ... process ...
    if (error) return;  // LEAK! data never freed on error path
    delete[] data;
}
```

### 5. Uninitialized Read

Reading memory before writing to it:

```cpp
// ❌ BAD
int x;                 // Uninitialized — contains garbage
if (x > 0) { ... }    // Undefined behavior!
```

---

## Tool 1: AddressSanitizer (ASAN)

The **best tool for finding memory bugs** during development. Available in GCC, Clang, and MSVC.

### How to Use

Just add a compiler flag — no code changes needed:

```bash
# GCC / Clang
g++ -fsanitize=address -g -O1 myfile.cpp -o myapp
./myapp

# MSVC (Visual Studio 2019+)
cl /fsanitize=address /Zi myfile.cpp
```

### What ASAN Catches

| Bug Type | Detected? |
|----------|-----------|
| Heap buffer overflow | ✅ |
| Stack buffer overflow | ✅ |
| Use-after-free | ✅ |
| Double free | ✅ |
| Memory leaks | ✅ (with leak sanitizer) |
| Use-after-return | ✅ (with flag) |

### Example: ASAN in Action

```cpp
// test_asan.cpp
#include <cstdlib>

int main() {
    int* arr = new int[10];
    arr[10] = 42;  // Buffer overflow! Writing to index 10 of a 10-element array
    delete[] arr;
    return 0;
}
```

```bash
$ g++ -fsanitize=address -g test_asan.cpp -o test_asan
$ ./test_asan

=================================================================
==12345==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x604000000028
WRITE of size 4 at 0x604000000028 thread T0
    #0 0x4011a3 in main test_asan.cpp:5     ← EXACT LINE!
    #1 0x7f... in __libc_start_main
```

ASAN tells you:
- **What**: heap-buffer-overflow
- **Where**: exact file and line number
- **How**: WRITE of 4 bytes past the buffer

### Other Sanitizers

```bash
# Memory Sanitizer — find uninitialized reads (Clang only)
clang++ -fsanitize=memory -g myfile.cpp

# Thread Sanitizer — find data races
g++ -fsanitize=thread -g myfile.cpp

# Undefined Behavior Sanitizer
g++ -fsanitize=undefined -g myfile.cpp
```

---

## Tool 2: Valgrind (Linux/macOS)

Valgrind runs your program in a virtual CPU and tracks every memory access.

```bash
# Install (Linux)
sudo apt install valgrind

# Run
valgrind --leak-check=full ./myapp
```

### Example Output

```
==12345== 40 bytes in 1 blocks are definitely lost in loss record 1 of 1
==12345==    at 0x4C2E0: operator new[](unsigned long)
==12345==    by 0x401176: processData() (main.cpp:15)
==12345==    by 0x4011A3: main (main.cpp:22)
==12345==
==12345== LEAK SUMMARY:
==12345==    definitely lost: 40 bytes in 1 blocks
==12345==    indirectly lost: 0 bytes in 0 blocks
==12345==    possibly lost: 0 bytes in 0 blocks
==12345==    still reachable: 0 bytes in 0 blocks
```

### Valgrind vs ASAN

| Feature | Valgrind | ASAN |
|---------|----------|------|
| Speed | 🐢 20-50x slower | ⚡ 2x slower |
| Recompile needed? | No | Yes |
| Detection quality | Good | Excellent |
| Platform | Linux, macOS | Linux, macOS, Windows |
| Stack overflow detection | Limited | ✅ |

> **Recommendation**: Use ASAN during development (faster). Use Valgrind for deep analysis of release builds.

---

## Tool 3: Windows Debug Tools

### Application Verifier

A Microsoft tool that catches memory errors in Windows applications:

1. Install **Windows SDK**
2. Open **Application Verifier**
3. Add your `.exe`
4. Enable "Basics" → "Heaps"
5. Run your app — it will break in the debugger on errors

### CRT Debug Heap (`_CrtSetDbgFlag`)

The C Runtime has a built-in debug heap (Debug builds only):

```cpp
#include <crtdbg.h>

int main() {
    // Enable leak detection at program exit
    _CrtSetDbgFlag(_CRTDBG_ALLOC_MEM_DF | _CRTDBG_LEAK_CHECK_DF);

    // Your code...
    int* leak = new int(42);  // Never deleted

    return 0;
}
// At exit, Output Window shows:
// Detected memory leaks!
// {123} normal block at 0x00AB1234, 4 bytes long.
//  Data: <*   > 2A 00 00 00
```

### Finding the Leak by Allocation Number

```cpp
// Break on allocation #123 (from the leak report)
_CrtSetBreakAlloc(123);
// Now the debugger stops at the exact line that leaked!
```

### GFlags (Global Flags)

Enable page heap to catch buffer overflows:

```cmd
:: Enable page heap for your app
gflags /p /enable myapp.exe /full

:: Run the app — overflows cause immediate access violations
myapp.exe

:: Disable when done
gflags /p /disable myapp.exe
```

Page heap places a **guard page** at the end of every allocation. Any overflow immediately triggers an access violation, caught by the debugger.

---

## Tool 4: WinDbg Heap Commands

In WinDbg, you can inspect the heap:

```
!heap -s              // Summary of all heaps
!heap -a <heapAddr>   // Detailed dump of a specific heap
!heap -l              // Find leaked heap blocks
!heap -p -a <addr>    // Page heap info for an address
```

Example workflow:
```
0:000> !heap -l
Searching the memory for potential unreachable busy blocks.
Heap 00410000
    002F1234 0020 - (busy)    // Leaked block!

0:000> !heap -p -a 002F1234
    address 002F1234 found in
    _HEAP @ 410000
      HEAP_ENTRY Size: 0020
      User allocation at 002F1240
      Trace: (call stack of the allocation)
```

---

## Prevention: Write Safe Code

The best debugging tool is **not having bugs**. Use these patterns:

```cpp
// ✅ RAII — automatic cleanup
{
    auto data = std::make_unique<int[]>(100);
    // No leak possible — freed when data goes out of scope
}

// ✅ Smart pointers instead of raw new/delete
std::shared_ptr<Widget> w = std::make_shared<Widget>();

// ✅ std::vector instead of raw arrays
std::vector<int> v(100);  // Bounds-checked with .at()
v.at(100);  // throws std::out_of_range

// ✅ std::string instead of char[]
std::string name = "safe";  // No buffer overflow possible

// ✅ Set pointers to nullptr after delete
delete p;
p = nullptr;  // Prevents use-after-free (crash instead of silent corruption)
```

---

## Practical Exercises

1. **ASAN test suite**: Write programs with intentional bugs (overflow, use-after-free, leak) and verify ASAN catches each one.
2. **CRT leak detection**: Enable `_CrtSetDbgFlag`, create a leak, use `_CrtSetBreakAlloc` to find the exact line.
3. **GFlags page heap**: Enable page heap for a test app, trigger a buffer overflow, catch it in the debugger.
4. **Safe refactor**: Take a C-style program using raw `new`/`delete` and refactor to use `unique_ptr` and `vector`.

---

## Key Takeaways

- ✅ **ASAN** is your best friend — catches most bugs at 2x slowdown
- ✅ Use `_CrtSetDbgFlag` in Debug builds for leak reports
- ✅ **GFlags page heap** catches overflows instantly
- ✅ Valgrind for deep analysis (Linux/macOS)
- ✅ Prevention > Detection: use RAII, smart pointers, `std::vector`
- ❌ Don't ignore ASAN/Valgrind warnings — every one is a real bug
- ❌ Don't ship Debug builds — CRT debug heap is 10x slower

---

## Next Phase

→ [`../03-os-apis/`](../03-os-apis/) — OS APIs & System Calls
