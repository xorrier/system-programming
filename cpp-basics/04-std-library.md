# `std::` Namespace & Standard Library

`std::` is a **namespace prefix**. Everything in the C++ Standard Library lives inside the `std` namespace to avoid name collisions with your own code.

---

## What is a Namespace?

```cpp
namespace myapp {
    int value = 42;
    void run() {}
}

namespace thirdparty {
    int value = 99;        // same name — no conflict because different namespace
    void run() {}
}

myapp::value        // 42
thirdparty::value   // 99
```

`std::` means "from the standard library namespace". So `std::string` means "the `string` type that lives in the `std` namespace".

### `using namespace std;` — Why You Should Avoid It

```cpp
using namespace std;    // dumps ALL of std into global scope

string s = "hello";     // works — but pollutes the namespace
vector<int> v;          // works

// Problem: if you also have your own 'sort' function, which one runs?
sort(v.begin(), v.end());   // ambiguous in large codebases
```

**Best practice**: use `using` selectively, or just type `std::`:

```cpp
using std::string;      // only bring in what you need
using std::vector;

string s = "hello";     // fine — explicit and clear
std::cout << s;         // std:: for the rest
```

---

## Essential `std::` Types

### `std::string`

```cpp
#include <string>

std::string s = "hello";
s += " world";                  // concatenation
s.size();                       // 11
s.empty();                      // false
s.find("world");                // 6 (index)
s.substr(0, 5);                 // "hello"
s.c_str();                      // const char* — for C APIs (Win32, fopen, etc.)

// Conversion
std::string num = std::to_string(42);
int n = std::stoi("123");
```

### `std::vector<T>` — Dynamic Array

```cpp
#include <vector>

std::vector<int> v = {1, 2, 3};
v.push_back(4);                  // append
v.size();                        // 4
v[0];                            // 1 — no bounds check (fast)
v.at(0);                         // 1 — with bounds check (throws if out of range)
v.front();                       // 1
v.back();                        // 4

// Iterate
for (int x : v) { std::cout << x << " "; }

// Reserve capacity up front (avoids repeated reallocations)
std::vector<int> big;
big.reserve(10000);
```

### `std::array<T, N>` — Fixed-Size Array

```cpp
#include <array>

std::array<int, 4> arr = {10, 20, 30, 40};
arr.size();      // 4 — known at compile time
arr[0];          // 10
// arr[10];      // ❌ undefined behavior (like raw arrays)
arr.at(10);      // ❌ throws std::out_of_range — safe version
```

### `std::map<K, V>` — Sorted Key-Value Store

```cpp
#include <map>

std::map<std::string, int> scores;
scores["Alice"] = 95;
scores["Bob"]   = 87;

scores.count("Alice");           // 1 — key exists
scores.find("Charlie");          // == scores.end() if not found

for (auto& [name, score] : scores) {   // structured binding (C++17)
    std::cout << name << ": " << score << "\n";
}
```

### `std::unordered_map<K, V>` — Hash Map (faster lookups)

```cpp
#include <unordered_map>

std::unordered_map<std::string, int> registry;
registry["HKLM"] = 1;
registry["HKCU"] = 2;

// O(1) average lookup vs O(log n) for std::map
```

### `std::optional<T>` — Value That May Not Exist

```cpp
#include <optional>

std::optional<int> find_port(const std::string& service) {
    if (service == "http")  return 80;
    if (service == "https") return 443;
    return std::nullopt;    // nothing to return
}

auto port = find_port("https");
if (port) {
    std::cout << "Port: " << *port << "\n";   // dereference like a pointer
}
// Better:
std::cout << port.value_or(0) << "\n";   // default if empty
```

---

## Smart Pointers

The most important `std::` types for system programming. They manage heap memory automatically.

### `std::unique_ptr<T>` — Sole Owner

```cpp
#include <memory>

// Owns the object — deletes it when the unique_ptr goes out of scope
std::unique_ptr<int> p = std::make_unique<int>(42);
*p = 100;                           // dereference like a raw pointer
p.get();                            // get the raw pointer (careful — don't delete it!)

// Transferring ownership
std::unique_ptr<int> p2 = std::move(p);   // p is now null — p2 owns it
// unique_ptr cannot be copied — only moved

// Custom deleter (important for Win32 HANDLEs)
auto handle_deleter = [](HANDLE h) { if (h) CloseHandle(h); };
std::unique_ptr<void, decltype(handle_deleter)> handle(
    CreateFile(...), handle_deleter
);
```

### `std::shared_ptr<T>` — Shared Ownership

```cpp
// Reference-counted — object deleted when last shared_ptr is destroyed
std::shared_ptr<int> a = std::make_shared<int>(10);
std::shared_ptr<int> b = a;    // both own it — ref count = 2

b.reset();                     // b releases — ref count = 1
// a goes out of scope — ref count = 0 — object deleted
```

> In system programming, prefer `unique_ptr`. Use `shared_ptr` only when you genuinely need shared ownership.

---

## I/O — `std::cout`, `std::cin`, `std::cerr`

```cpp
#include <iostream>

std::cout << "Hello " << "World" << "\n";   // stdout
std::cerr << "Error: " << msg << "\n";      // stderr (unbuffered — always prints)
std::cin  >> value;                         // stdin

// std::endl vs "\n"
std::cout << "line" << std::endl;   // flushes buffer — slower
std::cout << "line" << "\n";        // just newline — prefer this
```

---

## Algorithms — `<algorithm>`

```cpp
#include <algorithm>

std::vector<int> v = {5, 3, 1, 4, 2};

std::sort(v.begin(), v.end());                     // sort ascending
std::sort(v.begin(), v.end(), std::greater<int>{}); // sort descending

auto it = std::find(v.begin(), v.end(), 3);        // find element
if (it != v.end()) { /* found */ }

std::for_each(v.begin(), v.end(), [](int x) {
    std::cout << x << " ";
});

int total = std::accumulate(v.begin(), v.end(), 0); // sum
```

---

## `auto` Keyword

`auto` lets the compiler infer the type — reduces verbosity:

```cpp
auto x = 42;                          // int
auto s = std::string("hello");        // std::string
auto v = std::vector<int>{1, 2, 3};  // std::vector<int>

// Especially useful with long iterator types
std::map<std::string, int> m;
auto it = m.begin();   // instead of: std::map<std::string,int>::iterator it

// Range-for with auto
for (auto& elem : v) { elem *= 2; }   // & = reference (modifies in place)
for (const auto& elem : v) { }        // const & = read-only
```

---

## Range-For Loop

```cpp
std::vector<std::string> files = {"a.txt", "b.txt", "c.txt"};

// By value — copy each element (fine for small types like int)
for (std::string f : files) { }

// By const reference — read without copying (use for strings/objects)
for (const std::string& f : files) {
    std::cout << f << "\n";
}

// By reference — modify in place
for (std::string& f : files) {
    f += ".bak";
}
```

---

## Header Quick Reference

| Header            | What you get                                             |
| ----------------- | -------------------------------------------------------- |
| `<string>`        | `std::string`                                            |
| `<vector>`        | `std::vector`                                            |
| `<array>`         | `std::array`                                             |
| `<map>`           | `std::map`, `std::multimap`                              |
| `<unordered_map>` | `std::unordered_map`                                     |
| `<set>`           | `std::set`                                               |
| `<memory>`        | `std::unique_ptr`, `std::shared_ptr`, `std::make_unique` |
| `<optional>`      | `std::optional`                                          |
| `<iostream>`      | `std::cout`, `std::cin`, `std::cerr`                     |
| `<fstream>`       | `std::ifstream`, `std::ofstream`                         |
| `<algorithm>`     | `std::sort`, `std::find`, `std::for_each`, etc.          |
| `<functional>`    | `std::function`, lambdas                                 |
| `<thread>`        | `std::thread`                                            |
| `<mutex>`         | `std::mutex`, `std::lock_guard`                          |
| `<filesystem>`    | `std::filesystem::path`, `directory_iterator`            |

---

## Next

→ [Phase 0 — C++ Core Gaps](../00-cpp-core-gaps/) — Now that you know the syntax, tackle the system-level patterns
