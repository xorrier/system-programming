# Windows Services

> **Phase 3 · Topic 5** | Estimated Time: 3–4 hours

---

## What Is a Windows Service?

A Windows Service is a **long-running background process** managed by the **Service Control Manager (SCM)**. Services:
- Start automatically at boot (before any user logs in)
- Run without a desktop/UI
- Have their own identity (LocalSystem, NetworkService, etc.)
- Can be started, stopped, paused, and restarted

**Examples**: Windows Update service (`wuauserv`), DNS Client, Print Spooler, your antivirus.

---

## Service Architecture

```
┌─────────────────────────────────────┐
│        Service Control Manager      │  ← The boss
│             (services.exe)          │
├──────────┬──────────┬───────────────┤
│ Service A│ Service B│ Service C     │
│ (svchost)│ (myapp)  │ (svchost)     │
│          │          │               │
│ ServiceMain()       │               │
│ Handler()           │               │
└──────────┴──────────┴───────────────┘
```

### Key Concepts

| Concept | Meaning |
|---------|---------|
| **SCM** | OS component that manages all services |
| **ServiceMain** | Entry point of your service (called by SCM) |
| **HandlerEx** | Callback for control requests (stop, pause) |
| **Service Status** | Your service reports its state to SCM |
| **Service Account** | Identity the service runs under |

### Service Lifecycle

```
Installed → Stopped → Starting → Running → Stopping → Stopped
                                    ↕
                                 Paused
```

---

## Building a Simple Service

### Step 1: Service Entry Point (`main`)

When the SCM starts your `.exe`, it calls `main()`, which must register the service:

```cpp
#include <windows.h>
#include <cstdio>

// Forward declarations
void WINAPI ServiceMain(DWORD argc, LPWSTR* argv);
DWORD WINAPI ServiceHandler(DWORD control, DWORD eventType,
                             LPVOID eventData, LPVOID context);

// Global state
SERVICE_STATUS_HANDLE g_statusHandle = nullptr;
SERVICE_STATUS g_status = {};
HANDLE g_stopEvent = nullptr;

int wmain() {
    // Table of services in this executable
    SERVICE_TABLE_ENTRYW serviceTable[] = {
        { const_cast<LPWSTR>(L"MyHeartbeatService"), ServiceMain },
        { nullptr, nullptr }  // Terminator
    };

    // This blocks until all services in the table stop
    if (!StartServiceCtrlDispatcherW(serviceTable)) {
        printf("StartServiceCtrlDispatcher failed: %lu\n", GetLastError());
        return 1;
    }

    return 0;
}
```

### Step 2: ServiceMain — Where Your Service Starts

```cpp
void WINAPI ServiceMain(DWORD argc, LPWSTR* argv) {
    // 1. Register the control handler
    g_statusHandle = RegisterServiceCtrlHandlerExW(
        L"MyHeartbeatService",
        ServiceHandler,
        nullptr
    );

    if (!g_statusHandle) return;

    // 2. Tell SCM we're starting
    g_status.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
    g_status.dwCurrentState = SERVICE_START_PENDING;
    g_status.dwControlsAccepted = 0;  // Don't accept controls yet
    SetServiceStatus(g_statusHandle, &g_status);

    // 3. Initialize your service (open files, connect to DB, etc.)
    g_stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!g_stopEvent) {
        g_status.dwCurrentState = SERVICE_STOPPED;
        g_status.dwWin32ExitCode = GetLastError();
        SetServiceStatus(g_statusHandle, &g_status);
        return;
    }

    // 4. Tell SCM we're running
    g_status.dwCurrentState = SERVICE_RUNNING;
    g_status.dwControlsAccepted = SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN;
    SetServiceStatus(g_statusHandle, &g_status);

    // 5. Main service loop
    while (WaitForSingleObject(g_stopEvent, 5000) == WAIT_TIMEOUT) {
        // Do periodic work every 5 seconds
        // Example: write a heartbeat to the event log or a file
        OutputDebugStringW(L"Heartbeat!\n");
    }

    // 6. Cleanup and stop
    CloseHandle(g_stopEvent);
    g_status.dwCurrentState = SERVICE_STOPPED;
    g_status.dwWin32ExitCode = 0;
    SetServiceStatus(g_statusHandle, &g_status);
}
```

### Step 3: Control Handler

```cpp
DWORD WINAPI ServiceHandler(DWORD control, DWORD eventType,
                             LPVOID eventData, LPVOID context) {
    switch (control) {
        case SERVICE_CONTROL_STOP:
        case SERVICE_CONTROL_SHUTDOWN:
            // Tell SCM we're stopping
            g_status.dwCurrentState = SERVICE_STOP_PENDING;
            SetServiceStatus(g_statusHandle, &g_status);

            // Signal the main loop to exit
            SetEvent(g_stopEvent);
            return NO_ERROR;

        case SERVICE_CONTROL_INTERROGATE:
            // SCM is asking for our current status
            SetServiceStatus(g_statusHandle, &g_status);
            return NO_ERROR;

        default:
            return ERROR_CALL_NOT_IMPLEMENTED;
    }
}
```

---

## Installing and Managing Services

### Install Programmatically

```cpp
void installService(const wchar_t* exePath) {
    SC_HANDLE scm = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CREATE_SERVICE);
    if (!scm) {
        printf("Cannot open SCM: %lu\n", GetLastError());
        return;
    }

    SC_HANDLE svc = CreateServiceW(
        scm,
        L"MyHeartbeatService",     // Service name (internal)
        L"My Heartbeat Service",   // Display name
        SERVICE_ALL_ACCESS,
        SERVICE_WIN32_OWN_PROCESS,
        SERVICE_DEMAND_START,       // Manual start (or SERVICE_AUTO_START)
        SERVICE_ERROR_NORMAL,
        exePath,                    // Path to your .exe
        nullptr,                    // No load order group
        nullptr,                    // No tag
        nullptr,                    // No dependencies
        nullptr,                    // LocalSystem account
        nullptr                     // No password
    );

    if (!svc) {
        printf("CreateService failed: %lu\n", GetLastError());
    } else {
        printf("Service installed successfully!\n");
        CloseServiceHandle(svc);
    }

    CloseServiceHandle(scm);
}
```

### Using `sc.exe` (Command Line)

```cmd
:: Install
sc create MyService binPath= "C:\path\to\myservice.exe"

:: Start
sc start MyService

:: Query status
sc query MyService

:: Stop
sc stop MyService

:: Delete
sc delete MyService
```

### Using `services.msc` (GUI)

Open Run (Win+R) → type `services.msc` → find your service → right-click → Start/Stop/Properties.

---

## Event Logging

Services should log to the Windows Event Log instead of `printf`:

```cpp
#include <windows.h>

void logEvent(const wchar_t* message, WORD type = EVENTLOG_INFORMATION_TYPE) {
    HANDLE hLog = RegisterEventSourceW(nullptr, L"MyHeartbeatService");
    if (!hLog) return;

    const wchar_t* strings[] = { message };
    ReportEventW(
        hLog,
        type,                    // EVENTLOG_ERROR_TYPE, _WARNING_TYPE, _INFORMATION_TYPE
        0,                       // Category
        0,                       // Event ID
        nullptr,                 // Security ID
        1,                       // Number of strings
        0,                       // Raw data size
        strings,                 // String array
        nullptr                  // Raw data
    );

    DeregisterEventSource(hLog);
}

// Usage:
// logEvent(L"Service started successfully");
// logEvent(L"Failed to connect to database", EVENTLOG_ERROR_TYPE);
```

View logs in: **Event Viewer** → **Windows Logs** → **Application**

---

## Service Accounts

| Account | Privileges | Network Access |
|---------|-----------|---------------|
| `LocalSystem` | Full admin (most powerful) | Uses computer's identity |
| `LocalService` | Limited privileges | Anonymous network access |
| `NetworkService` | Limited privileges | Uses computer's identity |
| Custom user | Configurable | Configurable |

> Windows Update service (`wuauserv`) runs as **LocalSystem** because it needs to modify protected system files.

---

## Practical Exercises

1. **Heartbeat service**: Build the service above, install it, start it, verify it appears in `services.msc`.
2. **File watcher service**: A service that monitors a directory for changes and logs events.
3. **Service manager**: Write a program that lists all services and their status using `EnumServicesStatusEx`.
4. **Service controller**: Write a program that starts/stops a service by name using `StartService`/`ControlService`.

---

## Key Takeaways

- ✅ Services run in the background, managed by SCM
- ✅ `ServiceMain` is your entry point; `HandlerEx` handles stop/pause/etc.
- ✅ Always report status to SCM (`SetServiceStatus`)
- ✅ Use Event Log for service logging (not stdout)
- ✅ `sc.exe` for quick install/start/stop from command line
- ❌ Don't show UI from a service — services run in Session 0 (no desktop)
- ❌ Don't forget to signal `SERVICE_STOPPED` — SCM will think your service is hung

---

## Next Phase

→ [`../04-concurrency/`](../04-concurrency/) — Concurrency & Synchronization
