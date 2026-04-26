---
title: C++ Playground
---

# ⚙ C++ Playground

Write and run C++ code directly in your browser. Powered by [Wandbox](https://wandbox.org) — no install needed.

> **Tips:** Use `Ctrl+Z` / `Cmd+Z` to undo. The editor supports full C++ IntelliSense-style completions. Code runs on a remote GCC/Clang compiler — output appears below the editor.

<CppPlayground />

---

## Quick Examples

Copy any snippet into the editor above and hit **▶ Run**.

### RAII File Wrapper

```cpp
#include <iostream>
#include <cstdio>

class FileGuard {
    FILE* f;
public:
    FileGuard(const char* path, const char* mode) : f(fopen(path, mode)) {}
    ~FileGuard() { if (f) { fclose(f); std::cout << "File closed by destructor\n"; } }
    bool ok() const { return f != nullptr; }
};

int main() {
    FileGuard g("/tmp/test.txt", "w");
    std::cout << (g.ok() ? "File opened OK\n" : "Failed to open\n");
    // Destructor auto-closes when g goes out of scope
    return 0;
}
```

### Move Semantics

```cpp
#include <iostream>
#include <vector>
#include <string>

std::vector<int> make_buffer(int size) {
    std::vector<int> buf(size, 42);
    std::cout << "Buffer created at " << buf.data() << "\n";
    return buf;   // move — no copy
}

int main() {
    auto b = make_buffer(5);
    std::cout << "Received at   " << b.data() << "\n";
    std::cout << "Size: " << b.size() << "\n";
    return 0;
}
```

### Smart Pointers

```cpp
#include <iostream>
#include <memory>

struct Resource {
    std::string name;
    Resource(std::string n) : name(n) { std::cout << "Acquired: " << name << "\n"; }
    ~Resource() { std::cout << "Released: " << name << "\n"; }
};

int main() {
    {
        auto r = std::make_unique<Resource>("Lock");
        std::cout << "Using: " << r->name << "\n";
    }   // r destroyed here — destructor runs automatically
    std::cout << "After scope\n";
    return 0;
}
```
