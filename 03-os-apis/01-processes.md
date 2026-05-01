# Processes

> **Phase 3 · Topic 1** | Estimated Time: 3 hours

---

## What Is a Process?

A **process** is a running instance of a program. It has:
- Its own **virtual address space** (code, data, heap, stack)
- A **Process ID (PID)** — a unique number assigned by the OS
- One or more **threads** executing code
- **Handles** to open files, mutexes, pipes, etc.
- An **environment** (variables like `PATH`)

```
Program (on disk)          Process (in memory)
┌──────────────┐           ┌──────────────────┐
│  myapp.exe   │ ──Run──→  │ PID: 1234        │
│  (PE file)   │           │ Code (.text)     │
└──────────────┘           │ Data (.data)     │
                           │ Heap             │
                           │ Stack (Thread 1) │
                           │ Open handles     │
                           └──────────────────┘
```

---

## Win32: `CreateProcess`

The main way to launch a process on Windows:

```cpp
#include <windows.h>
#include <cstdio>

void launchNotepad() {
    STARTUPINFOW si = {};
    si.cb = sizeof(si);

    PROCESS_INFORMATION pi = {};

    // CreateProcessW(applicationName, commandLine, ...)
    BOOL ok = CreateProcessW(
        nullptr,                    // Application name (nullptr = use cmdLine)
        L"notepad.exe C:\\temp\\log.txt",  // Command line
        nullptr,                    // Process security attributes
        nullptr,                    // Thread security attributes
        FALSE,                      // Don't inherit handles
        0,                          // Creation flags
        nullptr,                    // Use parent's environment
        nullptr,                    // Use parent's working directory
        &si,                        // STARTUPINFO
        &pi                         // PROCESS_INFORMATION (output)
    );

    if (!ok) {
        printf("CreateProcess failed: %lu\n", GetLastError());
        return;
    }

    printf("Started process PID: %lu\n", pi.dwProcessId);
    printf("Thread ID: %lu\n", pi.dwThreadId);

    // Wait for the process to finish
    WaitForSingleObject(pi.hProcess, INFINITE);

    // Get exit code
    DWORD exitCode;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    printf("Exit code: %lu\n", exitCode);

    // MUST close handles!
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
}
```

### `STARTUPINFO` — Controlling the New Process

```cpp
STARTUPINFOW si = {};
si.cb = sizeof(si);

// Hide the window
si.dwFlags = STARTF_USESHOWWINDOW;
si.wShowWindow = SW_HIDE;

// Redirect stdout to a pipe (covered in IPC chapter)
si.dwFlags |= STARTF_USESTDHANDLES;
si.hStdOutput = hWritePipe;
si.hStdError  = hWritePipe;
```

### Creation Flags

| Flag | Meaning |
|------|---------|
| `0` | Normal creation |
| `CREATE_NEW_CONSOLE` | New console window |
| `CREATE_NO_WINDOW` | No window at all (for background processes) |
| `CREATE_SUSPENDED` | Start suspended (must call `ResumeThread`) |
| `DETACHED_PROCESS` | No console at all |

---

## POSIX: `fork()` + `exec()`

On Linux/macOS, process creation is a two-step dance:

### `fork()` — Clone the Current Process

```cpp
#include <unistd.h>
#include <sys/wait.h>
#include <cstdio>

void forkExample() {
    pid_t pid = fork();

    if (pid < 0) {
        // Error
        perror("fork failed");
    } else if (pid == 0) {
        // CHILD process — this is the clone
        printf("I am the child! PID: %d\n", getpid());
        printf("My parent is: %d\n", getppid());
        _exit(0);  // Exit child
    } else {
        // PARENT process — pid = child's PID
        printf("I am the parent! PID: %d\n", getpid());
        printf("Child PID: %d\n", pid);

        int status;
        waitpid(pid, &status, 0);  // Wait for child to finish

        if (WIFEXITED(status)) {
            printf("Child exited with code: %d\n", WEXITSTATUS(status));
        }
    }
}
```

### `exec()` — Replace the Process with a New Program

```cpp
#include <unistd.h>
#include <cstdio>

void execExample() {
    pid_t pid = fork();

    if (pid == 0) {
        // Child: replace ourselves with "ls -la"
        execlp("ls", "ls", "-la", "/tmp", nullptr);

        // If exec returns, it failed
        perror("exec failed");
        _exit(1);
    } else {
        int status;
        waitpid(pid, &status, 0);
    }
}
```

### The `exec` Family

| Function | Args Format | Search PATH? |
|----------|-------------|-------------|
| `execl` | Variadic list | ❌ |
| `execlp` | Variadic list | ✅ |
| `execv` | Array | ❌ |
| `execvp` | Array | ✅ |
| `execve` | Array + environment | ❌ |

```cpp
// execv version — pass args as array
const char* args[] = {"ls", "-la", "/tmp", nullptr};
execvp("ls", const_cast<char**>(args));
```

---

## Environment Variables

```cpp
// Reading environment variables (cross-platform)
#include <cstdlib>

const char* path = getenv("PATH");
if (path) printf("PATH: %s\n", path);

// Setting (POSIX)
setenv("MY_VAR", "hello", 1);  // 1 = overwrite if exists

// Win32
SetEnvironmentVariableW(L"MY_VAR", L"hello");

// Reading (Win32)
wchar_t buf[256];
GetEnvironmentVariableW(L"PATH", buf, 256);
```

---

## Process Enumeration (Win32)

List all running processes:

```cpp
#include <windows.h>
#include <tlhelp32.h>
#include <cstdio>

void listProcesses() {
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE) return;

    PROCESSENTRY32W pe = {};
    pe.dwSize = sizeof(pe);

    if (Process32FirstW(snapshot, &pe)) {
        do {
            wprintf(L"PID: %5lu  Threads: %2lu  %s\n",
                    pe.th32ProcessID,
                    pe.cntThreads,
                    pe.szExeFile);
        } while (Process32NextW(snapshot, &pe));
    }

    CloseHandle(snapshot);
}
```

---

## RAII Wrapper for Process Handles

```cpp
class ProcessHandle {
public:
    explicit ProcessHandle(HANDLE h) : handle_(h) {}
    ~ProcessHandle() { if (handle_) CloseHandle(handle_); }

    ProcessHandle(const ProcessHandle&) = delete;
    ProcessHandle& operator=(const ProcessHandle&) = delete;

    ProcessHandle(ProcessHandle&& o) noexcept : handle_(o.handle_) { o.handle_ = nullptr; }

    HANDLE get() const { return handle_; }

    DWORD wait(DWORD ms = INFINITE) {
        return WaitForSingleObject(handle_, ms);
    }

    DWORD exitCode() {
        DWORD code;
        GetExitCodeProcess(handle_, &code);
        return code;
    }

private:
    HANDLE handle_;
};
```

---

## Practical Exercises

1. **Process launcher**: Write a program that takes a command line as argument, runs it with `CreateProcess`, waits for it, and prints the exit code.
2. **Process lister**: Use `CreateToolhelp32Snapshot` to list all running processes with PID and name.
3. **Fork experiment** (Linux): Fork 5 child processes, each prints its PID, parent waits for all.
4. **Environment dumper**: Print all environment variables of the current process.

---

## Key Takeaways

- ✅ A process = running program with its own address space
- ✅ Win32: `CreateProcess` → `WaitForSingleObject` → `CloseHandle`
- ✅ POSIX: `fork()` (clone) + `exec()` (replace)
- ✅ Always close process and thread handles on Windows
- ✅ `CreateToolhelp32Snapshot` to enumerate running processes
- ❌ Don't forget `WaitForSingleObject` + `CloseHandle` — leaked process handles waste kernel resources
- ❌ Don't forget `waitpid` — zombie processes on Linux waste PIDs

---

## Next

→ [`02-threads.md`](./02-threads.md) — Threads with pthreads and Win32
