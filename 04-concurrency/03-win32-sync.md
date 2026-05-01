# Win32 Synchronization Primitives

> **Phase 4 · Topic 3** | Estimated Time: 3 hours

---

## Why Win32 Sync Primitives?

C++ standard library gives you `std::mutex` and `std::condition_variable`, but on Windows you'll encounter Win32 sync primitives everywhere:
- Legacy codebases use `CRITICAL_SECTION`
- Win32 `Event` objects enable cross-process signaling
- `SRWLOCK` is the fastest lock on Windows
- `WaitForMultipleObjects` has no standard C++ equivalent

Understanding these is essential for reading and maintaining Windows system code.

---

## `CRITICAL_SECTION` — Lightweight Mutex

The most common synchronization primitive in Win32 code. It's a **user-mode only** lock (no kernel call unless contended), making it very fast.

```cpp
#include <windows.h>
#include <cstdio>

CRITICAL_SECTION cs;
int sharedCounter = 0;

DWORD WINAPI worker(LPVOID) {
    for (int i = 0; i < 100000; ++i) {
        EnterCriticalSection(&cs);
        sharedCounter++;
        LeaveCriticalSection(&cs);
    }
    return 0;
}

int main() {
    InitializeCriticalSection(&cs);

    HANDLE t1 = CreateThread(nullptr, 0, worker, nullptr, 0, nullptr);
    HANDLE t2 = CreateThread(nullptr, 0, worker, nullptr, 0, nullptr);

    WaitForSingleObject(t1, INFINITE);
    WaitForSingleObject(t2, INFINITE);

    CloseHandle(t1);
    CloseHandle(t2);
    DeleteCriticalSection(&cs);

    printf("Counter: %d\n", sharedCounter);  // 200000
}
```

### RAII Wrapper

```cpp
class CriticalSectionLock {
public:
    explicit CriticalSectionLock(CRITICAL_SECTION& cs) : cs_(cs) {
        EnterCriticalSection(&cs_);
    }
    ~CriticalSectionLock() {
        LeaveCriticalSection(&cs_);
    }
    CriticalSectionLock(const CriticalSectionLock&) = delete;
    CriticalSectionLock& operator=(const CriticalSectionLock&) = delete;
private:
    CRITICAL_SECTION& cs_;
};

// Usage:
// CriticalSectionLock lock(cs);
// sharedCounter++;
// // auto-unlocked when lock goes out of scope
```

### `TryEnterCriticalSection`

Non-blocking attempt to acquire:

```cpp
if (TryEnterCriticalSection(&cs)) {
    // Got the lock
    sharedCounter++;
    LeaveCriticalSection(&cs);
} else {
    // Lock is held by another thread — do something else
}
```

---

## `SRWLOCK` — Slim Reader/Writer Lock

The **fastest lock on Windows** (thinner than `CRITICAL_SECTION`). Supports two modes:

| Mode | Multiple holders? | Use for |
|------|-------------------|---------|
| **Shared (Read)** | ✅ Multiple readers | Reading shared data |
| **Exclusive (Write)** | ❌ Only one | Modifying shared data |

```cpp
#include <windows.h>
#include <cstdio>

SRWLOCK srwLock = SRWLOCK_INIT;  // No Init/Delete needed!
int sharedData = 0;

DWORD WINAPI reader(LPVOID) {
    AcquireSRWLockShared(&srwLock);    // Multiple readers OK
    printf("Read: %d\n", sharedData);
    ReleaseSRWLockShared(&srwLock);
    return 0;
}

DWORD WINAPI writer(LPVOID) {
    AcquireSRWLockExclusive(&srwLock);  // Only one writer
    sharedData = 42;
    printf("Wrote: %d\n", sharedData);
    ReleaseSRWLockExclusive(&srwLock);
    return 0;
}
```

### SRWLOCK vs CRITICAL_SECTION

| Feature | CRITICAL_SECTION | SRWLOCK |
|---------|-----------------|---------|
| Size | ~40 bytes | 8 bytes (a single pointer!) |
| Init/Delete | Required | Not needed (`SRWLOCK_INIT`) |
| Recursive locking | ✅ | ❌ |
| Read/write modes | ❌ | ✅ |
| Speed | Fast | ⚡ Fastest |

> **Recommendation**: Use `SRWLOCK` for new code unless you need recursive locking.

---

## Events — Thread Signaling

An **Event** is a kernel object that can be in two states: **signaled** or **non-signaled**. Threads can wait for an event to become signaled.

### Manual-Reset vs Auto-Reset

| Type | After `SetEvent()` + thread wakes up |
|------|--------------------------------------|
| **Manual-Reset** | Stays signaled (ALL waiting threads wake up) |
| **Auto-Reset** | Resets to non-signaled (ONE thread wakes up) |

```cpp
#include <windows.h>
#include <cstdio>

HANDLE hEvent;

DWORD WINAPI waitingThread(LPVOID param) {
    int id = (int)(intptr_t)param;
    printf("Thread %d: waiting...\n", id);

    WaitForSingleObject(hEvent, INFINITE);

    printf("Thread %d: event signaled!\n", id);
    return 0;
}

void eventExample() {
    // Manual-reset event, initially non-signaled
    hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    //                           ^manual ^initial  ^name

    HANDLE threads[3];
    for (int i = 0; i < 3; ++i) {
        threads[i] = CreateThread(nullptr, 0, waitingThread,
                                  (LPVOID)(intptr_t)i, 0, nullptr);
    }

    Sleep(1000);  // Let threads start waiting

    printf("Main: signaling event!\n");
    SetEvent(hEvent);   // Wake up ALL threads (manual-reset)

    WaitForMultipleObjects(3, threads, TRUE, INFINITE);

    // Reset for reuse
    ResetEvent(hEvent);

    for (auto h : threads) CloseHandle(h);
    CloseHandle(hEvent);
}
```

### Named Events (Cross-Process)

```cpp
// Process A: Create
HANDLE hEvent = CreateEventW(nullptr, FALSE, FALSE, L"MyAppEvent");

// Process B: Open
HANDLE hEvent = OpenEventW(EVENT_ALL_ACCESS, FALSE, L"MyAppEvent");

// Either process can signal:
SetEvent(hEvent);  // Wake up the other process's WaitForSingleObject
```

---

## Semaphores

A semaphore is a counter. `WaitForSingleObject` decrements it (blocks if 0), `ReleaseSemaphore` increments it. Used to limit concurrent access.

```cpp
// Allow max 3 threads to access a resource simultaneously
HANDLE hSemaphore = CreateSemaphoreW(
    nullptr,    // Security
    3,          // Initial count (3 available)
    3,          // Maximum count
    nullptr     // Name
);

DWORD WINAPI limitedWorker(LPVOID param) {
    int id = (int)(intptr_t)param;

    WaitForSingleObject(hSemaphore, INFINITE);  // Decrement (blocks if 0)
    printf("Thread %d: working (slot acquired)\n", id);
    Sleep(2000);
    printf("Thread %d: done\n", id);
    ReleaseSemaphore(hSemaphore, 1, nullptr);   // Increment

    return 0;
}
```

---

## `WaitForMultipleObjects` — Wait for Any/All

```cpp
HANDLE objects[] = { hThread1, hThread2, hEvent };

// Wait for ANY one
DWORD result = WaitForMultipleObjects(3, objects, FALSE, 5000);
switch (result) {
    case WAIT_OBJECT_0 + 0: printf("Thread 1 finished\n"); break;
    case WAIT_OBJECT_0 + 1: printf("Thread 2 finished\n"); break;
    case WAIT_OBJECT_0 + 2: printf("Event signaled\n"); break;
    case WAIT_TIMEOUT:      printf("Timed out\n"); break;
}

// Wait for ALL
DWORD result = WaitForMultipleObjects(3, objects, TRUE, INFINITE);
// Returns only when all three are signaled
```

---

## Condition Variable (Win32)

Windows also has condition variables (since Vista):

```cpp
SRWLOCK lock = SRWLOCK_INIT;
CONDITION_VARIABLE condVar;
bool dataReady = false;

DWORD WINAPI producer(LPVOID) {
    AcquireSRWLockExclusive(&lock);
    dataReady = true;
    ReleaseSRWLockExclusive(&lock);
    WakeConditionVariable(&condVar);  // Wake one waiter
    return 0;
}

DWORD WINAPI consumer(LPVOID) {
    AcquireSRWLockExclusive(&lock);
    while (!dataReady) {
        // Atomically releases lock + waits, re-acquires lock on wake
        SleepConditionVariableSRW(&condVar, &lock, INFINITE, 0);
    }
    printf("Data is ready!\n");
    ReleaseSRWLockExclusive(&lock);
    return 0;
}
```

---

## Win32 vs C++ Standard — Quick Reference

| Win32 | C++ Standard | Notes |
|-------|-------------|-------|
| `CRITICAL_SECTION` | `std::mutex` | CS is non-recursive by default |
| `SRWLOCK` | `std::shared_mutex` (C++17) | SRWLOCK is lighter |
| `CreateEvent` | `std::condition_variable` | Events are kernel objects (cross-process) |
| `CreateSemaphore` | `std::counting_semaphore` (C++20) | |
| `WaitForMultipleObjects` | No equivalent | Win32-only feature |

---

## Practical Exercises

1. **CRITICAL_SECTION vs SRWLOCK**: Benchmark both with 4 threads, 1M increments. Compare times.
2. **Event-based shutdown**: Create 4 worker threads that loop until a shutdown event is signaled.
3. **Semaphore pool**: Create 10 threads but only allow 3 to run simultaneously using a semaphore.
4. **Reader-writer demo**: Multiple reader threads and one writer thread using SRWLOCK.

---

## Key Takeaways

- ✅ `SRWLOCK` = fastest lock on Windows; use for new code
- ✅ `CRITICAL_SECTION` = common in legacy code; supports recursive locking
- ✅ Events = kernel objects for signaling (can be cross-process)
- ✅ Semaphores = limit concurrency to N threads
- ✅ `WaitForMultipleObjects` = wait for any/all of multiple objects
- ❌ Don't forget `DeleteCriticalSection` — but SRWLOCK needs no cleanup
- ❌ Don't use manual-reset events when you want one-thread-at-a-time wakeup

---

## Next

→ [`04-thread-patterns.md`](./04-thread-patterns.md) — Thread pools, IOCP, and concurrency patterns
