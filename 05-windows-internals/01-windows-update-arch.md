# Windows Update Architecture

> **Phase 5 · Topic 1** | Estimated Time: 4 hours

---

## Why Understand Windows Update Architecture?

As part of the Microsoft WSD Windows Update Patch team, you'll work directly with the components that download, verify, and install updates. Understanding the architecture lets you:

- Debug update failures by reading CBS logs
- Understand how update packages flow through the system
- Know which component is responsible for which stage

---

## The Big Picture

```
  Microsoft Update Servers
           │
           ▼
  ┌────────────────────────┐
  │  Update Orchestrator   │  ← UsoSvc (Update Session Orchestrator)
  │  Service (UsoSvc)      │     Decides WHEN to scan/download/install
  └───────────┬────────────┘
              ▼
  ┌────────────────────────┐
  │  Windows Update Agent  │  ← wuauserv service
  │  (WUA)                 │     Talks to servers, downloads updates
  └───────────┬────────────┘
              ▼
  ┌────────────────────────┐
  │  Component Based       │  ← TrustedInstaller service
  │  Servicing (CBS)       │     Actually installs/uninstalls components
  └───────────┬────────────┘
              ▼
  ┌────────────────────────┐
  │  Component Store       │  ← C:\Windows\WinSxS
  │  (WinSxS)             │     Stores all component versions
  └────────────────────────┘
```

---

## Key Components

### 1. Update Session Orchestrator (UsoSvc)

**Service name**: `UsoSvc`  
**Binary**: `musnotification.exe`, `usoclient.exe`

The orchestrator decides **when** to check for updates. It manages the update lifecycle:

```
Scan → Download → Install → Reboot (if needed)
```

```cmd
:: Manually trigger a scan
UsoClient.exe StartScan

:: Check for interactive updates
UsoClient.exe StartInteractiveScan

:: Start download
UsoClient.exe StartDownload

:: Start install
UsoClient.exe StartInstall
```

### 2. Windows Update Agent (WUA)

**Service name**: `wuauserv`  
**DLL**: `wuaueng.dll`

The WUA is the core engine. It:
- Communicates with Microsoft Update servers (HTTPS)
- Downloads update packages (`.msu`, `.cab`)
- Provides the COM API (`IUpdateSession`, `IUpdateSearcher`, etc.)

### 3. Component Based Servicing (CBS)

**Service name**: `TrustedInstaller`  
**DLL**: `cbscore.dll`, `wcp.dll`

CBS is the installer engine. It:
- Processes update packages (manifests, deltas)
- Manages the component store (`WinSxS`)
- Handles dependencies between components
- Logs everything to `CBS.log`

### 4. DISM (Deployment Image Servicing and Management)

**Binary**: `dism.exe`

Command-line tool that wraps CBS for servicing Windows images:

```cmd
:: Check system health
DISM /Online /Cleanup-Image /CheckHealth

:: Repair corrupted components
DISM /Online /Cleanup-Image /RestoreHealth

:: List installed packages
DISM /Online /Get-Packages

:: Add a package
DISM /Online /Add-Package /PackagePath:C:\updates\update.msu
```

---

## Update Package Formats

| Format | Extension | Contents |
|--------|-----------|----------|
| **MSU** | `.msu` | Microsoft Update Standalone — wrapper containing CABs |
| **CAB** | `.cab` | Cabinet archive with manifests + payload files |
| **Delta** | `.psf` | Binary deltas (patches to existing files) |
| **Express** | `.psf` | Smaller deltas for express updates |

### Inside an MSU Package

```
update.msu
├── WSUSSCAN.cab           ← Metadata for WSUS
├── Windows10.0-KB1234.cab ← The actual update payload
├── update.mum             ← Update manifest
└── update.cat             ← Digital signature (catalog)
```

### Inside the Update CAB

```
Windows10.0-KB1234.cab
├── update.mum             ← Manifest (what to install)
├── update.cat             ← Signature
├── package_for_KB1234.mum
├── amd64_component_31bf...
│   ├── component.manifest ← Component manifest
│   ├── f/                 ← Forward differential (delta)
│   │   └── ntdll.dll      ← Delta file
│   └── r/                 ← Reverse differential
│       └── ntdll.dll      ← Rollback delta
└── ...
```

---

## The Component Store (WinSxS)

`C:\Windows\WinSxS` stores **every version of every component** that has been installed. This enables:
- **Rollback** — uninstall an update by reverting to the previous version
- **Side-by-side** — multiple versions can coexist
- **Integrity checking** — verify components aren't corrupted

```
WinSxS/
├── amd64_microsoft-windows-kernel32_31bf3856ad364e35_10.0.19041.1_none_abc123/
│   └── kernel32.dll      ← Version 10.0.19041.1
├── amd64_microsoft-windows-kernel32_31bf3856ad364e35_10.0.19041.100_none_def456/
│   └── kernel32.dll      ← Version 10.0.19041.100 (patched)
└── ...
```

> WinSxS can grow very large (10+ GB). Use `DISM /Cleanup-Image /StartComponentCleanup` to clean up.

---

## CBS.log — The Most Important Log File

Location: `C:\Windows\Logs\CBS\CBS.log`

This log records everything CBS does. Understanding it is critical for debugging update failures.

### Key Log Entries

```
// Successful install
Info    CBS    Exec: Package [KB5012345] installed successfully.

// Failed install with error code
Error   CBS    Exec: Failed to install package. HRESULT = 0x800f0922

// Component store corruption detected
Error   CBS    Store corruption detected. Run DISM /RestoreHealth.

// Pending reboot
Info    CBS    Reboot required to complete servicing.
```

### Common CBS Error Codes

| HRESULT | Meaning |
|---------|---------|
| `0x800f0922` | CBS store corruption |
| `0x800f081f` | Source files not found |
| `0x800f0831` | Prerequisite package not installed |
| `0x800f0825` | Component store inconsistency |
| `0x80073712` | Missing or damaged file |

### Parsing CBS.log Programmatically

```cpp
#include <fstream>
#include <string>
#include <iostream>
#include <vector>

struct CbsLogEntry {
    std::string level;    // "Info", "Error", "Warning"
    std::string source;   // "CBS", "CSI", etc.
    std::string message;
};

std::vector<CbsLogEntry> parseCbsErrors(const std::string& logPath) {
    std::vector<CbsLogEntry> errors;
    std::ifstream file(logPath);
    std::string line;

    while (std::getline(file, line)) {
        // Look for error lines
        if (line.find("Error") != std::string::npos &&
            line.find("CBS") != std::string::npos) {
            CbsLogEntry entry;
            entry.level = "Error";
            entry.source = "CBS";
            entry.message = line;
            errors.push_back(entry);
        }
    }

    return errors;
}
```

---

## Update Installation Flow

```
1. SCAN
   UsoSvc → WUA → Microsoft servers
   "Any new updates for me?"

2. DOWNLOAD
   WUA downloads .msu/.cab to temp folder
   (C:\Windows\SoftwareDistribution\Download)

3. STAGE
   CBS extracts and validates packages
   Components staged in WinSxS

4. INSTALL
   TrustedInstaller applies changes
   Files replaced with new versions
   Registry updated

5. REBOOT (if needed)
   Some files are locked (kernel, drivers)
   PendingFileRenameOperations queue
   Changes applied during boot

6. CLEANUP
   Old component versions marked for removal
   GC via StartComponentCleanup
```

---

## Practical Exercises

1. **CBS log parser**: Read `CBS.log`, extract all error lines, print error codes and messages.
2. **MSU inspector**: Extract an `.msu` file (it's a CAB), list its contents.
3. **DISM wrapper**: Write a C++ program that calls `DISM /Online /Get-Packages` using `CreateProcess` and parses the output.
4. **Update history**: Use WUA COM API (next chapter) to list installed updates with KB numbers and dates.

---

## Key Takeaways

- ✅ UsoSvc orchestrates, WUA downloads, CBS installs, WinSxS stores
- ✅ `CBS.log` is your primary debugging tool for update failures
- ✅ DISM is the command-line wrapper around CBS
- ✅ Updates use delta patching to minimize download size
- ✅ WinSxS stores all versions for rollback capability
- ❌ Don't manually delete files from WinSxS — use DISM cleanup
- ❌ Don't ignore CBS error codes — they pinpoint the exact failure

---

## Next

→ [`02-com-programming.md`](./02-com-programming.md) — COM Programming and Windows Update API
