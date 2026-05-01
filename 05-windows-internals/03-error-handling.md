# Error Handling — HRESULT, GetLastError, SEH

> **Phase 5 · Topic 3** | Estimated Time: 2–3 hours

---

## Why Error Handling Matters

System programming has three completely different error systems, and you need to know all of them:

1. **`HRESULT`** — COM and modern Win32 APIs
2. **`GetLastError()`** — Classic Win32 APIs
3. **SEH** — CPU-level exceptions (access violations, divide by zero)

Using the wrong error-checking pattern for an API = silent bugs.

---

## HRESULT — The COM Error Code

An `HRESULT` is a 32-bit integer that encodes success or failure:

```
Bit layout (32 bits total):
┌─┬─┬─┬─┬──────────────┬──────────────────────┐
│S│R│C│N│   Facility   │        Code          │
│1│1│1│1│   12 bits    │      16 bits         │
└─┴─┴─┴─┴──────────────┴──────────────────────┘

S = Severity (0 = Success, 1 = Failure)
R = Reserved
C = Customer flag (1 = customer-defined)
N = NTSTATUS mapped
```

### Checking HRESULT

```cpp
#include <windows.h>
#include <comdef.h>  // For _com_error

HRESULT hr = SomeComFunction();

// Method 1: Macros (most common)
if (SUCCEEDED(hr)) {
    printf("Success!\n");
}
if (FAILED(hr)) {
    printf("Failed: 0x%08lX\n", hr);
}

// Method 2: Check specific values
if (hr == S_OK) {
    // True success
} else if (hr == S_FALSE) {
    // Success but "no" (e.g., no more items)
}
```

### Common HRESULT Values

| HRESULT | Name | Meaning |
|---------|------|---------|
| `0x00000000` | `S_OK` | Success |
| `0x00000001` | `S_FALSE` | Success, but "false" result |
| `0x80004001` | `E_NOTIMPL` | Not implemented |
| `0x80004002` | `E_NOINTERFACE` | Interface not supported |
| `0x80004003` | `E_POINTER` | Invalid pointer |
| `0x80004005` | `E_FAIL` | Generic failure |
| `0x80070005` | `E_ACCESSDENIED` | Access denied |
| `0x80070057` | `E_INVALIDARG` | Invalid argument |
| `0x8007000E` | `E_OUTOFMEMORY` | Out of memory |
| `0x800f0922` | — | CBS store corruption |

### Decoding HRESULT to Human-Readable Message

```cpp
#include <windows.h>
#include <comdef.h>
#include <cstdio>

void printHresult(HRESULT hr) {
    // Method 1: _com_error (easiest)
    _com_error err(hr);
    wprintf(L"Error 0x%08lX: %s\n", hr, err.ErrorMessage());

    // Method 2: FormatMessage
    wchar_t* msg = nullptr;
    FormatMessageW(
        FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM,
        nullptr, hr, 0,
        (LPWSTR)&msg, 0, nullptr
    );
    if (msg) {
        wprintf(L"Error 0x%08lX: %s", hr, msg);
        LocalFree(msg);
    }
}
```

### HRESULT Helper: Check and Throw

```cpp
#include <stdexcept>
#include <comdef.h>
#include <string>

void throwIfFailed(HRESULT hr, const char* context = "") {
    if (FAILED(hr)) {
        _com_error err(hr);
        std::string msg = std::string(context) + ": " +
            std::string(CT2A(err.ErrorMessage()));
        throw std::runtime_error(msg);
    }
}

// Usage:
// throwIfFailed(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED), "CoInit");
// throwIfFailed(CoCreateInstance(...), "CreateInstance");
```

---

## GetLastError — Classic Win32 Error Handling

Most classic Win32 functions return a boolean or `HANDLE`. On failure, they set a **thread-local error code** accessible via `GetLastError()`.

```cpp
#include <windows.h>
#include <cstdio>

void getLastErrorExample() {
    // CreateFile returns INVALID_HANDLE_VALUE on failure
    HANDLE hFile = CreateFileW(
        L"nonexistent.txt", GENERIC_READ, 0, nullptr,
        OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr
    );

    if (hFile == INVALID_HANDLE_VALUE) {
        DWORD err = GetLastError();  // Must call IMMEDIATELY!
        printf("Error code: %lu\n", err);  // 2 = ERROR_FILE_NOT_FOUND

        // Convert to human-readable message
        wchar_t* msg = nullptr;
        FormatMessageW(
            FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM,
            nullptr, err, 0,
            (LPWSTR)&msg, 0, nullptr
        );
        if (msg) {
            wprintf(L"Message: %s", msg);  // "The system cannot find the file specified."
            LocalFree(msg);
        }
    }
}
```

### ⚠️ Critical Rule: Call GetLastError IMMEDIATELY

```cpp
// ❌ BAD — printf may change the error code!
HANDLE h = CreateFileW(...);
if (h == INVALID_HANDLE_VALUE) {
    printf("Failed!\n");          // This may call Win32 functions internally!
    DWORD err = GetLastError();   // May not be the error from CreateFile!
}

// ✅ GOOD — call GetLastError first
HANDLE h = CreateFileW(...);
if (h == INVALID_HANDLE_VALUE) {
    DWORD err = GetLastError();   // Get it NOW
    printf("Failed with error: %lu\n", err);
}
```

### Common Win32 Error Codes

| Code | Name | Meaning |
|------|------|---------|
| 0 | `ERROR_SUCCESS` | No error |
| 2 | `ERROR_FILE_NOT_FOUND` | File not found |
| 3 | `ERROR_PATH_NOT_FOUND` | Path not found |
| 5 | `ERROR_ACCESS_DENIED` | Access denied |
| 87 | `ERROR_INVALID_PARAMETER` | Invalid parameter |
| 183 | `ERROR_ALREADY_EXISTS` | Already exists |

### Converting Win32 Error to HRESULT

```cpp
// Win32 error code → HRESULT
HRESULT hr = HRESULT_FROM_WIN32(GetLastError());
// Example: ERROR_FILE_NOT_FOUND (2) → 0x80070002
```

---

## SEH — Structured Exception Handling

SEH handles **hardware exceptions** and **OS-level errors** that C++ exceptions can't:
- Access violations (null pointer dereference)
- Division by zero
- Stack overflow
- Breakpoint exceptions

### `__try` / `__except`

```cpp
#include <windows.h>
#include <cstdio>

void sehExample() {
    __try {
        int* p = nullptr;
        *p = 42;  // ACCESS VIOLATION!
    }
    __except (EXCEPTION_EXECUTE_HANDLER) {
        printf("Caught access violation!\n");
        printf("Exception code: 0x%08lX\n", GetExceptionCode());
    }
}
```

### Exception Filter

The `__except` block takes a filter expression:

| Filter Value | Meaning |
|-------------|---------|
| `EXCEPTION_EXECUTE_HANDLER` | Handle the exception (run the `__except` block) |
| `EXCEPTION_CONTINUE_SEARCH` | Don't handle; pass to outer handler |
| `EXCEPTION_CONTINUE_EXECUTION` | Resume at the faulting instruction |

```cpp
DWORD filterFunc(DWORD code) {
    if (code == EXCEPTION_ACCESS_VIOLATION) {
        return EXCEPTION_EXECUTE_HANDLER;  // Handle it
    }
    return EXCEPTION_CONTINUE_SEARCH;      // Let someone else handle it
}

void sehWithFilter() {
    __try {
        int* p = nullptr;
        *p = 42;
    }
    __except (filterFunc(GetExceptionCode())) {
        printf("Handled!\n");
    }
}
```

### `__try` / `__finally`

Guaranteed cleanup, even if an exception occurs:

```cpp
void sehFinally() {
    HANDLE hFile = INVALID_HANDLE_VALUE;

    __try {
        hFile = CreateFileW(L"test.txt", GENERIC_READ, 0, nullptr,
                           OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (hFile == INVALID_HANDLE_VALUE) return;

        // ... work with file ...
        // If ANYTHING goes wrong, __finally still runs
    }
    __finally {
        if (hFile != INVALID_HANDLE_VALUE) {
            CloseHandle(hFile);
            printf("File handle closed (cleanup)\n");
        }
    }
}
```

### SEH vs C++ Exceptions

| Feature | SEH (`__try`/`__except`) | C++ (`try`/`catch`) |
|---------|-------------------------|---------------------|
| Catches hardware exceptions | ✅ | ❌ (usually) |
| Works with C code | ✅ | ❌ |
| Stack unwinding | Partial | Full (destructors called) |
| Cross-function | ✅ | ✅ |
| Custom exception types | ❌ (only DWORD codes) | ✅ |

> ⚠️ **Don't mix SEH and C++ exceptions in the same function**. Use SEH for system-level code, C++ exceptions for application logic.

### Combining SEH and C++

```cpp
// Wrapper: convert SEH to C++ exception
void translateSEH() {
    __try {
        riskyWin32Code();
    }
    __except (EXCEPTION_EXECUTE_HANDLER) {
        throw std::runtime_error("SEH exception: " +
            std::to_string(GetExceptionCode()));
    }
}
```

---

## Best Practices

```cpp
// ✅ Always check HRESULT from COM functions
HRESULT hr = pSession->CreateUpdateSearcher(&pSearcher);
if (FAILED(hr)) {
    // Handle error
}

// ✅ Check return values from Win32 functions
HANDLE h = CreateFileW(...);
if (h == INVALID_HANDLE_VALUE) {
    DWORD err = GetLastError();
    // Handle error
}

// ✅ Use RAII to ensure cleanup
// FileHandle, ComPtr, lock_guard all handle cleanup automatically

// ❌ Don't ignore return values
CreateFileW(...);     // BAD — ignoring return!
CoCreateInstance(...); // BAD — ignoring HRESULT!
```

---

## Practical Exercises

1. **HRESULT decoder**: Write a program that takes an HRESULT hex code as input and prints the human-readable message.
2. **Error wrapper**: Create a `Win32Error` class that captures `GetLastError()`, formats the message, and can be thrown as a C++ exception.
3. **SEH catcher**: Write a program that intentionally causes an access violation, catches it with SEH, and continues running.
4. **Error logger**: Create a function that logs Win32 errors with timestamp, function name, and human-readable message.

---

## Key Takeaways

- ✅ `HRESULT`: `SUCCEEDED(hr)` / `FAILED(hr)` — never compare with `== TRUE`
- ✅ `GetLastError()`: Call **immediately** after the failing function
- ✅ SEH (`__try`/`__except`): For hardware exceptions (access violations)
- ✅ Use `FormatMessage` to get human-readable error strings
- ✅ `HRESULT_FROM_WIN32()` converts Win32 errors to HRESULT
- ❌ Don't mix SEH and C++ exceptions in the same function
- ❌ Don't ignore `HRESULT` — `S_FALSE` is NOT `S_OK`!

---

## Next

→ [`04-debugging-tools.md`](./04-debugging-tools.md) — WinDbg, Process Monitor, and ETW
