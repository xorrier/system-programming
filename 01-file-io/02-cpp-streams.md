# C++ File Streams (`<fstream>`)

> **Phase 1 · Topic 2** | Estimated Time: 2 hours

> 🚧 **Coming Soon** — This document will cover:

---

## Topics Planned

- `std::ifstream` — reading files
- `std::ofstream` — writing files
- `std::fstream` — read/write
- Opening modes: `std::ios::binary`, `std::ios::ate`, `std::ios::app`
- Reading line by line with `std::getline`
- Reading entire file into string: `istreambuf_iterator`
- `std::stringstream` for in-memory processing
- Error checking: `fail()`, `bad()`, `eof()`
- Stream iterators for bulk reading

## Key Code Snippet Preview

```cpp
// Read entire file into vector<char>
std::ifstream f("update.bin", std::ios::binary);
std::vector<char> data(
    std::istreambuf_iterator<char>(f),
    std::istreambuf_iterator<char>{}
);
```

---

## Next

→ [`03-memory-mapped-files.md`](./03-memory-mapped-files.md)
