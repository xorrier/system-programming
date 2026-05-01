# Inter-Process Communication (IPC)

> **Phase 3 · Topic 3** | Estimated Time: 3 hours

---

## Why IPC?

Processes are **isolated** — they can't read each other's memory. But often processes need to communicate:
- A service sends status updates to a GUI
- A parent process captures output from a child
- Multiple workers process tasks from a shared queue

IPC provides mechanisms for processes to exchange data safely.

---

## Overview of IPC Mechanisms

| Mechanism | Direction | Speed | Across Network? | Best For |
|-----------|-----------|-------|-----------------|----------|
| **Anonymous Pipes** | One-way | Fast | ❌ | Parent-child stdout capture |
| **Named Pipes** | Two-way | Fast | ✅ (Windows) | Client-server communication |
| **Shared Memory** | Both read/write | ⚡ Fastest | ❌ | High-throughput data sharing |
| **Sockets** | Two-way | Medium | ✅ | Network communication |
| **Mailslots** | One-way | Medium | ✅ (Windows) | Broadcast messages |

---

## Anonymous Pipes

The simplest IPC: a one-way data channel, typically between parent and child processes.

### Win32: Capturing Child Process Output

```cpp
#include <windows.h>
#include <cstdio>
#include <string>

std::string captureProcessOutput(const wchar_t* cmdLine) {
    // 1. Create a pipe
    HANDLE hReadPipe, hWritePipe;
    SECURITY_ATTRIBUTES sa = {};
    sa.nLength = sizeof(sa);
    sa.bInheritHandle = TRUE;  // Child must inherit the write end

    if (!CreatePipe(&hReadPipe, &hWritePipe, &sa, 0)) {
        throw std::runtime_error("CreatePipe failed");
    }

    // Don't let the child inherit the read end
    SetHandleInformation(hReadPipe, HANDLE_FLAG_INHERIT, 0);

    // 2. Create child process with redirected stdout
    STARTUPINFOW si = {};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdOutput = hWritePipe;
    si.hStdError  = hWritePipe;

    PROCESS_INFORMATION pi = {};
    wchar_t cmd[512];
    wcscpy_s(cmd, cmdLine);

    CreateProcessW(nullptr, cmd, nullptr, nullptr, TRUE,
                   CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi);

    // Close write end in parent (child has its own copy)
    CloseHandle(hWritePipe);

    // 3. Read from pipe
    std::string output;
    char buffer[4096];
    DWORD bytesRead;

    while (ReadFile(hReadPipe, buffer, sizeof(buffer) - 1, &bytesRead, nullptr)
           && bytesRead > 0) {
        buffer[bytesRead] = '\0';
        output += buffer;
    }

    // 4. Cleanup
    WaitForSingleObject(pi.hProcess, INFINITE);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(hReadPipe);

    return output;
}
```

### POSIX: `pipe()` + `fork()`

```cpp
#include <unistd.h>
#include <sys/wait.h>
#include <cstdio>
#include <cstring>

void pipeExample() {
    int pipefd[2];  // [0] = read end, [1] = write end
    pipe(pipefd);

    pid_t pid = fork();

    if (pid == 0) {
        // CHILD: redirect stdout to pipe's write end
        close(pipefd[0]);          // Close unused read end
        dup2(pipefd[1], STDOUT_FILENO);  // stdout → pipe
        close(pipefd[1]);

        execlp("ls", "ls", "-la", nullptr);
        _exit(1);
    } else {
        // PARENT: read from pipe
        close(pipefd[1]);  // Close unused write end

        char buffer[4096];
        ssize_t n;
        while ((n = read(pipefd[0], buffer, sizeof(buffer) - 1)) > 0) {
            buffer[n] = '\0';
            printf("Got: %s", buffer);
        }

        close(pipefd[0]);
        waitpid(pid, nullptr, 0);
    }
}
```

---

## Named Pipes

Named pipes have a name in the filesystem (POSIX) or namespace (Windows), so **unrelated processes** can connect.

### Win32 Named Pipe Server

```cpp
#include <windows.h>
#include <cstdio>

void namedPipeServer() {
    // 1. Create the named pipe
    HANDLE hPipe = CreateNamedPipeW(
        L"\\\\.\\pipe\\MyAppPipe",   // Pipe name (\\.\pipe\Name format)
        PIPE_ACCESS_DUPLEX,          // Two-way communication
        PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
        1,                           // Max instances
        512, 512,                    // Output/input buffer sizes
        0,                           // Default timeout
        nullptr                      // Default security
    );

    if (hPipe == INVALID_HANDLE_VALUE) {
        printf("CreateNamedPipe failed: %lu\n", GetLastError());
        return;
    }

    printf("Waiting for client...\n");

    // 2. Wait for a client to connect
    ConnectNamedPipe(hPipe, nullptr);
    printf("Client connected!\n");

    // 3. Read message from client
    char buffer[512];
    DWORD bytesRead;
    ReadFile(hPipe, buffer, sizeof(buffer) - 1, &bytesRead, nullptr);
    buffer[bytesRead] = '\0';
    printf("Received: %s\n", buffer);

    // 4. Send response
    const char* response = "Hello from server!";
    DWORD bytesWritten;
    WriteFile(hPipe, response, strlen(response), &bytesWritten, nullptr);

    // 5. Cleanup
    DisconnectNamedPipe(hPipe);
    CloseHandle(hPipe);
}
```

### Win32 Named Pipe Client

```cpp
void namedPipeClient() {
    // Connect to the named pipe
    HANDLE hPipe = CreateFileW(
        L"\\\\.\\pipe\\MyAppPipe",
        GENERIC_READ | GENERIC_WRITE,
        0, nullptr,
        OPEN_EXISTING, 0, nullptr
    );

    if (hPipe == INVALID_HANDLE_VALUE) {
        printf("Cannot connect to pipe: %lu\n", GetLastError());
        return;
    }

    // Send message
    const char* msg = "Hello from client!";
    DWORD bytesWritten;
    WriteFile(hPipe, msg, strlen(msg), &bytesWritten, nullptr);

    // Read response
    char buffer[512];
    DWORD bytesRead;
    ReadFile(hPipe, buffer, sizeof(buffer) - 1, &bytesRead, nullptr);
    buffer[bytesRead] = '\0';
    printf("Server says: %s\n", buffer);

    CloseHandle(hPipe);
}
```

---

## Shared Memory

The **fastest IPC** — both processes directly read/write the same physical memory.

### Win32: `CreateFileMapping` (Named)

```cpp
// PRODUCER process
void sharedMemoryProducer() {
    // Create a named file mapping (backed by pagefile, not a file)
    HANDLE hMap = CreateFileMappingW(
        INVALID_HANDLE_VALUE,   // Pagefile-backed (not a real file)
        nullptr,
        PAGE_READWRITE,
        0, 4096,                // 4 KB
        L"MySharedMemory"       // Name (other processes use this!)
    );

    void* ptr = MapViewOfFile(hMap, FILE_MAP_ALL_ACCESS, 0, 0, 4096);

    // Write data
    strcpy_s(static_cast<char*>(ptr), 4096, "Hello from producer!");
    printf("Data written. Press Enter to exit...\n");
    getchar();

    UnmapViewOfFile(ptr);
    CloseHandle(hMap);
}

// CONSUMER process
void sharedMemoryConsumer() {
    // Open the existing named mapping
    HANDLE hMap = OpenFileMappingW(FILE_MAP_READ, FALSE, L"MySharedMemory");
    if (!hMap) {
        printf("Cannot open shared memory: %lu\n", GetLastError());
        return;
    }

    void* ptr = MapViewOfFile(hMap, FILE_MAP_READ, 0, 0, 4096);

    printf("Read from shared memory: %s\n", static_cast<char*>(ptr));

    UnmapViewOfFile(ptr);
    CloseHandle(hMap);
}
```

### POSIX: `shm_open` + `mmap`

```cpp
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstring>
#include <cstdio>

// Producer
void shmProducer() {
    int fd = shm_open("/myshm", O_CREAT | O_RDWR, 0666);
    ftruncate(fd, 4096);

    void* ptr = mmap(nullptr, 4096, PROT_WRITE, MAP_SHARED, fd, 0);
    strcpy(static_cast<char*>(ptr), "Hello from POSIX producer!");

    printf("Written. Press Enter...\n");
    getchar();

    munmap(ptr, 4096);
    close(fd);
    shm_unlink("/myshm");
}

// Consumer
void shmConsumer() {
    int fd = shm_open("/myshm", O_RDONLY, 0666);
    void* ptr = mmap(nullptr, 4096, PROT_READ, MAP_SHARED, fd, 0);

    printf("Read: %s\n", static_cast<char*>(ptr));

    munmap(ptr, 4096);
    close(fd);
}
```

> ⚠️ Shared memory has **no built-in synchronization**. You need a mutex or semaphore to coordinate access.

---

## Sockets (Local IPC)

Sockets can be used for local IPC (not just networking):

```cpp
// On Windows, use localhost TCP sockets or AF_UNIX (Windows 10+)
// On Linux/macOS, use Unix domain sockets

#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

void unixSocketServer() {
    int server = socket(AF_UNIX, SOCK_STREAM, 0);

    struct sockaddr_un addr = {};
    addr.sun_family = AF_UNIX;
    strcpy(addr.sun_path, "/tmp/myapp.sock");
    unlink(addr.sun_path);

    bind(server, (struct sockaddr*)&addr, sizeof(addr));
    listen(server, 1);

    int client = accept(server, nullptr, nullptr);

    char buf[256];
    ssize_t n = read(client, buf, sizeof(buf) - 1);
    buf[n] = '\0';
    printf("Received: %s\n", buf);

    close(client);
    close(server);
    unlink(addr.sun_path);
}
```

---

## Choosing the Right IPC

| Need | Best IPC |
|------|----------|
| Capture child process output | Anonymous pipe |
| Client-server (same machine) | Named pipe |
| High-speed data sharing | Shared memory + mutex |
| Network communication | Sockets |
| Broadcast notifications (Windows) | Mailslots |

---

## Practical Exercises

1. **Output capturer**: Launch `dir` (Windows) or `ls` (POSIX) and capture its output into a string using anonymous pipes.
2. **Chat system**: Build a named pipe server and client that send messages back and forth.
3. **Shared counter**: Two processes share a counter via shared memory, coordinated by a named mutex.
4. **Process ping-pong**: Two processes pass a value back and forth via named pipes, incrementing it each time.

---

## Key Takeaways

- ✅ Anonymous pipes for parent-child communication
- ✅ Named pipes for client-server IPC (works across the network on Windows)
- ✅ Shared memory is fastest but needs synchronization
- ✅ Sockets are the most flexible (work across networks)
- ❌ Don't use shared memory without a mutex — data races!
- ❌ Don't forget to close pipe handles in the parent after forking

---

## Next

→ [`04-windows-registry.md`](./04-windows-registry.md) — Windows Registry APIs
