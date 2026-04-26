# Binary File Parsing (PE, CAB, INF)

> **Phase 1 · Topic 5** | Estimated Time: 4 hours

> 🚧 **Coming Soon** — This document will cover:

---

## Topics Planned

### PE (Portable Executable) Format
- DOS header → PE signature → COFF header → Optional header → Section table
- Reading IMAGE_DOS_HEADER, IMAGE_NT_HEADERS, IMAGE_SECTION_HEADER
- Resolving RVA (Relative Virtual Address) to file offset
- Enumerating imports and exports tables

### CAB (Cabinet) File Format
- Cabinet file header structure (CFHEADER)
- Folder and file entries (CFFOLDER, CFFILE)
- Reading file names and sizes from a CAB archive
- Microsoft Cabinet SDK

### INF File Format
- Windows Update manifest / driver description files
- Section-based text format (similar to INI)
- Parsing with `SetupAPI`

---

## Key Code Snippet Preview

```cpp
#pragma pack(push, 1)
struct CFHeader {
    uint32_t signature;    // 0x4D534346 — 'MSCF'
    uint32_t reserved1;
    uint32_t cbCabinet;    // Total size of cabinet file
    uint32_t reserved2;
    uint32_t coffFiles;    // Offset to first CFFILE entry
    uint32_t reserved3;
    uint8_t  versionMinor; // Should be 3
    uint8_t  versionMajor; // Should be 1
    uint16_t cFolders;     // Number of folders
    uint16_t cFiles;       // Number of files
    // ...
};
#pragma pack(pop)

static_assert(sizeof(CFHeader) == 36 - 4, "CFHeader size check");
```

---

## Next Phase

→ [`../02-memory-management/`](../02-memory-management/)
