# Filesystem Operations

> **Phase 1 · Topic 4** | Estimated Time: 2 hours

> 🚧 **Coming Soon** — This document will cover:

---

## Topics Planned

- Directory enumeration: POSIX `opendir`/`readdir`, Win32 `FindFirstFile`/`FindNextFile`
- `std::filesystem` (C++17) — the modern cross-platform API
- File attributes: permissions, timestamps, hidden, system, archive flags
- Creating/removing directories recursively
- Symbolic links and junctions (Windows-specific!)
- Watching for filesystem changes: `ReadDirectoryChangesW`
- Windows-specific: alternate data streams (ADS)

## Key Code Snippet Preview

```cpp
#include <filesystem>
namespace fs = std::filesystem;

// List all files in a directory recursively
for (const auto& entry : fs::recursive_directory_iterator("C:\\Windows\\SysWOW64")) {
    if (entry.is_regular_file()) {
        std::cout << entry.path() << " (" << entry.file_size() << " bytes)\n";
    }
}
```

---

## Next

→ [`05-binary-parsing.md`](./05-binary-parsing.md)
