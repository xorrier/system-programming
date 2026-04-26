# RAII — Resource Acquisition Is Initialization

> **Phase 0 · Topic 1** | Estimated Time: 2–3 hours

---

## What is RAII?

RAII is a C++ programming idiom where **resource acquisition (e.g., opening a file, allocating memory) happens in the constructor**, and **resource release happens in the destructor** — automatically, even if an exception is thrown.

The core idea: **tie resource lifetime to object lifetime**.

> If you only learn one C++ idiom for system programming, make it RAII.  
> It is the foundation of `std::unique_ptr`, `std::lock_guard`, `std::fstream`, and more.

---

## Why It Matters in System Programming

In system code you deal with:
- File handles (`HANDLE`, `FILE*`, `int fd`)
- Memory allocations (`malloc`, `VirtualAlloc`, `HeapAlloc`)
- Mutexes and locks
- Network sockets
- Registry keys (`HKEY`)
- COM pointers (`IUnknown*`)

Every single one of these **must be released** when you're done.  
Without RAII, a single `return` or thrown exception causes a **resource leak**.

---

## The Problem Without RAII

```cpp
// ❌ BAD — classic C-style code
void processFile(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) return;

    char* buf = (char*)malloc(1024);
    if (!buf) {
        fclose(f);  // Must remember to close!
        return;
    }

    // ... if something throws here, both f and buf leak
    doWork(f, buf);

    free(buf);
    fclose(f);  // Easy to forget, or skip on error paths
}
```

Every early return or exception = leak. The more error paths you have, the worse it gets.

---

## The Solution: RAII

```cpp
// ✅ GOOD — RAII style using C++ wrappers
void processFile(const char* path) {
    std::ifstream f(path, std::ios::binary);  // opens in constructor
    if (!f) return;

    std::vector<char> buf(1024);              // allocated in constructor

    doWork(f, buf.data());

    // f and buf are destroyed here automatically — even if exception thrown
}
```

The destructor runs **guaranteed** when the object goes out of scope.

---

## Writing Your Own RAII Wrapper

This is the pattern you'll write constantly for Win32 `HANDLE`s, `HKEY`s, etc.

```cpp
#include <windows.h>
#include <stdexcept>

// RAII wrapper for a Win32 HANDLE
class FileHandle {
public:
    // Acquire: constructor opens the resource
    explicit FileHandle(const wchar_t* path) {
        handle_ = CreateFileW(
            path,
            GENERIC_READ,
            FILE_SHARE_READ,
            nullptr,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            nullptr
        );
        if (handle_ == INVALID_HANDLE_VALUE) {
            throw std::runtime_error("Failed to open file");
        }
    }

    // Release: destructor cleans up
    ~FileHandle() {
        if (handle_ != INVALID_HANDLE_VALUE) {
            CloseHandle(handle_);
        }
    }

    // Prevent copying (two owners = double free!)
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;

    // Allow moving (transfer ownership)
    FileHandle(FileHandle&& other) noexcept : handle_(other.handle_) {
        other.handle_ = INVALID_HANDLE_VALUE;
    }

    HANDLE get() const { return handle_; }

private:
    HANDLE handle_;
};
```

Usage:
```cpp
void readUpdatePackage(const wchar_t* path) {
    FileHandle file(path);     // Opens in constructor

    DWORD bytesRead = 0;
    char buffer[4096];
    ReadFile(file.get(), buffer, sizeof(buffer), &bytesRead, nullptr);

    // file.~FileHandle() called automatically here → CloseHandle()
}
```

---

## RAII in the Standard Library

The STL gives you RAII wrappers for common resources:

| Resource | RAII Wrapper |
|----------|-------------|
| Memory | `std::unique_ptr<T>`, `std::shared_ptr<T>`, `std::vector<T>` |
| Files | `std::ifstream`, `std::ofstream`, `std::fstream` |
| Mutexes | `std::lock_guard<Mutex>`, `std::unique_lock<Mutex>` |
| Threads | `std::thread` (calls `terminate()` if not joined → always join!) |

---

## RAII with Locks (Critical for System Code)

```cpp
#include <mutex>

std::mutex g_mutex;
int g_sharedState = 0;

void updateState(int value) {
    std::lock_guard<std::mutex> lock(g_mutex);  // Locks in constructor
    g_sharedState = value;
    // ... even if exception thrown here, mutex is unlocked in destructor
}   // lock.~lock_guard() → mutex.unlock()
```

---

## The "Rule of Zero / Three / Five"

When you write a class that owns a resource, you must follow one of:

| Rule | Meaning |
|------|---------|
| **Rule of Zero** | Don't manage resources directly; use smart pointers/RAII types |
| **Rule of Three** | If you write destructor, you must also write copy constructor + copy assignment |
| **Rule of Five** | Same as Three, plus move constructor + move assignment (C++11+) |

```cpp
class Resource {
public:
    ~Resource();                                    // Destructor
    Resource(const Resource&);                      // Copy constructor
    Resource& operator=(const Resource&);           // Copy assignment
    Resource(Resource&&) noexcept;                  // Move constructor
    Resource& operator=(Resource&&) noexcept;       // Move assignment
};
```

> **Prefer Rule of Zero**: Use `std::unique_ptr` to hold the resource and let the compiler generate everything else correctly.

---

## Practical Exercise

**Task**: Write a RAII wrapper for `FILE*` using the C API.

```cpp
class CFile {
public:
    explicit CFile(const char* path, const char* mode) {
        // TODO: open with fopen, throw on failure
    }
    ~CFile() {
        // TODO: close with fclose if open
    }
    // TODO: delete copy, implement move
    FILE* get() const { return file_; }
private:
    FILE* file_ = nullptr;
};
```

Test it:
```cpp
int main() {
    try {
        CFile f("test.txt", "w");
        fprintf(f.get(), "Hello, System Programming!\n");
        // f closed automatically
    } catch (const std::exception& e) {
        fprintf(stderr, "Error: %s\n", e.what());
    }
}
```

---

## Key Takeaways

- ✅ Constructors acquire, destructors release — **always**
- ✅ Destructors run even when exceptions propagate
- ✅ Delete copy, implement move when owning raw resources
- ✅ Prefer standard RAII types (`unique_ptr`, `lock_guard`, `fstream`)
- ❌ Never rely on `goto cleanup:` patterns — that's C, not C++

---

## Next

→ [`02-move-semantics.md`](./02-move-semantics.md) — Move semantics & `std::move`
