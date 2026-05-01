# Filesystem Operations

> **Phase 1 · Topic 4** | Estimated Time: 2 hours

---

## Why Filesystem Operations Matter

System programs constantly work with the filesystem:
- Enumerating files in a directory (scanning for updates, logs, configs)
- Checking file attributes (permissions, timestamps, size)
- Creating/deleting directories
- Resolving symbolic links and junctions
- Watching for file changes in real-time

C++17's `std::filesystem` gives us a **modern, cross-platform API** for all of this. For Windows-specific work, you'll also need Win32 APIs like `FindFirstFile` and `ReadDirectoryChangesW`.

---

## C++17 `std::filesystem` — The Modern API

```cpp
#include <filesystem>
namespace fs = std::filesystem;
```

### Paths

The `fs::path` class handles platform differences (forward slash vs backslash):

```cpp
fs::path p1 = "C:\\Windows\\System32\\notepad.exe";  // Windows
fs::path p2 = "/usr/bin/vim";                         // POSIX

// Decompose a path
std::cout << "Root:      " << p1.root_path()   << "\n";  // "C:\"
std::cout << "Directory: " << p1.parent_path() << "\n";  // "C:\Windows\System32"
std::cout << "Filename:  " << p1.filename()    << "\n";  // "notepad.exe"
std::cout << "Stem:      " << p1.stem()        << "\n";  // "notepad"
std::cout << "Extension: " << p1.extension()   << "\n";  // ".exe"

// Build paths safely (handles separators automatically)
fs::path logDir = "C:\\Logs";
fs::path logFile = logDir / "app" / "debug.log";
// Result: "C:\Logs\app\debug.log"
```

### Checking Files and Directories

```cpp
fs::path p = "C:\\Windows\\System32\\kernel32.dll";

if (fs::exists(p))              std::cout << "Exists\n";
if (fs::is_regular_file(p))     std::cout << "Is a file\n";
if (fs::is_directory(p))        std::cout << "Is a directory\n";
if (fs::is_symlink(p))          std::cout << "Is a symlink\n";

// File size in bytes
auto size = fs::file_size(p);
std::cout << "Size: " << size << " bytes\n";

// Last modified time
auto ftime = fs::last_write_time(p);
```

### Listing a Directory

```cpp
// List immediate children
void listDir(const fs::path& dir) {
    for (const auto& entry : fs::directory_iterator(dir)) {
        std::cout << (entry.is_directory() ? "[DIR] " : "      ")
                  << entry.path().filename().string()
                  << "\n";
    }
}

// List ALL files recursively
void listRecursive(const fs::path& dir) {
    for (const auto& entry : fs::recursive_directory_iterator(dir)) {
        if (entry.is_regular_file()) {
            std::cout << entry.path().string()
                      << " (" << entry.file_size() << " bytes)\n";
        }
    }
}
```

### Creating and Removing

```cpp
// Create a single directory
fs::create_directory("output");

// Create nested directories (like mkdir -p)
fs::create_directories("output/logs/2024");

// Remove a file
fs::remove("output/temp.txt");

// Remove a directory and ALL its contents (like rm -rf)
auto count = fs::remove_all("output");
std::cout << "Removed " << count << " files/directories\n";
```

### Copying, Moving, and Renaming

```cpp
// Copy a file
fs::copy_file("source.txt", "backup.txt",
              fs::copy_options::overwrite_existing);

// Copy a directory recursively
fs::copy("src_dir", "dst_dir", fs::copy_options::recursive);

// Move / Rename
fs::rename("old_name.txt", "new_name.txt");
```

### Canonical and Relative Paths

```cpp
// Resolve all symlinks and ".." to get the true absolute path
fs::path canon = fs::canonical("../system-programming/./README.md");

// Get relative path from one path to another
fs::path rel = fs::relative("/usr/local/bin", "/usr/local");
// Result: "bin"

// Get current working directory
fs::path cwd = fs::current_path();
```

---

## Error Handling

`std::filesystem` functions throw `fs::filesystem_error` by default. You can also use the `error_code` overloads for non-throwing behavior:

```cpp
// Throwing version (default)
try {
    auto size = fs::file_size("nonexistent.txt");
} catch (const fs::filesystem_error& e) {
    std::cerr << "Error: " << e.what() << "\n";
    std::cerr << "Path1: " << e.path1() << "\n";
}

// Non-throwing version
std::error_code ec;
auto size = fs::file_size("nonexistent.txt", ec);
if (ec) {
    std::cerr << "Error: " << ec.message() << "\n";
}
```

---

## Permissions

```cpp
// Read permissions
auto perms = fs::status("script.sh").permissions();

bool ownerRead  = (perms & fs::perms::owner_read)  != fs::perms::none;
bool ownerWrite = (perms & fs::perms::owner_write) != fs::perms::none;
bool ownerExec  = (perms & fs::perms::owner_exec)  != fs::perms::none;

// Set permissions
fs::permissions("script.sh", fs::perms::owner_exec, fs::perm_options::add);
```

---

## Win32: `FindFirstFile` / `FindNextFile`

The classic Win32 way to enumerate directories. Still needed for features `std::filesystem` doesn't expose:

```cpp
#include <windows.h>
#include <cstdio>

void listDirWin32(const wchar_t* dirPath) {
    WIN32_FIND_DATAW findData;
    wchar_t searchPath[MAX_PATH];
    swprintf_s(searchPath, L"%s\\*", dirPath);  // Append \* to search all

    HANDLE hFind = FindFirstFileW(searchPath, &findData);
    if (hFind == INVALID_HANDLE_VALUE) {
        wprintf(L"FindFirstFile failed for %s\n", dirPath);
        return;
    }

    do {
        // Skip "." and ".."
        if (wcscmp(findData.cFileName, L".") == 0 ||
            wcscmp(findData.cFileName, L"..") == 0) continue;

        bool isDir = (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
        wprintf(L"%s %s\n", isDir ? L"[DIR]" : L"     ", findData.cFileName);

        // File size (for large files, combine high and low parts)
        if (!isDir) {
            ULONGLONG fileSize = (static_cast<ULONGLONG>(findData.nFileSizeHigh) << 32)
                                 | findData.nFileSizeLow;
            wprintf(L"       Size: %llu bytes\n", fileSize);
        }
    } while (FindNextFileW(hFind, &findData));

    FindClose(hFind);
}
```

### File Attributes (Win32)

| Attribute | Meaning |
|-----------|---------|
| `FILE_ATTRIBUTE_DIRECTORY` | It's a directory |
| `FILE_ATTRIBUTE_HIDDEN` | Hidden file (e.g., desktop.ini) |
| `FILE_ATTRIBUTE_SYSTEM` | System file |
| `FILE_ATTRIBUTE_READONLY` | Read-only |
| `FILE_ATTRIBUTE_ARCHIVE` | Modified since last backup |
| `FILE_ATTRIBUTE_REPARSE_POINT` | Symbolic link or junction |

---

## Symbolic Links and Junctions (Windows)

Windows has two types of "links":

| Type | Target | Requires Admin? | Cross-Volume? |
|------|--------|-----------------|---------------|
| **Symbolic Link** | File or Directory | Yes (by default) | ✅ Yes |
| **Junction** | Directory only | No | ❌ No |

```cpp
// Create a symbolic link (C++17)
fs::create_symlink("target.txt", "link.txt");        // File symlink
fs::create_directory_symlink("target_dir", "link_dir"); // Dir symlink

// Check if something is a symlink
if (fs::is_symlink("link.txt")) {
    auto target = fs::read_symlink("link.txt");
    std::cout << "Points to: " << target << "\n";
}
```

---

## Watching for Changes: `ReadDirectoryChangesW`

Monitor a directory for file modifications in real-time — essential for update watchers:

```cpp
#include <windows.h>
#include <cstdio>

void watchDirectory(const wchar_t* dirPath) {
    HANDLE hDir = CreateFileW(
        dirPath,
        FILE_LIST_DIRECTORY,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        nullptr,
        OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS,  // Required for directories
        nullptr
    );
    if (hDir == INVALID_HANDLE_VALUE) return;

    char buffer[4096];
    DWORD bytesReturned;

    while (ReadDirectoryChangesW(
        hDir,
        buffer, sizeof(buffer),
        TRUE,                       // Watch subdirectories too
        FILE_NOTIFY_CHANGE_FILE_NAME |
        FILE_NOTIFY_CHANGE_LAST_WRITE |
        FILE_NOTIFY_CHANGE_SIZE,
        &bytesReturned,
        nullptr, nullptr))
    {
        auto* info = reinterpret_cast<FILE_NOTIFY_INFORMATION*>(buffer);
        do {
            std::wstring name(info->FileName,
                              info->FileNameLength / sizeof(wchar_t));

            const wchar_t* action = L"???";
            switch (info->Action) {
                case FILE_ACTION_ADDED:    action = L"ADDED";    break;
                case FILE_ACTION_REMOVED:  action = L"REMOVED";  break;
                case FILE_ACTION_MODIFIED: action = L"MODIFIED"; break;
                case FILE_ACTION_RENAMED_OLD_NAME: action = L"RENAMED (old)"; break;
                case FILE_ACTION_RENAMED_NEW_NAME: action = L"RENAMED (new)"; break;
            }
            wprintf(L"[%s] %s\n", action, name.c_str());

            if (info->NextEntryOffset == 0) break;
            info = reinterpret_cast<FILE_NOTIFY_INFORMATION*>(
                reinterpret_cast<char*>(info) + info->NextEntryOffset);
        } while (true);
    }

    CloseHandle(hDir);
}
```

---

## Practical Exercises

1. **Directory tree**: Print a tree-like view of a directory using `recursive_directory_iterator`.
2. **File finder**: Search for files matching a pattern (e.g., all `.log` files) under a given path.
3. **Disk usage tool**: Calculate total size of all files in a directory recursively.
4. **File watcher**: Use `ReadDirectoryChangesW` to watch a folder and print when files change.

---

## Key Takeaways

- ✅ Use `std::filesystem` (C++17) for cross-platform file/directory operations
- ✅ `fs::path` handles separators — use `/` operator to build paths
- ✅ Use `error_code` overloads for non-throwing error handling
- ✅ Win32 `FindFirstFile` is needed for Windows-specific attributes
- ✅ `ReadDirectoryChangesW` enables real-time filesystem monitoring
- ❌ Don't hardcode path separators — let `fs::path` handle it
- ❌ Don't forget to handle symlinks/junctions when walking directories

---

## Next

→ [`05-binary-parsing.md`](./05-binary-parsing.md) — Parsing PE, CAB, and INF binary formats
