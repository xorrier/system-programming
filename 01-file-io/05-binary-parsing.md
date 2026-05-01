# Binary File Parsing (PE, CAB, INF)

> **Phase 1 · Topic 5** | Estimated Time: 4 hours

---

## Why Binary Parsing?

In system programming, you work with binary file formats constantly:
- **PE (Portable Executable)** — `.exe`, `.dll`, `.sys` files on Windows
- **CAB (Cabinet)** — compressed archives used by Windows Update
- **INF** — setup/driver description files

Understanding these formats is essential for the Windows Update team, where you'll parse update packages, verify driver signatures, and inspect executables.

---

## Fundamentals: Reading Structs from Binary Files

The core technique is **struct overlaying** — define a C++ struct that matches the binary layout, then read the file directly into it.

### `#pragma pack` — Controlling Struct Layout

By default, the compiler adds **padding** between struct members for alignment. Binary file formats have no padding, so we must disable it:

```cpp
// ❌ BAD — compiler may add padding
struct BadHeader {
    uint8_t  version;    // 1 byte
    // 3 bytes padding inserted here!
    uint32_t fileSize;   // 4 bytes
};  // sizeof = 8 (not 5!)

// ✅ GOOD — packed, matches binary layout
#pragma pack(push, 1)
struct GoodHeader {
    uint8_t  version;    // 1 byte
    uint32_t fileSize;   // 4 bytes (immediately after version)
};  // sizeof = 5 ✓
#pragma pack(pop)

// Always verify with static_assert!
static_assert(sizeof(GoodHeader) == 5, "Header must be 5 bytes");
```

### Reading a Struct from a File

```cpp
#include <cstdio>
#include <cstdint>
#include <stdexcept>

template<typename T>
T readStruct(FILE* fp) {
    T result;
    if (fread(&result, sizeof(T), 1, fp) != 1) {
        throw std::runtime_error("Failed to read struct");
    }
    return result;
}

// Or with memory-mapped files (even easier):
template<typename T>
const T* readStructMmap(const uint8_t* data, size_t offset, size_t fileSize) {
    if (offset + sizeof(T) > fileSize) {
        throw std::out_of_range("Read past end of file");
    }
    return reinterpret_cast<const T*>(data + offset);
}
```

---

## Endianness

Most formats you'll encounter on Windows are **little-endian** (x86/x64), which matches your CPU. But be aware:

| Endianness | Byte Order | Used By |
|------------|------------|---------|
| **Little-endian** | LSB first: `0x12345678` → `78 56 34 12` | x86, x64, ARM (Windows) |
| **Big-endian** | MSB first: `0x12345678` → `12 34 56 78` | Network protocols, Java class files |

```cpp
// Convert big-endian to host byte order (if needed)
uint32_t swapBytes(uint32_t val) {
    return ((val & 0xFF000000) >> 24) |
           ((val & 0x00FF0000) >> 8)  |
           ((val & 0x0000FF00) << 8)  |
           ((val & 0x000000FF) << 24);
}

// On Windows, you can also use: _byteswap_ulong(val)
```

---

## PE Format (Portable Executable)

Every `.exe` and `.dll` on Windows follows the PE format. Here's the structure:

```
┌─────────────────────────┐  Offset 0
│    DOS Header (64 B)    │  ← "MZ" magic
│    e_lfanew → ──────────┼──┐
├─────────────────────────┤  │
│    DOS Stub (optional)  │  │
├─────────────────────────┤  │
│    PE Signature (4 B)   │←─┘  "PE\0\0" (0x00004550)
├─────────────────────────┤
│    COFF Header (20 B)   │  ← Machine type, section count
├─────────────────────────┤
│  Optional Header (var)  │  ← Entry point, image base, data directories
├─────────────────────────┤
│   Section Headers       │  ← .text, .data, .rdata, .rsrc
├─────────────────────────┤
│   Section Data          │  ← Actual code and data
└─────────────────────────┘
```

### Key PE Structs

```cpp
#include <cstdint>

#pragma pack(push, 1)

// DOS Header — first 64 bytes of every PE file
struct DOSHeader {
    uint16_t e_magic;      // 0x5A4D = "MZ"
    uint16_t e_cblp;       // Bytes on last page
    uint16_t e_cp;         // Pages in file
    // ... (many legacy fields we skip)
    uint16_t e_padding[29];
    int32_t  e_lfanew;     // Offset to PE header (at byte 60)
};

// COFF File Header — immediately after PE signature
struct COFFHeader {
    uint16_t Machine;              // 0x8664 = x64, 0x014C = x86
    uint16_t NumberOfSections;
    uint32_t TimeDateStamp;        // Unix timestamp
    uint32_t PointerToSymbolTable;
    uint32_t NumberOfSymbols;
    uint16_t SizeOfOptionalHeader;
    uint16_t Characteristics;
};

// Section Header — one per section
struct SectionHeader {
    char     Name[8];              // ".text\0\0\0"
    uint32_t VirtualSize;
    uint32_t VirtualAddress;       // RVA when loaded in memory
    uint32_t SizeOfRawData;        // Size on disk
    uint32_t PointerToRawData;     // Offset on disk
    uint32_t PointerToRelocations;
    uint32_t PointerToLinenumbers;
    uint16_t NumberOfRelocations;
    uint16_t NumberOfLinenumbers;
    uint32_t Characteristics;      // Flags: code, data, read, write, execute
};

#pragma pack(pop)
```

### Building a PE Inspector

```cpp
#include <cstdio>
#include <cstdint>
#include <stdexcept>
#include <cstring>

void inspectPE(const char* path) {
    FILE* fp = fopen(path, "rb");
    if (!fp) throw std::runtime_error("Cannot open file");

    // 1. Read DOS header
    DOSHeader dos;
    fread(&dos, sizeof(dos), 1, fp);

    if (dos.e_magic != 0x5A4D) {
        fclose(fp);
        throw std::runtime_error("Not a valid PE file (no MZ)");
    }
    printf("DOS Magic: MZ ✓\n");
    printf("PE header offset: 0x%X\n", dos.e_lfanew);

    // 2. Seek to PE signature
    fseek(fp, dos.e_lfanew, SEEK_SET);
    uint32_t peSig;
    fread(&peSig, 4, 1, fp);

    if (peSig != 0x00004550) {  // "PE\0\0"
        fclose(fp);
        throw std::runtime_error("Invalid PE signature");
    }
    printf("PE Signature: 0x%08X ✓\n", peSig);

    // 3. Read COFF header
    COFFHeader coff;
    fread(&coff, sizeof(coff), 1, fp);

    const char* machineType = "Unknown";
    if (coff.Machine == 0x8664) machineType = "x64 (AMD64)";
    else if (coff.Machine == 0x014C) machineType = "x86 (i386)";
    else if (coff.Machine == 0xAA64) machineType = "ARM64";

    printf("Machine: %s\n", machineType);
    printf("Sections: %d\n", coff.NumberOfSections);
    printf("Timestamp: %u\n", coff.TimeDateStamp);

    // 4. Skip optional header, read section headers
    fseek(fp, coff.SizeOfOptionalHeader, SEEK_CUR);

    printf("\nSections:\n");
    printf("  %-8s  %10s  %10s  %10s\n", "Name", "VirtAddr", "VirtSize", "RawSize");

    for (int i = 0; i < coff.NumberOfSections; ++i) {
        SectionHeader sec;
        fread(&sec, sizeof(sec), 1, fp);

        char name[9] = {};
        memcpy(name, sec.Name, 8);

        printf("  %-8s  0x%08X  %10u  %10u\n",
               name, sec.VirtualAddress, sec.VirtualSize, sec.SizeOfRawData);
    }

    fclose(fp);
}
```

Running on `notepad.exe` gives output like:
```
DOS Magic: MZ ✓
PE header offset: 0xF0
PE Signature: 0x00004550 ✓
Machine: x64 (AMD64)
Sections: 7
  .text     0x00001000       66560       66560
  .rdata    0x00012000       33280       33280
  .data     0x0001B000        2560        1024
  ...
```

---

## CAB Format (Cabinet Archives)

Windows Update uses CAB files extensively. The format starts with a CFHEADER:

```cpp
#pragma pack(push, 1)
struct CFHeader {
    uint32_t signature;    // 0x4D534346 = "MSCF"
    uint32_t reserved1;
    uint32_t cbCabinet;    // Total cabinet size
    uint32_t reserved2;
    uint32_t coffFiles;    // Offset to first CFFILE
    uint32_t reserved3;
    uint8_t  versionMinor; // 3
    uint8_t  versionMajor; // 1
    uint16_t cFolders;     // Number of folders
    uint16_t cFiles;       // Number of files
    uint16_t flags;
    uint16_t setID;
    uint16_t iCabinet;
};
#pragma pack(pop)

void inspectCab(const char* path) {
    FILE* fp = fopen(path, "rb");
    if (!fp) return;

    CFHeader hdr;
    fread(&hdr, sizeof(hdr), 1, fp);

    if (hdr.signature != 0x4D534346) {
        printf("Not a CAB file!\n");
        fclose(fp);
        return;
    }

    printf("CAB file: %s\n", path);
    printf("  Version: %d.%d\n", hdr.versionMajor, hdr.versionMinor);
    printf("  Size: %u bytes\n", hdr.cbCabinet);
    printf("  Folders: %u\n", hdr.cFolders);
    printf("  Files: %u\n", hdr.cFiles);

    fclose(fp);
}
```

---

## INF File Format

INF files are text-based (like INI files) used for driver installation and Windows setup:

```ini
[Version]
Signature   = "$Windows NT$"
Class       = Net
ClassGuid   = {4d36e972-e325-11ce-bfc1-08002be10318}
Provider    = %ManufacturerName%
DriverVer   = 01/01/2024,1.0.0.0

[Manufacturer]
%ManufacturerName% = Models, NTamd64

[Models.NTamd64]
%DeviceName% = Install, PCI\VEN_8086&DEV_1234
```

### Parsing INF with SetupAPI

```cpp
#include <windows.h>
#include <setupapi.h>
#include <cstdio>

#pragma comment(lib, "setupapi.lib")

void readInfFile(const wchar_t* infPath) {
    // Open the INF file
    HINF hInf = SetupOpenInfFileW(infPath, nullptr, INF_STYLE_WIN4, nullptr);
    if (hInf == INVALID_HANDLE_VALUE) {
        wprintf(L"Cannot open INF: %s\n", infPath);
        return;
    }

    // Read a value from [Version] section
    INFCONTEXT context;
    if (SetupFindFirstLineW(hInf, L"Version", L"Provider", &context)) {
        wchar_t value[256];
        if (SetupGetStringFieldW(&context, 1, value, 256, nullptr)) {
            wprintf(L"Provider: %s\n", value);
        }
    }

    SetupCloseInfFile(hInf);
}
```

### Simple INF Parser (No SetupAPI)

For learning, parse INF/INI files manually:

```cpp
#include <fstream>
#include <string>
#include <map>
#include <iostream>

using IniData = std::map<std::string, std::map<std::string, std::string>>;

IniData parseIni(const std::string& path) {
    IniData data;
    std::ifstream file(path);
    std::string line, currentSection;

    while (std::getline(file, line)) {
        // Trim whitespace
        auto start = line.find_first_not_of(" \t\r\n");
        if (start == std::string::npos) continue;
        line = line.substr(start);

        // Skip comments
        if (line[0] == ';' || line[0] == '#') continue;

        // Section header: [SectionName]
        if (line[0] == '[') {
            auto end = line.find(']');
            if (end != std::string::npos) {
                currentSection = line.substr(1, end - 1);
            }
            continue;
        }

        // Key = Value
        auto eq = line.find('=');
        if (eq != std::string::npos && !currentSection.empty()) {
            std::string key = line.substr(0, eq);
            std::string val = line.substr(eq + 1);
            // Trim
            key.erase(key.find_last_not_of(" \t") + 1);
            val.erase(0, val.find_first_not_of(" \t"));
            data[currentSection][key] = val;
        }
    }
    return data;
}
```

---

## Practical Exercises

1. **PE inspector**: Build a tool that reads an `.exe`, prints machine type, number of sections, entry point, and all section names.
2. **CAB lister**: Read a `.cab` file header, print file count and total size.
3. **INF parser**: Parse an INF file, print all sections and their key-value pairs.
4. **PE section dumper**: Extract a specific section (e.g., `.text`) from a PE file to a separate file.

---

## Key Takeaways

- ✅ Use `#pragma pack(push, 1)` to match binary layouts exactly
- ✅ Always `static_assert(sizeof(...))` to verify struct sizes
- ✅ Memory-mapped files make binary parsing very natural (pointer arithmetic)
- ✅ PE format: `MZ` → `e_lfanew` → `PE\0\0` → COFF → Sections
- ✅ CAB format: `MSCF` signature → folder/file entries
- ❌ Don't forget endianness when parsing network or cross-platform formats
- ❌ Don't assume file is valid — always bounds-check before reading

---

## Next Phase

→ [`../02-memory-management/`](../02-memory-management/) — Memory Management
