# C++ File Streams (`<fstream>`)

> **Phase 1 · Topic 2** | Estimated Time: 2 hours

---

## Why C++ Streams?

C-style `fopen`/`fread` works but has problems:
- You must manually close files (leak risk)
- No type safety — everything is `void*` and byte counts
- Error handling is clunky (`ferror`, `errno`)

C++ streams (`<fstream>`) fix all of this:
- **RAII** — files close automatically when the stream goes out of scope
- **Type-safe** — `<<` and `>>` know the type
- **Extensible** — you can overload `<<` for your own types

> In system programming, you'll use C++ streams for text config files, log parsing, and quick prototyping. For binary work, you'll often prefer C-style or Win32 APIs — but you **must** know both.

---

## The Three Stream Classes

| Class | Header | Purpose |
|-------|--------|---------|
| `std::ifstream` | `<fstream>` | **Input** — reading files |
| `std::ofstream` | `<fstream>` | **Output** — writing files |
| `std::fstream` | `<fstream>` | **Both** — reading and writing |

All three inherit from `std::ios_base`, which defines the opening modes.

---

## Opening Modes

| Flag | Meaning |
|------|---------|
| `std::ios::in` | Open for reading (default for `ifstream`) |
| `std::ios::out` | Open for writing (default for `ofstream`) |
| `std::ios::binary` | Binary mode — **no text translation** |
| `std::ios::ate` | Seek to **end** after opening |
| `std::ios::app` | **Append** — all writes go to end |
| `std::ios::trunc` | **Truncate** — clear file on open (default with `out`) |

Combine flags with `|`:

```cpp
// Open for reading AND writing, in binary mode
std::fstream f("data.bin", std::ios::in | std::ios::out | std::ios::binary);
```

> ⚠️ **Always use `std::ios::binary`** when reading/writing binary data on Windows. Text mode translates `\r\n` ↔ `\n`, which corrupts binary content.

---

## Reading Files

### Read Line by Line

The most common pattern for text files:

```cpp
#include <fstream>
#include <iostream>
#include <string>

void readLines(const std::string& path) {
    std::ifstream file(path);
    if (!file) {
        std::cerr << "Cannot open: " << path << "\n";
        return;
    }

    std::string line;
    while (std::getline(file, line)) {
        std::cout << line << "\n";
    }
    // file closes automatically here (RAII!)
}
```

### Read Word by Word

The `>>` operator skips whitespace and reads one "token" at a time:

```cpp
void countWords(const std::string& path) {
    std::ifstream file(path);
    std::string word;
    int count = 0;

    while (file >> word) {
        ++count;
    }
    std::cout << "Total words: " << count << "\n";
}
```

### Read Entire File into a String

Two common approaches:

```cpp
#include <fstream>
#include <sstream>
#include <string>

// Method 1: Using stringstream
std::string readAll_v1(const std::string& path) {
    std::ifstream file(path);
    std::stringstream ss;
    ss << file.rdbuf();       // Dump entire file buffer into stringstream
    return ss.str();
}

// Method 2: Using istreambuf_iterator (more idiomatic)
std::string readAll_v2(const std::string& path) {
    std::ifstream file(path);
    return std::string(
        std::istreambuf_iterator<char>(file),
        std::istreambuf_iterator<char>{}     // end-of-stream sentinel
    );
}
```

### Read Entire File into a `vector<char>` (Binary)

```cpp
#include <fstream>
#include <vector>

std::vector<char> readBinary(const std::string& path) {
    std::ifstream file(path, std::ios::binary | std::ios::ate);  // ate = start at end
    if (!file) throw std::runtime_error("Cannot open: " + path);

    auto size = file.tellg();         // We're at the end, so tellg() = file size
    file.seekg(0, std::ios::beg);     // Seek back to beginning

    std::vector<char> data(size);
    file.read(data.data(), size);     // Read everything at once
    return data;
}
```

---

## Writing Files

### Write Text

```cpp
#include <fstream>
#include <iostream>

void writeConfig(const std::string& path) {
    std::ofstream file(path);   // Creates file if it doesn't exist, truncates if it does
    if (!file) {
        std::cerr << "Cannot create: " << path << "\n";
        return;
    }

    file << "# Configuration File\n";
    file << "version=1.0\n";
    file << "max_retries=3\n";
    file << "timeout_ms=" << 5000 << "\n";   // Type-safe: int converted automatically

    // file closes automatically
}
```

### Append to a File

```cpp
void appendLog(const std::string& path, const std::string& message) {
    std::ofstream file(path, std::ios::app);   // app = append mode
    file << "[LOG] " << message << "\n";
}
```

### Write Binary Data

```cpp
#include <fstream>
#include <cstdint>

#pragma pack(push, 1)
struct Header {
    uint32_t magic = 0xDEADBEEF;
    uint32_t version = 1;
    uint32_t recordCount = 0;
};
#pragma pack(pop)

void writeBinaryFile(const std::string& path) {
    std::ofstream file(path, std::ios::binary);

    Header hdr;
    hdr.recordCount = 42;

    // write() takes a const char* and a size
    file.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));
}
```

---

## Error Handling

Streams have **four state flags**:

| Method | Meaning |
|--------|---------|
| `good()` | Everything is fine — no flags set |
| `eof()` | End-of-file reached |
| `fail()` | Logical error (e.g., tried to read `int`, got "abc") |
| `bad()` | Irrecoverable I/O error (e.g., disk failure) |

```cpp
void safeRead(const std::string& path) {
    std::ifstream file(path);
    if (!file) {
        // !file is true when failbit or badbit is set
        std::cerr << "Failed to open file\n";
        return;
    }

    int value;
    file >> value;

    if (file.fail()) {
        std::cerr << "Failed to read integer (bad format?)\n";
        file.clear();           // Clear the error flags
        file.ignore(1000, '\n'); // Skip the bad input
    }

    if (file.bad()) {
        std::cerr << "Fatal I/O error!\n";
    }
}
```

### Enabling Exceptions

By default, streams silently set flags. You can make them throw:

```cpp
void readWithExceptions(const std::string& path) {
    std::ifstream file;
    file.exceptions(std::ios::failbit | std::ios::badbit);

    try {
        file.open(path);
        std::string line;
        while (std::getline(file, line)) {
            // process line
        }
    } catch (const std::ios_base::failure& e) {
        std::cerr << "I/O error: " << e.what() << "\n";
    }
}
```

---

## `std::stringstream` — In-Memory Streams

`stringstream` lets you use stream operations on strings. Extremely useful for parsing:

```cpp
#include <sstream>
#include <string>
#include <iostream>

void parseKeyValue(const std::string& line) {
    // line = "timeout_ms=5000"
    std::istringstream iss(line);

    std::string key;
    int value;

    std::getline(iss, key, '=');   // Read up to '='
    iss >> value;                  // Read the integer

    std::cout << "Key: " << key << ", Value: " << value << "\n";
}

// Building strings (like sprintf but type-safe)
std::string formatError(int code, const std::string& msg) {
    std::ostringstream oss;
    oss << "Error 0x" << std::hex << code << ": " << msg;
    return oss.str();
}
```

---

## Seeking in Streams

Both input and output streams support seeking:

```cpp
void seekExample(const std::string& path) {
    std::ifstream file(path, std::ios::binary);

    // seekg = "seek get" (input position)
    file.seekg(0, std::ios::end);       // Go to end
    auto fileSize = file.tellg();       // Current position = file size
    file.seekg(0, std::ios::beg);       // Back to start

    // For ofstream:
    // seekp = "seek put" (output position)
    // tellp() = current output position
}
```

| Method | Stream Type | Meaning |
|--------|-------------|---------|
| `seekg()` | Input | **Seek get** — move read position |
| `tellg()` | Input | **Tell get** — current read position |
| `seekp()` | Output | **Seek put** — move write position |
| `tellp()` | Output | **Tell put** — current write position |

---

## Overloading `<<` and `>>` for Custom Types

One of the most powerful features — make your types printable:

```cpp
#include <iostream>
#include <fstream>

struct UpdateRecord {
    std::string kbNumber;
    int severity;
    bool installed;
};

// Output operator
std::ostream& operator<<(std::ostream& os, const UpdateRecord& r) {
    os << r.kbNumber << "," << r.severity << "," << (r.installed ? "Y" : "N");
    return os;
}

// Input operator
std::istream& operator>>(std::istream& is, UpdateRecord& r) {
    char comma;
    char yn;
    is >> r.kbNumber >> comma >> r.severity >> comma >> yn;
    r.installed = (yn == 'Y');
    return is;
}

// Now you can do:
// std::cout << record;
// file >> record;
```

---

## C++ Streams vs C-Style I/O

| Feature | C (`<cstdio>`) | C++ (`<fstream>`) |
|---------|----------------|-------------------|
| RAII (auto-close) | ❌ | ✅ |
| Type safety | ❌ (`void*`) | ✅ (`<<`, `>>`) |
| Speed | ⚡ Faster | 🐢 Slower (overhead) |
| Binary I/O | ✅ Great | ✅ OK |
| Extensibility | ❌ | ✅ (overload `<<`) |
| Error handling | `errno` | State flags / exceptions |

> **Rule of thumb**: Use C++ streams for text files and quick prototyping. Use C-style or OS APIs for performance-critical binary I/O.

---

## Practical Exercises

1. **Config parser**: Read a `key=value` config file, store in `std::map<string,string>`, print all pairs.
2. **CSV reader**: Read a CSV file line by line, split by commas using `stringstream`, print as a formatted table.
3. **Log file analyzer**: Read a log file, count lines containing "ERROR", "WARN", "INFO".
4. **Binary header writer**: Write a 12-byte binary header to a file, then read it back and verify fields match.

---

## Key Takeaways

- ✅ `ifstream`/`ofstream` are RAII — files close automatically
- ✅ Use `std::getline()` for line-by-line reading
- ✅ Use `std::ios::binary` for binary files on Windows
- ✅ `stringstream` is your best friend for string parsing
- ✅ Overload `<<`/`>>` to make custom types streamable
- ❌ Don't use `eof()` as a loop condition — use `while (std::getline(...))`
- ❌ Don't forget to check stream state after reads

---

## Next

→ [`03-memory-mapped-files.md`](./03-memory-mapped-files.md) — Memory-mapped files with `mmap` and `MapViewOfFile`
