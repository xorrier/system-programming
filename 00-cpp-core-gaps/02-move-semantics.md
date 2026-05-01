# Move Semantics & `std::move`

> **Phase 0 · Topic 2** | Estimated Time: 3–4 hours

---

## The Problem: Unnecessary Copying

In system programming you handle large buffers — patch files that can be **gigabytes**, byte arrays, strings. Copying these is expensive.

```cpp
std::vector<char> readFile(const char* path) {
    std::vector<char> data(1024 * 1024 * 500); // 500 MB buffer
    // ... fill data ...
    return data;  // ❌ Without move semantics (and no NRVO): could copy 500 MB!
}
```

Move semantics solve this by **transferring ownership** instead of copying.

---

## Lvalues vs Rvalues

This is the conceptual foundation you must internalize:

| Category | What it is | Example |
|----------|-----------|---------|
| **lvalue** | Has a name, has an address, persists beyond expression | `int x = 5; x` is an lvalue |
| **rvalue** | Temporary, no address, about to be destroyed | `5`, `x + y`, `getBuffer()` |

```cpp
int x = 10;      // x is an lvalue, 10 is an rvalue
int y = x + 3;   // (x + 3) is an rvalue

std::string s = "hello";         // s is an lvalue
std::string t = std::string("world"); // std::string("world") is an rvalue (temporary)
```

**Key rule**: You can move from rvalues (they're about to die anyway), not from lvalues (still in use).

---

## Reference Types

```cpp
int x = 10;

int& lref = x;          // lvalue reference — binds to lvalue
int&& rref = 10;        // rvalue reference — binds to rvalue (temporary)
// int&& bad = x;       // ERROR: can't bind rvalue ref to lvalue
```

### `const lvalue&` — The "Universal Parameter" (Old Way)

```cpp
// Takes both lvalues and rvalues, but can't steal/move from it
void process(const std::vector<char>& data);  
```

### `T&&` — Rvalue Reference (New Way)

```cpp
// Takes only rvalues — you know you can steal from it
void process(std::vector<char>&& data);
```

---

## Move Constructor & Move Assignment

When a class owns resources, you write two extra special members:

```cpp
class Buffer {
public:
    explicit Buffer(size_t size) 
        : data_(new char[size]), size_(size) {}

    // Destructor
    ~Buffer() { delete[] data_; }

    // ❌ Copy constructor — expensive: allocates and copies bytes
    Buffer(const Buffer& other)
        : data_(new char[other.size_]), size_(other.size_) {
        std::copy(other.data_, other.data_ + other.size_, data_);
    }

    // ✅ Move constructor — cheap: just steal the pointer
    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;   // Leave source in valid but empty state
        other.size_ = 0;
    }

    // ✅ Move assignment operator
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;          // Free our current resource
            data_ = other.data_;     // Steal theirs
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
    }

private:
    char* data_;
    size_t size_;
};
```

---

## `std::move` — Casting to Rvalue Reference

`std::move` doesn't actually move anything. It just **casts an lvalue to an rvalue reference**, signaling "I'm done with this, you can steal it."

```cpp
Buffer a(1024);              // a owns 1024 bytes
Buffer b = std::move(a);     // b takes ownership; a is now empty (data_ == nullptr)

// ⚠️ a is in a valid but unspecified state after being moved from
// Don't use a.data_ — you don't know what's in it
```

### Practical Example: Returning Large Objects

```cpp
std::vector<char> loadPatch(const std::string& path) {
    std::vector<char> data;
    data.resize(getFileSize(path));
    // ... fill data ...
    return data;    // RVO or move — no copy happens
}

auto patch = loadPatch("update.cab");  // Fast: move, not copy
```

> **Named Return Value Optimization (NRVO)**: The compiler often elides the move/copy entirely. Don't add `return std::move(localVar);` — it can actually *prevent* NRVO.

---

## Forwarding References & Perfect Forwarding

When you write a template function that takes `T&&`, it's a **forwarding reference** (also called "universal reference"), not an rvalue reference:

```cpp
template<typename T>
void wrapper(T&& arg) {
    // arg could be lvalue or rvalue — we don't know
    process(std::forward<T>(arg));  // Preserve the original value category
}
```

`std::forward<T>` casts back to the original category:
- If `arg` was an lvalue → passes as lvalue
- If `arg` was an rvalue → passes as rvalue (enables move)

```cpp
// Usage:
std::string s = "hello";
wrapper(s);                  // passes as lvalue (copy in process)
wrapper(std::string("hi"));  // passes as rvalue (move in process)
wrapper(std::move(s));       // passes as rvalue (move)
```

---

## Move Semantics in System Programming

### Moving File Buffers

```cpp
class FileReader {
public:
    std::vector<char> readAll() {
        std::vector<char> buf(fileSize_);
        // ... read into buf ...
        return buf;  // Move — no copy
    }
private:
    size_t fileSize_;
};

// Consumer:
auto data = reader.readAll();  // data takes ownership via move
```

### Moving into Containers

```cpp
std::vector<std::vector<char>> patches;

std::vector<char> patch1 = loadPatch("kb001.cab");  // Load
patches.push_back(std::move(patch1));               // Move into vector
// patch1 is now empty — no 500MB copy made
```

### Win32 Handle Wrapper (Moveable)

```cpp
class WinHandle {
public:
    explicit WinHandle(HANDLE h = INVALID_HANDLE_VALUE) : h_(h) {}
    ~WinHandle() { close(); }

    // Move only — handles can't be copied
    WinHandle(WinHandle&& o) noexcept : h_(o.h_) { o.h_ = INVALID_HANDLE_VALUE; }
    WinHandle& operator=(WinHandle&& o) noexcept {
        if (this != &o) { close(); h_ = o.h_; o.h_ = INVALID_HANDLE_VALUE; }
        return *this;
    }
    WinHandle(const WinHandle&) = delete;
    WinHandle& operator=(const WinHandle&) = delete;

    HANDLE get() const { return h_; }
    bool valid() const { return h_ != INVALID_HANDLE_VALUE; }

private:
    void close() { if (valid()) CloseHandle(h_); }
    HANDLE h_;
};
```

---

## Common Mistakes

```cpp
// ❌ Moving from const — does nothing, falls back to copy
const std::vector<char> data = loadPatch();
auto copy = std::move(data);  // Still copies! Can't move from const.

// ⚠️ Using moved-from object — valid but unspecified state for STL types
auto data = loadPatch();
process(std::move(data));
data.size();  // Legal, but value is unspecified (likely 0). Avoid relying on it.

// ❌ Returning with std::move — kills NRVO
std::vector<char> bad() {
    std::vector<char> v;
    return std::move(v);  // ❌ Forces move, prevents copy elision
}

// ✅ Just return by name — let compiler optimize
std::vector<char> good() {
    std::vector<char> v;
    return v;  // ✅ NRVO applies
}
```

---

## Quick Reference

| Concept | Syntax | Effect |
|---------|--------|--------|
| Move constructor | `T(T&& other)` | Steal resources from `other` |
| Move assignment | `T& operator=(T&&)` | Free own, steal from other |
| Cast to rvalue | `std::move(x)` | Signal: "steal from x" |
| Perfect forward | `std::forward<T>(x)` | Preserve value category in templates |
| Deleted copy | `T(const T&) = delete` | Prevent accidental copies |

---

## Practical Exercise

1. Implement a `MoveBuffer` class with:
   - Constructor that `new[]`s a buffer of given size
   - Move constructor and move assignment
   - No copy constructor (deleted)
2. Return a `MoveBuffer` from a function and verify no copy happens (add print in move constructor)
3. Push `MoveBuffer` objects into a `std::vector` using `std::move`

---

## Next

→ [`03-pointers-smart-ptrs.md`](./03-pointers-smart-ptrs.md) — Raw pointers, references, and smart pointers
