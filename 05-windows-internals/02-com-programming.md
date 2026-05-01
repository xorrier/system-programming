# COM Programming & Windows Update API

> **Phase 5 · Topic 2** | Estimated Time: 4 hours

---

## What Is COM?

**Component Object Model (COM)** is Microsoft's binary standard for creating reusable software components. Almost every Windows API uses COM:
- Windows Update API
- DirectX
- Shell extensions
- WMI
- Office automation

COM lets you use objects **without knowing their implementation** — you only work through **interfaces** (pure virtual classes).

---

## Core COM Concepts

### Interfaces

A COM interface is a contract — a set of methods. Every COM interface inherits from `IUnknown`:

```cpp
// IUnknown — the base of ALL COM interfaces
class IUnknown {
public:
    virtual HRESULT QueryInterface(REFIID riid, void** ppv) = 0;  // Get another interface
    virtual ULONG   AddRef() = 0;   // Increment reference count
    virtual ULONG   Release() = 0;  // Decrement reference count (destroy at 0)
};
```

### GUIDs, CLSIDs, and IIDs

COM uses **Globally Unique Identifiers** to identify classes and interfaces:

| Term | Meaning | Example |
|------|---------|---------|
| **GUID** | 128-bit unique identifier | `{12345678-ABCD-EF01-...}` |
| **CLSID** | Class ID — identifies a COM class | CLSID_UpdateSession |
| **IID** | Interface ID — identifies a COM interface | IID_IUpdateSession |

### Reference Counting

COM objects are **reference counted**. You must:
- Call `AddRef()` when copying a pointer
- Call `Release()` when you're done with it
- When the count reaches 0, the object destroys itself

```cpp
// ❌ BAD — manual reference counting is error-prone
IUpdateSession* session = nullptr;
CoCreateInstance(CLSID_UpdateSession, nullptr, CLSCTX_INPROC_SERVER,
                IID_IUpdateSession, (void**)&session);
// ... use session ...
session->Release();  // Must not forget!

// ✅ GOOD — use smart COM pointers (covered below)
```

---

## COM Initialization

Before using any COM APIs, you must initialize COM on the current thread:

```cpp
#include <objbase.h>  // CoInitializeEx

int main() {
    // Initialize COM (apartment-threaded)
    HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(hr)) {
        printf("CoInitializeEx failed: 0x%08lX\n", hr);
        return 1;
    }

    // ... use COM APIs here ...

    CoUninitialize();  // Clean up (must match CoInitializeEx)
    return 0;
}
```

### Threading Models

| Model | Constant | Meaning |
|-------|----------|---------|
| STA (Single-Threaded Apartment) | `COINIT_APARTMENTTHREADED` | COM objects accessed from one thread |
| MTA (Multi-Threaded Apartment) | `COINIT_MULTITHREADED` | COM objects accessed from any thread |

> For WUA APIs, use `COINIT_APARTMENTTHREADED`.

---

## Creating COM Objects

```cpp
#include <comutil.h>  // Or <wuapi.h> for WUA

// CoCreateInstance — the standard way to create a COM object
IUpdateSession* session = nullptr;
HRESULT hr = CoCreateInstance(
    CLSID_UpdateSession,     // Which class to create
    nullptr,                  // Outer (for aggregation, usually nullptr)
    CLSCTX_INPROC_SERVER,   // In-process (DLL) server
    IID_IUpdateSession,      // Which interface we want
    (void**)&session         // Output pointer
);

if (SUCCEEDED(hr)) {
    // Use session...
    session->Release();
}
```

---

## Smart COM Pointers

Manually calling `AddRef`/`Release` is error-prone. Use smart pointers instead:

### `Microsoft::WRL::ComPtr` (Modern — Recommended)

```cpp
#include <wrl/client.h>
using Microsoft::WRL::ComPtr;

void wrlExample() {
    ComPtr<IUpdateSession> session;

    HRESULT hr = CoCreateInstance(
        CLSID_UpdateSession, nullptr, CLSCTX_INPROC_SERVER,
        IID_PPV_ARGS(&session)   // Macro: extracts IID from type
    );

    if (SUCCEEDED(hr)) {
        // Use session directly — no manual Release needed!
        ComPtr<IUpdateSearcher> searcher;
        session->CreateUpdateSearcher(&searcher);
    }
    // session and searcher auto-released when ComPtr goes out of scope
}
```

### `CComPtr` (ATL — Legacy but Common)

```cpp
#include <atlbase.h>

void atlExample() {
    CComPtr<IUpdateSession> session;

    HRESULT hr = session.CoCreateInstance(CLSID_UpdateSession);
    if (SUCCEEDED(hr)) {
        CComPtr<IUpdateSearcher> searcher;
        session->CreateUpdateSearcher(&searcher);
    }
    // Auto-released
}
```

---

## Windows Update API (WUA)

The WUA COM API lets you programmatically search for, download, and install updates.

### Architecture

```
IUpdateSession
├── CreateUpdateSearcher() → IUpdateSearcher
│   └── Search() → ISearchResult
│       └── Updates → IUpdateCollection
│           └── Item(i) → IUpdate (title, KB, severity)
├── CreateUpdateDownloader() → IUpdateDownloader
│   └── Download() → IDownloadResult
└── CreateUpdateInstaller() → IUpdateInstaller
    └── Install() → IInstallationResult
```

### Listing Available Updates

```cpp
#include <windows.h>
#include <wuapi.h>
#include <wrl/client.h>
#include <cstdio>

#pragma comment(lib, "wuguid.lib")

using Microsoft::WRL::ComPtr;

void listAvailableUpdates() {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    // 1. Create update session
    ComPtr<IUpdateSession> session;
    CoCreateInstance(CLSID_UpdateSession, nullptr, CLSCTX_INPROC_SERVER,
                    IID_PPV_ARGS(&session));

    // 2. Create searcher
    ComPtr<IUpdateSearcher> searcher;
    session->CreateUpdateSearcher(&searcher);

    // 3. Search for updates
    ComPtr<ISearchResult> result;
    BSTR criteria = SysAllocString(L"IsInstalled=0");  // Not yet installed
    HRESULT hr = searcher->Search(criteria, &result);
    SysFreeString(criteria);

    if (FAILED(hr)) {
        printf("Search failed: 0x%08lX\n", hr);
        CoUninitialize();
        return;
    }

    // 4. Enumerate results
    ComPtr<IUpdateCollection> updates;
    result->get_Updates(&updates);

    LONG count;
    updates->get_Count(&count);
    printf("Found %ld available updates:\n\n", count);

    for (LONG i = 0; i < count; ++i) {
        ComPtr<IUpdate> update;
        updates->get_Item(i, &update);

        BSTR title;
        update->get_Title(&title);
        wprintf(L"  [%ld] %s\n", i + 1, title);
        SysFreeString(title);

        // Get KB article IDs
        ComPtr<IStringCollection> kbIDs;
        update->get_KBArticleIDs(&kbIDs);

        LONG kbCount;
        kbIDs->get_Count(&kbCount);
        for (LONG k = 0; k < kbCount; ++k) {
            BSTR kb;
            kbIDs->get_Item(k, &kb);
            wprintf(L"       KB%s\n", kb);
            SysFreeString(kb);
        }
    }

    CoUninitialize();
}
```

### Listing Installed Updates (Update History)

```cpp
void listUpdateHistory() {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    ComPtr<IUpdateSession> session;
    CoCreateInstance(CLSID_UpdateSession, nullptr, CLSCTX_INPROC_SERVER,
                    IID_PPV_ARGS(&session));

    ComPtr<IUpdateSearcher> searcher;
    session->CreateUpdateSearcher(&searcher);

    // Get total history count
    LONG totalCount;
    searcher->GetTotalHistoryCount(&totalCount);

    // Get history entries
    ComPtr<IUpdateHistoryEntryCollection> history;
    searcher->QueryHistory(0, totalCount, &history);

    LONG count;
    history->get_Count(&count);
    printf("Update history (%ld entries):\n\n", count);

    for (LONG i = 0; i < count && i < 20; ++i) {  // First 20
        ComPtr<IUpdateHistoryEntry> entry;
        history->get_Item(i, &entry);

        BSTR title;
        entry->get_Title(&title);

        DATE date;
        entry->get_Date(&date);

        OperationResultCode resultCode;
        entry->get_ResultCode(&resultCode);

        const wchar_t* status = L"???";
        switch (resultCode) {
            case orcSucceeded: status = L"✅ Success"; break;
            case orcFailed:    status = L"❌ Failed";  break;
            case orcAborted:   status = L"⚠️ Aborted"; break;
        }

        wprintf(L"  %s — %s\n", status, title);
        SysFreeString(title);
    }

    CoUninitialize();
}
```

---

## BSTR — COM Strings

COM uses `BSTR` (Basic String) — a length-prefixed, `wchar_t*` string:

```cpp
// Allocate
BSTR str = SysAllocString(L"Hello COM");

// Use (compatible with wchar_t*)
wprintf(L"%s\n", str);

// Get length
UINT len = SysStringLen(str);

// Free — MUST free every BSTR!
SysFreeString(str);

// RAII wrapper: _bstr_t (from comutil.h)
#include <comutil.h>
_bstr_t autoStr(L"Auto-freed string");  // Freed in destructor
```

---

## Practical Exercises

1. **Update lister**: Use WUA COM API to list all available (not installed) updates with their KB numbers.
2. **Update history**: Query and display the last 20 installed updates with status.
3. **COM explorer**: Create an `IUpdateSession`, call `QueryInterface` for `IUnknown`, verify it works.
4. **BSTR practice**: Allocate, manipulate, and free BSTRs. Build an RAII wrapper for `BSTR`.

---

## Key Takeaways

- ✅ COM = interface-based, reference-counted object model
- ✅ Always call `CoInitializeEx` before using COM, `CoUninitialize` after
- ✅ Use `ComPtr` (WRL) or `CComPtr` (ATL) — never manual `AddRef`/`Release`
- ✅ WUA API: `IUpdateSession` → `IUpdateSearcher` → `ISearchResult`
- ✅ Free every `BSTR` with `SysFreeString`, or use `_bstr_t`
- ❌ Don't mix `COINIT_APARTMENTTHREADED` and `COINIT_MULTITHREADED` on the same thread
- ❌ Don't forget to check `HRESULT` — COM functions don't throw exceptions

---

## Next

→ [`03-error-handling.md`](./03-error-handling.md) — HRESULT, GetLastError, and SEH
