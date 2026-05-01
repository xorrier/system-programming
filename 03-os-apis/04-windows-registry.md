# Windows Registry

> **Phase 3 · Topic 4** | Estimated Time: 2–3 hours

---

## What Is the Registry?

The Windows Registry is a **hierarchical database** that stores configuration for the OS, applications, drivers, and users. Think of it as a giant, persistent key-value store organized into a tree.

```
Registry
├── HKEY_LOCAL_MACHINE (HKLM)    ← System-wide settings
│   ├── SOFTWARE
│   │   ├── Microsoft
│   │   │   └── Windows
│   │   │       └── CurrentVersion
│   │   │           └── Run    ← Programs that start at login
│   │   └── MyApp
│   │       └── Settings
│   ├── SYSTEM
│   │   └── CurrentControlSet
│   │       └── Services       ← Windows services config
│   └── HARDWARE
├── HKEY_CURRENT_USER (HKCU)     ← Current user's settings
├── HKEY_CLASSES_ROOT (HKCR)     ← File associations, COM classes
├── HKEY_USERS (HKU)             ← All user profiles
└── HKEY_CURRENT_CONFIG (HKCC)   ← Current hardware profile
```

### Registry Terminology

| Term | Meaning | Analogy |
|------|---------|---------|
| **Hive** | Top-level tree (HKLM, HKCU) | Drive (C:, D:) |
| **Key** | A node in the tree | Folder |
| **Subkey** | A child key | Subfolder |
| **Value** | Named data stored in a key | File |
| **Default value** | Unnamed value in a key | README file |

### Value Types

| Type | Constant | Content |
|------|----------|---------|
| String | `REG_SZ` | Null-terminated string |
| Expanded String | `REG_EXPAND_SZ` | String with `%VAR%` references |
| Multi-String | `REG_MULTI_SZ` | Multiple null-terminated strings |
| DWORD (32-bit) | `REG_DWORD` | 4-byte integer |
| QWORD (64-bit) | `REG_QWORD` | 8-byte integer |
| Binary | `REG_BINARY` | Raw bytes |

---

## Reading Registry Values

### Reading a String

```cpp
#include <windows.h>
#include <cstdio>
#include <string>

std::wstring readRegString(HKEY hive, const wchar_t* keyPath, const wchar_t* valueName) {
    HKEY hKey;
    LONG result = RegOpenKeyExW(hive, keyPath, 0, KEY_READ, &hKey);
    if (result != ERROR_SUCCESS) {
        printf("RegOpenKeyEx failed: %ld\n", result);
        return L"";
    }

    wchar_t buffer[512];
    DWORD bufSize = sizeof(buffer);
    DWORD type;

    result = RegQueryValueExW(
        hKey,
        valueName,      // Value name (nullptr for default value)
        nullptr,        // Reserved
        &type,          // Output: value type
        reinterpret_cast<LPBYTE>(buffer),  // Output: data
        &bufSize        // In/Out: buffer size in bytes
    );

    RegCloseKey(hKey);

    if (result != ERROR_SUCCESS || type != REG_SZ) {
        return L"";
    }

    return std::wstring(buffer);
}

// Usage:
// auto name = readRegString(HKEY_LOCAL_MACHINE,
//     L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", L"ProductName");
// wprintf(L"Windows Version: %s\n", name.c_str());
```

### Reading a DWORD

```cpp
DWORD readRegDword(HKEY hive, const wchar_t* keyPath, const wchar_t* valueName) {
    HKEY hKey;
    RegOpenKeyExW(hive, keyPath, 0, KEY_READ, &hKey);

    DWORD value = 0;
    DWORD size = sizeof(value);
    DWORD type;

    RegQueryValueExW(hKey, valueName, nullptr, &type,
                     reinterpret_cast<LPBYTE>(&value), &size);

    RegCloseKey(hKey);
    return value;
}
```

---

## Writing Registry Values

```cpp
void writeRegString(HKEY hive, const wchar_t* keyPath,
                    const wchar_t* valueName, const wchar_t* data) {
    HKEY hKey;
    DWORD disposition;  // Was the key created or opened?

    // Create the key (or open if it exists)
    LONG result = RegCreateKeyExW(
        hive, keyPath, 0, nullptr,
        REG_OPTION_NON_VOLATILE,   // Persist across reboots
        KEY_WRITE,
        nullptr,
        &hKey,
        &disposition
    );

    if (result != ERROR_SUCCESS) return;

    if (disposition == REG_CREATED_NEW_KEY) {
        printf("Created new key\n");
    } else {
        printf("Opened existing key\n");
    }

    // Write the string value
    DWORD dataSize = (wcslen(data) + 1) * sizeof(wchar_t);
    RegSetValueExW(hKey, valueName, 0, REG_SZ,
                   reinterpret_cast<const BYTE*>(data), dataSize);

    RegCloseKey(hKey);
}

void writeRegDword(HKEY hive, const wchar_t* keyPath,
                   const wchar_t* valueName, DWORD value) {
    HKEY hKey;
    RegCreateKeyExW(hive, keyPath, 0, nullptr,
                    REG_OPTION_NON_VOLATILE, KEY_WRITE, nullptr, &hKey, nullptr);

    RegSetValueExW(hKey, valueName, 0, REG_DWORD,
                   reinterpret_cast<const BYTE*>(&value), sizeof(value));

    RegCloseKey(hKey);
}
```

---

## Enumerating Keys and Values

### List All Subkeys

```cpp
void listSubkeys(HKEY hive, const wchar_t* keyPath) {
    HKEY hKey;
    if (RegOpenKeyExW(hive, keyPath, 0, KEY_READ, &hKey) != ERROR_SUCCESS)
        return;

    wchar_t subkeyName[256];
    DWORD index = 0;
    DWORD nameLen;

    printf("Subkeys of %ls:\n", keyPath);
    while (true) {
        nameLen = 256;
        LONG result = RegEnumKeyExW(hKey, index, subkeyName, &nameLen,
                                     nullptr, nullptr, nullptr, nullptr);
        if (result == ERROR_NO_MORE_ITEMS) break;
        if (result == ERROR_SUCCESS) {
            wprintf(L"  [%lu] %s\n", index, subkeyName);
        }
        index++;
    }

    RegCloseKey(hKey);
}
```

### List All Values in a Key

```cpp
void listValues(HKEY hive, const wchar_t* keyPath) {
    HKEY hKey;
    if (RegOpenKeyExW(hive, keyPath, 0, KEY_READ, &hKey) != ERROR_SUCCESS)
        return;

    wchar_t valueName[256];
    DWORD index = 0;
    DWORD nameLen, type;

    printf("Values in %ls:\n", keyPath);
    while (true) {
        nameLen = 256;
        LONG result = RegEnumValueW(hKey, index, valueName, &nameLen,
                                     nullptr, &type, nullptr, nullptr);
        if (result == ERROR_NO_MORE_ITEMS) break;
        if (result == ERROR_SUCCESS) {
            const wchar_t* typeName = L"???";
            switch (type) {
                case REG_SZ:        typeName = L"REG_SZ"; break;
                case REG_DWORD:     typeName = L"REG_DWORD"; break;
                case REG_BINARY:    typeName = L"REG_BINARY"; break;
                case REG_MULTI_SZ:  typeName = L"REG_MULTI_SZ"; break;
                case REG_QWORD:     typeName = L"REG_QWORD"; break;
                case REG_EXPAND_SZ: typeName = L"REG_EXPAND_SZ"; break;
            }
            wprintf(L"  %-30s [%s]\n", valueName, typeName);
        }
        index++;
    }

    RegCloseKey(hKey);
}
```

---

## RAII Wrapper for HKEY

```cpp
class RegKey {
public:
    RegKey() = default;

    RegKey(HKEY hive, const wchar_t* path, REGSAM access = KEY_READ) {
        LONG r = RegOpenKeyExW(hive, path, 0, access, &hKey_);
        if (r != ERROR_SUCCESS) hKey_ = nullptr;
    }

    ~RegKey() { if (hKey_) RegCloseKey(hKey_); }

    RegKey(const RegKey&) = delete;
    RegKey& operator=(const RegKey&) = delete;
    RegKey(RegKey&& o) noexcept : hKey_(o.hKey_) { o.hKey_ = nullptr; }

    bool isValid() const { return hKey_ != nullptr; }
    HKEY get() const { return hKey_; }

    std::wstring readString(const wchar_t* name) {
        wchar_t buf[512];
        DWORD size = sizeof(buf);
        DWORD type;
        if (RegQueryValueExW(hKey_, name, nullptr, &type,
                             (LPBYTE)buf, &size) == ERROR_SUCCESS && type == REG_SZ)
            return buf;
        return L"";
    }

    DWORD readDword(const wchar_t* name, DWORD defaultVal = 0) {
        DWORD val, size = sizeof(val), type;
        if (RegQueryValueExW(hKey_, name, nullptr, &type,
                             (LPBYTE)&val, &size) == ERROR_SUCCESS && type == REG_DWORD)
            return val;
        return defaultVal;
    }

private:
    HKEY hKey_ = nullptr;
};

// Usage:
// RegKey key(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion");
// if (key.isValid()) {
//     auto product = key.readString(L"ProductName");
//     auto build   = key.readDword(L"CurrentBuildNumber");
// }
```

---

## Windows Update Registry Keys

Important registry locations for the WSD team:

| Key | Purpose |
|-----|---------|
| `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate` | WU agent config |
| `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing` | CBS config |
| `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate` | Group Policy WU settings |
| `HKLM\SYSTEM\CurrentControlSet\Services\wuauserv` | WU service registration |

---

## Practical Exercises

1. **System info reader**: Read Windows version, build number, and product name from registry.
2. **Registry browser**: Take a key path as input, list all subkeys and values.
3. **Startup programs**: List all programs in `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`.
4. **Config manager**: Write a program that stores/retrieves its settings in `HKCU\SOFTWARE\MyApp`.

---

## Key Takeaways

- ✅ Registry = hierarchical key-value store for Windows config
- ✅ `RegOpenKeyEx` → `RegQueryValueEx` → `RegCloseKey` is the basic pattern
- ✅ Always close `HKEY` handles — use RAII wrapper
- ✅ Use `RegCreateKeyEx` to create keys (it opens if already exists)
- ✅ Check value types — `REG_SZ` ≠ `REG_DWORD`
- ❌ Don't write to HKLM without admin rights
- ❌ Don't hardcode registry paths — they change between Windows versions

---

## Next

→ [`05-windows-services.md`](./05-windows-services.md) — Windows Services (ServiceMain, SCM)
