# Threads (OS-Level)

> **Phase 3 · Topic 2** | Estimated Time: 3 hours

---

## Process vs Thread

| Feature | Process | Thread |
|---------|---------|--------|
| Address space | Own (isolated) | **Shared** with other threads |
| Creation cost | Heavy | Light |
| Communication | IPC (pipes, sockets) | Direct memory access |
| Crash impact | Only that process | **Entire process** crashes |
| Stack | — | Each thread has **its own stack** |

A process starts with one thread (the **main thread**). You can create additional threads to do work in parallel.

```
Process (PID 1234)
┌──────────────────────────────┐
│  Code + Data + Heap (shared) │
│                              │
│  ┌────────┐ ┌────────┐      │
│  │Thread 1│ │Thread 2│      │
│  │(main)  │ │(worker)│      │
│  │Stack   │ │Stack   │      │
│  └────────┘ └────────┘      │
└──────────────────────────────┘
```

---

## Win32: `CreateThread`

```cpp
#include <windows.h>
#include <cstdio>

// Thread function — this is what the new thread executes
DWORD WINAPI workerThread(LPVOID param) {
    int id = *static_cast<int*>(param);
    printf("Thread %d running! (TID: %lu)\n", id, GetCurrentThreadId());

    // Simulate work
    Sleep(1000);

    printf("Thread %d done!\n", id);
    return 0;  // Exit code
}

void createThreadExample() {
    int threadId = 1;

    HANDLE hThread = CreateThread(
        nullptr,           // Default security
        0,                 // Default stack size
        workerThread,      // Thread function
        &threadId,         // Parameter passed to thread function
        0,                 // Start immediately (or CREATE_SUSPENDED)
        nullptr            // Optional: receive thread ID
    );

    if (!hThread) {
        printf("CreateThread failed: %lu\n", GetLastError());
        return;
    }

    printf("Main thread waiting for worker...\n");

    // Wait for the thread to finish
    WaitForSingleObject(hThread, INFINITE);

    // Get exit code
    DWORD exitCode;
    GetExitCodeThread(hThread, &exitCode);
    printf("Thread exit code: %lu\n", exitCode);

    CloseHandle(hThread);
}
```

### Multiple Threads

```cpp
void multipleThreads() {
    const int N = 4;
    HANDLE threads[N];
    int ids[N];

    // Create N threads
    for (int i = 0; i < N; ++i) {
        ids[i] = i;
        threads[i] = CreateThread(nullptr, 0, workerThread, &ids[i], 0, nullptr);
    }

    // Wait for ALL threads to finish
    WaitForMultipleObjects(N, threads, TRUE, INFINITE);
    //                         ^handles ^waitAll ^timeout

    // Cleanup
    for (int i = 0; i < N; ++i) {
        CloseHandle(threads[i]);
    }
    printf("All threads finished!\n");
}
```

---

## POSIX: `pthread_create`

```cpp
#include <pthread.h>
#include <cstdio>
#include <unistd.h>

// Thread function must return void* and take void*
void* workerThread(void* arg) {
    int id = *static_cast<int*>(arg);
    printf("Thread %d running! (TID: %lu)\n", id, pthread_self());

    sleep(1);

    printf("Thread %d done!\n", id);
    return nullptr;
}

void createPthread() {
    pthread_t thread;
    int threadId = 1;

    int err = pthread_create(
        &thread,       // Thread handle (output)
        nullptr,       // Default attributes
        workerThread,  // Thread function
        &threadId      // Argument
    );

    if (err != 0) {
        printf("pthread_create failed: %d\n", err);
        return;
    }

    // Wait for thread to finish (like WaitForSingleObject)
    pthread_join(thread, nullptr);
    printf("Thread joined!\n");
}
```

### Detached Threads

If you don't want to wait for a thread, **detach** it:

```cpp
pthread_t thread;
pthread_create(&thread, nullptr, workerThread, nullptr);
pthread_detach(thread);  // Thread runs independently
// Cannot join a detached thread
```

---

## Thread-Local Storage (TLS)

Each thread gets its own copy of a TLS variable:

```cpp
// C++11 thread_local keyword
thread_local int errorCode = 0;

void threadFunc() {
    errorCode = 42;  // Only this thread sees 42
}

// Win32 TLS API
DWORD tlsIndex = TlsAlloc();
TlsSetValue(tlsIndex, (LPVOID)42);
auto val = (int)(intptr_t)TlsGetValue(tlsIndex);
TlsFree(tlsIndex);
```

---

## Thread Safety Basics

When multiple threads access **shared data**, you need synchronization:

```cpp
#include <windows.h>
#include <cstdio>

int sharedCounter = 0;
CRITICAL_SECTION cs;

DWORD WINAPI incrementThread(LPVOID) {
    for (int i = 0; i < 100000; ++i) {
        EnterCriticalSection(&cs);  // Lock
        sharedCounter++;
        LeaveCriticalSection(&cs);  // Unlock
    }
    return 0;
}

void threadSafetyDemo() {
    InitializeCriticalSection(&cs);

    HANDLE t1 = CreateThread(nullptr, 0, incrementThread, nullptr, 0, nullptr);
    HANDLE t2 = CreateThread(nullptr, 0, incrementThread, nullptr, 0, nullptr);

    WaitForSingleObject(t1, INFINITE);
    WaitForSingleObject(t2, INFINITE);

    CloseHandle(t1);
    CloseHandle(t2);
    DeleteCriticalSection(&cs);

    printf("Counter: %d (expected 200000)\n", sharedCounter);
}
```

Without the `CRITICAL_SECTION`, the counter would be **less than 200000** due to **data races**.

---

## Common Pitfalls

### Passing Local Variables to Threads

```cpp
// ❌ BAD — local variable may be destroyed before thread reads it
void bad() {
    int id = 42;
    CreateThread(nullptr, 0, workerThread, &id, 0, nullptr);
    // Function returns → id destroyed → thread reads garbage!
}

// ✅ GOOD — allocate on heap or use thread-safe techniques
void good() {
    int* id = new int(42);
    CreateThread(nullptr, 0, [](LPVOID p) -> DWORD {
        int* pid = static_cast<int*>(p);
        printf("ID: %d\n", *pid);
        delete pid;
        return 0;
    }, id, 0, nullptr);
}
```

### Forgetting to Close Handles

```cpp
// ❌ BAD — handle leak
HANDLE h = CreateThread(...);
WaitForSingleObject(h, INFINITE);
// Missing CloseHandle(h)!

// ✅ GOOD — always close
CloseHandle(h);
```

---

## `WaitForSingleObject` and `WaitForMultipleObjects`

These are the fundamental waiting functions in Win32:

```cpp
// Wait for one object
DWORD result = WaitForSingleObject(hThread, 5000);  // 5 second timeout
switch (result) {
    case WAIT_OBJECT_0:  printf("Thread finished\n"); break;
    case WAIT_TIMEOUT:   printf("Timed out!\n"); break;
    case WAIT_FAILED:    printf("Error: %lu\n", GetLastError()); break;
}

// Wait for multiple objects
HANDLE handles[] = {hThread1, hThread2, hEvent};
DWORD result = WaitForMultipleObjects(
    3,       // Count
    handles, // Array
    FALSE,   // FALSE = any one; TRUE = wait for all
    INFINITE
);
// result tells you WHICH object was signaled:
// WAIT_OBJECT_0 + 0 = handles[0]
// WAIT_OBJECT_0 + 1 = handles[1]
// etc.
```

---

## Practical Exercises

1. **Thread spawner**: Create 8 threads, each prints its thread ID and a sequence number.
2. **Race condition demo**: Increment a shared counter from two threads WITHOUT a lock. Show the incorrect result. Then fix with `CRITICAL_SECTION`.
3. **Thread-safe logger**: Multiple threads write log messages; use a mutex to ensure lines don't interleave.
4. **Parallel file reader**: Read 4 files simultaneously, each in its own thread.

---

## Key Takeaways

- ✅ Threads share address space; processes don't
- ✅ Win32: `CreateThread` → `WaitForSingleObject` → `CloseHandle`
- ✅ POSIX: `pthread_create` → `pthread_join`
- ✅ Shared data needs synchronization (mutex/CRITICAL_SECTION)
- ✅ Use `thread_local` for per-thread variables
- ❌ Don't pass stack variables to threads — they may be gone
- ❌ Don't forget `CloseHandle` — thread handles leak too

---

## Next

→ [`03-ipc.md`](./03-ipc.md) — Inter-Process Communication (pipes, shared memory, sockets)
