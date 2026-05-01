# Debugging Tools — WinDbg, ProcMon, ETW

> **Phase 5 · Topic 4** | Estimated Time: 4 hours

---

## Why Debugging Tools?

Debugging system-level code is different from debugging application code. You deal with:
- Multi-process interactions (services talking to each other)
- Kernel-level issues (drivers, system calls)
- Race conditions (timing-dependent bugs)
- Crash dumps from production machines

These tools are used daily by the Windows Update team.

---

## Tool 1: WinDbg — The Windows Debugger

WinDbg is the **most powerful debugger for Windows**. It can debug user-mode applications, kernel-mode drivers, and analyze crash dumps.

### Installation

- **WinDbg Preview** (recommended): Install from Microsoft Store
- **Classic WinDbg**: Comes with Windows SDK

### Launching

```cmd
:: Attach to a running process
windbg -p <PID>

:: Launch and debug an executable
windbg myapp.exe arg1 arg2

:: Open a crash dump
windbg -z C:\dumps\crash.dmp

:: Kernel debugging (advanced)
windbg -k net:port=50000,key=...
```

### Essential Commands

#### Navigation

| Command | Action |
|---------|--------|
| `g` | **Go** — continue execution |
| `p` | **Step over** — execute one line |
| `t` | **Step into** — step into function calls |
| `gu` | **Go up** — run until current function returns |
| `Ctrl+Break` | **Break** — pause execution |
| `.restart` | Restart the debugging session |
| `q` | Quit the debugger |

#### Breakpoints

```
bp myapp!main              // Break at main()
bp myapp!MyFunc             // Break at a specific function
bp kernel32!CreateFileW     // Break on Win32 API call
bl                          // List all breakpoints
bc *                        // Clear all breakpoints
bp myapp!MyFunc ".if (poi(@rcx)==0) {} .else {gc}"
                            // Conditional: break only if first arg is 0
```

#### Examining Memory and Variables

```
dv                          // Display local variables
dt myStruct                 // Display type layout
dt myStruct 0x12345678      // Display struct at address
dd 0x12345678 L4            // Display 4 DWORDs at address
da 0x12345678               // Display ASCII string at address
du 0x12345678               // Display Unicode string at address
db 0x12345678 L20           // Display 32 bytes as hex dump
```

#### Stack Traces

```
k                           // Stack trace (current thread)
kp                          // Stack trace with parameters
kn                          // Stack trace with frame numbers
~*k                         // Stack traces for ALL threads
~3s                         // Switch to thread 3
```

#### Symbols

```
.symfix                     // Set symbol path to Microsoft symbol server
.sympath+ C:\mysymbols      // Add custom symbol path
.reload                     // Reload symbols
lm                          // List loaded modules
x myapp!*Update*            // Search for symbols matching pattern
```

### Crash Dump Analysis

The most common WinDbg workflow — analyzing a crash dump:

```
// 1. Open the dump
windbg -z crash.dmp

// 2. Set symbols
0:000> .symfix
0:000> .reload

// 3. Auto-analyze the crash
0:000> !analyze -v

// This tells you:
// - Exception type (ACCESS_VIOLATION, etc.)
// - Faulting address
// - Call stack at the crash
// - Probable cause
```

### Heap Commands

```
!heap -s                    // Summary of all heaps
!heap -a 0x00410000         // Detailed view of a specific heap
!heap -l                    // Find leaked allocations
!heap -flt s 1024           // Find allocations of exactly 1024 bytes
!address -summary           // Memory summary (committed, reserved, free)
```

---

## Tool 2: Process Monitor (ProcMon)

**ProcMon** captures real-time file, registry, network, and process activity. Essential for answering: "What is this program doing?"

### Installation

Download from [Sysinternals](https://learn.microsoft.com/en-us/sysinternals/downloads/procmon).

### What ProcMon Captures

| Category | Examples |
|----------|---------|
| **File System** | CreateFile, ReadFile, WriteFile, DeleteFile |
| **Registry** | RegOpenKey, RegQueryValue, RegSetValue |
| **Network** | TCP Connect, Send, Receive |
| **Process** | Process Create, Thread Create, Load Image |

### Key Techniques

#### Filter to a Specific Process

```
Filter → Filter...
  Process Name → is → myapp.exe → Include
  Apply
```

#### Find Why a File Open Fails

```
Filter:
  Process Name is myapp.exe
  Operation is CreateFile
  Result is not SUCCESS

This shows every failed file open attempt — incredibly useful for
"file not found" debugging!
```

#### Watch Registry Access

```
Filter:
  Process Name is wuauserv.exe
  Category is Registry

See everything Windows Update reads/writes in the registry!
```

#### Track DLL Loading

```
Filter:
  Operation is Load Image
  Process Name is myapp.exe

Shows every DLL your process loads — find missing dependencies!
```

### ProcMon for Windows Update Debugging

Common filters for WU debugging:

```
Process Name is svchost.exe AND Path contains WindowsUpdate
Process Name is TrustedInstaller.exe
Path contains CBS
Path contains SoftwareDistribution
```

---

## Tool 3: ETW (Event Tracing for Windows)

ETW is Windows' **high-performance tracing infrastructure**. It's the most lightweight way to instrument system-level code.

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Provider 1  │────→│              │────→│  Consumer 1  │
│ (your code)  │     │   ETW        │     │ (logman)     │
├──────────────┤     │   Session    │     ├──────────────┤
│  Provider 2  │────→│   (Kernel)   │────→│  Consumer 2  │
│ (Windows)    │     │              │     │ (WPA)        │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Collecting Traces with `logman`

```cmd
:: List available ETW providers
logman query providers

:: Start tracing Windows Update events
logman create trace WUTrace -p Microsoft-Windows-WindowsUpdateClient -o wu_trace.etl
logman start WUTrace

:: Do something that triggers WU activity...

:: Stop and save
logman stop WUTrace
logman delete WUTrace

:: Convert to text
tracerpt wu_trace.etl -o wu_trace.txt -of CSV
```

### Collecting with `xperf` / Windows Performance Recorder

```cmd
:: Start recording
wpr -start GeneralProfile

:: Reproduce the issue...

:: Stop and save
wpr -stop trace.etl

:: Analyze with Windows Performance Analyzer (WPA)
wpa trace.etl
```

### Writing Your Own ETW Provider

```cpp
#include <windows.h>
#include <evntprov.h>

// Register a provider
REGHANDLE hProvider;
const GUID MY_PROVIDER_GUID =
    {0x12345678, 0xABCD, 0xEF01, {0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0x01}};

void initTracing() {
    EventRegister(&MY_PROVIDER_GUID, nullptr, nullptr, &hProvider);
}

void logEvent(const wchar_t* message) {
    EVENT_DESCRIPTOR desc = {};
    desc.Id = 1;
    desc.Level = 4;  // Informational

    EVENT_DATA_DESCRIPTOR dataDesc;
    EventDataDescCreate(&dataDesc, message,
                        (ULONG)(wcslen(message) + 1) * sizeof(wchar_t));

    EventWrite(hProvider, &desc, 1, &dataDesc);
}

void cleanupTracing() {
    EventUnregister(hProvider);
}
```

---

## Tool 4: Other Essential Tools

### Process Explorer

- Enhanced Task Manager
- Shows DLLs loaded by each process
- Handles, threads, performance graphs
- Find which process has a file locked

### Performance Monitor (PerfMon)

```cmd
:: Monitor CPU, memory, disk for a process
perfmon /res
```

### Debug Diagnostic Tool (DebugDiag)

Automatically analyzes crash dumps and memory leaks:

```
1. Install DebugDiag from Microsoft
2. Add Analysis → CrashHangAnalysis
3. Add your .dmp file
4. Click "Start Analysis"
5. Get a detailed HTML report
```

---

## Debugging Workflow for Windows Update Issues

```
1. REPRODUCE the issue
   
2. COLLECT logs
   - CBS.log (C:\Windows\Logs\CBS\CBS.log)
   - WindowsUpdate.log (Get-WindowsUpdateLog in PowerShell)
   - ProcMon trace (filtered to WU services)
   - ETW trace (Microsoft-Windows-WindowsUpdateClient)

3. ANALYZE
   - Search CBS.log for error HRESULTs
   - Check ProcMon for access denied / file not found
   - Look at WinDbg crash dump if it crashed

4. IDENTIFY the failing component
   - UsoSvc? → Orchestration issue
   - wuauserv? → Download/scan issue  
   - TrustedInstaller? → Installation issue
   - CBS? → Component store issue

5. FIX and VERIFY
   - DISM /RestoreHealth for store corruption
   - Reset Windows Update components
   - Apply the actual code fix
```

---

## Practical Exercises

1. **WinDbg crash analysis**: Compile a program that crashes (null deref), create a dump, analyze with `!analyze -v`.
2. **ProcMon investigation**: Use ProcMon to find what files `notepad.exe` reads when opening a file.
3. **ETW trace**: Collect a Windows Update ETW trace during a `UsoClient StartScan`, examine the events.
4. **Symbol server**: Configure WinDbg symbol path, set a breakpoint on `CreateFileW`, examine parameters.

---

## Key Takeaways

- ✅ **WinDbg**: The definitive Windows debugger — learn `!analyze -v`, `k`, `dv`, `bp`
- ✅ **ProcMon**: Real-time file/registry/process monitoring — essential for "what's happening?"
- ✅ **ETW**: Lightweight production tracing — zero overhead when not collecting
- ✅ Always get symbols first (`.symfix` + `.reload`)
- ✅ CBS.log + ProcMon + WinDbg = your Windows Update debugging toolkit
- ❌ Don't debug without symbols — stack traces will be useless
- ❌ Don't leave ProcMon running unfiltered — it captures millions of events per minute

---

## Congratulations! 🎉

You've completed all 5 phases of the System Programming learning path. You now have a solid foundation in:

- C++ core concepts (RAII, move semantics, smart pointers)
- File I/O (streams, memory mapping, binary parsing)
- Memory management (stack/heap, allocators, virtual memory)
- OS APIs (processes, threads, IPC, registry, services)
- Concurrency (threads, atomics, sync primitives, patterns)
- Windows internals (WU architecture, COM, error handling, debugging)

→ Go build something! Start with the **practical exercises** in each chapter.
