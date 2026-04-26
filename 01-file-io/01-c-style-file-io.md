# C-Style File I/O

> **Phase 1 · Topic 1** | Estimated Time: 2 hours

---

## Why C-Style File I/O?

Win32 system code, legacy libraries, and OS headers all use C-style file functions. You'll see `fopen`/`fread` in Windows Update components, INF parsers, and CAB extractors. You must be fluent in both C and C++ file APIs.

---

## Core Functions

| Function | Purpose |
|----------|---------|
| `fopen(path, mode)` | Open a file; returns `FILE*` or `nullptr` |
| `fclose(fp)` | Close file |
| `fread(buf, size, n, fp)` | Read `n` elements of `size` bytes |
| `fwrite(buf, size, n, fp)` | Write `n` elements of `size` bytes |
| `fseek(fp, offset, whence)` | Seek to position |
| `ftell(fp)` | Get current position |
| `rewind(fp)` | Seek to beginning |
| `feof(fp)` | Test end-of-file flag |
| `ferror(fp)` | Test error flag |

---

## Mode Strings

| Mode | Read | Write | Create | Truncate | Binary |
|------|------|-------|--------|----------|--------|
| `"r"` | ✅ | — | — | — | — |
| `"w"` | — | ✅ | ✅ | ✅ | — |
| `"a"` | — | ✅ | ✅ | — | — |
| `"rb"` | ✅ | — | — | — | ✅ |
| `"wb"` | — | ✅ | ✅ | ✅ | ✅ |
| `"r+b"` | ✅ | ✅ | — | — | ✅ |

> **Always use `"b"` mode for binary files on Windows!**  
> Text mode on Windows translates `\r\n` ↔ `\n`, destroying binary data.

---

## Reading a Binary File

```cpp
#include <cstdio>
#include <cstdint>
#include <vector>
#include <stdexcept>

// Read entire file into a vector<uint8_t>
std::vector<uint8_t> readBinaryFile(const char* path) {
    FILE* fp = fopen(path, "rb");
    if (!fp) {
        throw std::runtime_error(std::string("Cannot open: ") + path);
    }

    // Get file size
    fseek(fp, 0, SEEK_END);
    long size = ftell(fp);
    rewind(fp);

    if (size <= 0) {
        fclose(fp);
        throw std::runtime_error("Empty or invalid file");
    }

    // Read into buffer
    std::vector<uint8_t> data(static_cast<size_t>(size));
    size_t read = fread(data.data(), 1, data.size(), fp);
    fclose(fp);

    if (read != data.size()) {
        throw std::runtime_error("Read error: short read");
    }

    return data;
}
```

---

## RAII Wrapper for FILE*

Always wrap `FILE*` in a RAII class to prevent leaks on early returns:

```cpp
#include <cstdio>
#include <stdexcept>

class CFile {
public:
    explicit CFile(const char* path, const char* mode) {
        fp_ = fopen(path, mode);
        if (!fp_) throw std::runtime_error(std::string("fopen failed: ") + path);
    }

    ~CFile() {
        if (fp_) fclose(fp_);
    }

    CFile(const CFile&) = delete;
    CFile& operator=(const CFile&) = delete;
    CFile(CFile&& o) noexcept : fp_(o.fp_) { o.fp_ = nullptr; }

    FILE* get() const { return fp_; }

    // Convenience methods
    bool seek(long offset, int whence = SEEK_SET) {
        return fseek(fp_, offset, whence) == 0;
    }
    long tell() const { return ftell(fp_); }
    long size() {
        long cur = tell();
        fseek(fp_, 0, SEEK_END);
        long sz = tell();
        fseek(fp_, cur, SEEK_SET);
        return sz;
    }

    template<typename T>
    bool read(T* out) {
        return fread(out, sizeof(T), 1, fp_) == 1;
    }
    template<typename T>
    bool write(const T& val) {
        return fwrite(&val, sizeof(T), 1, fp_) == 1;
    }

private:
    FILE* fp_ = nullptr;
};
```

---

## Chunked Reading (Large Files)

Never read a multi-GB file all at once. Use a chunk loop:

```cpp
void processLargeFile(const char* path) {
    CFile f(path, "rb");

    constexpr size_t CHUNK = 64 * 1024;  // 64 KB chunks
    std::vector<uint8_t> buf(CHUNK);

    while (true) {
        size_t n = fread(buf.data(), 1, CHUNK, f.get());
        if (n == 0) break;       // EOF or error

        processChunk(buf.data(), n);
    }

    if (ferror(f.get())) {
        throw std::runtime_error("File read error");
    }
}
```

---

## Writing Files

```cpp
void writeConfig(const char* path, const char* content) {
    CFile f(path, "wb");

    size_t len = strlen(content);
    if (fwrite(content, 1, len, f.get()) != len) {
        throw std::runtime_error("Write error");
    }
    // File closed automatically when CFile goes out of scope
}
```

---

## Random Access (Seeking)

```cpp
#pragma pack(push, 1)
struct PESignature { uint32_t sig; };
#pragma pack(pop)

void checkPESignature(const char* exePath) {
    CFile f(exePath, "rb");

    // Read DOS header magic
    uint16_t magic;
    f.read(&magic);
    if (magic != 0x5A4D) throw std::runtime_error("Not a DOS executable");

    // Seek to e_lfanew (at offset 0x3C)
    f.seek(0x3C);
    uint32_t peOffset;
    f.read(&peOffset);

    // Jump to PE header
    f.seek(peOffset);
    uint32_t peSig;
    f.read(&peSig);

    printf("PE signature: 0x%08X (expected 0x00004550)\n", peSig);
}
```

---

## Error Handling

```cpp
FILE* fp = fopen(path, "rb");
if (!fp) {
    // errno is set by fopen
    perror("fopen");   // Prints: "fopen: No such file or directory"
    // Or:
    fprintf(stderr, "Error %d: %s\n", errno, strerror(errno));
    return;
}

size_t n = fread(buf, 1, size, fp);
if (n < size) {
    if (feof(fp)) fprintf(stderr, "Unexpected end of file\n");
    if (ferror(fp)) fprintf(stderr, "Read error: %d\n", errno);
}
```

---

## Practical Exercises

1. **File info tool**: Takes a filename, prints size, first 16 bytes in hex.
2. **Hex dump** (`xxd` clone): Read a binary file, print 16 bytes per line in hex + ASCII.
3. **File copy**: Copy a file in 64KB chunks. Verify with checksums.
4. **PE magic checker**: Check if a given file is a valid PE (MZ+PE signature).

---

## Next

→ [`02-cpp-streams.md`](./02-cpp-streams.md) — C++ `ifstream` / `ofstream`
