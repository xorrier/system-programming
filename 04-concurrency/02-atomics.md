# Atomics and Memory Ordering

> **Phase 4 · Topic 2** | Estimated Time: 3–4 hours

---

## What Are Atomics?

An **atomic operation** is one that completes in a single step — no other thread can see it half-done. Without atomics, even `counter++` is dangerous:

```
counter++  actually does 3 steps:
1. READ  counter into register    (value = 5)
2. ADD   1 to register            (value = 6)
3. WRITE register back to counter (counter = 6)

If two threads do this simultaneously:
Thread A: READ 5 → ADD → WRITE 6
Thread B: READ 5 → ADD → WRITE 6   ← Both read 5!
Result: counter = 6  (should be 7!)
```

`std::atomic<int>` makes the entire read-modify-write happen as **one indivisible step**.

---

## `std::atomic<T>` Basics

```cpp
#include <atomic>
#include <thread>
#include <iostream>

std::atomic<int> counter{0};  // Atomic integer, initialized to 0

void increment(int times) {
    for (int i = 0; i < times; ++i) {
        counter++;  // Atomic increment — safe without mutex!
    }
}

int main() {
    std::thread t1(increment, 100000);
    std::thread t2(increment, 100000);
    t1.join();
    t2.join();

    std::cout << "Counter: " << counter.load() << "\n";  // Always 200000
}
```

### Core Operations

| Operation | Method | Meaning |
|-----------|--------|---------|
| Read | `val = x.load()` | Atomically read the value |
| Write | `x.store(val)` | Atomically write a value |
| Exchange | `old = x.exchange(val)` | Write new, return old |
| Add | `x.fetch_add(n)` | Add and return old value |
| Sub | `x.fetch_sub(n)` | Subtract and return old value |
| CAS | `x.compare_exchange_strong(expected, desired)` | Conditional swap |
| Increment | `x++` or `++x` | Shorthand for `fetch_add(1)` |

```cpp
std::atomic<int> x{10};

x.store(42);                    // x = 42
int val = x.load();             // val = 42
int old = x.exchange(100);      // old = 42, x = 100
x.fetch_add(5);                 // x = 105, returns 100
```

---

## Compare-and-Swap (CAS)

The most powerful atomic operation. It says:

> "If `x` is currently `expected`, change it to `desired`. Otherwise, tell me what it actually is."

```cpp
std::atomic<int> x{5};
int expected = 5;
int desired  = 10;

bool success = x.compare_exchange_strong(expected, desired);
// If x was 5: x becomes 10, returns true
// If x was NOT 5: expected is updated to x's actual value, returns false
```

### CAS Loop Pattern

Used to build lock-free algorithms:

```cpp
// Lock-free max update
std::atomic<int> maxVal{0};

void updateMax(int newVal) {
    int current = maxVal.load();
    while (newVal > current) {
        // Try to swap. If another thread changed it, current is updated
        if (maxVal.compare_exchange_weak(current, newVal)) {
            break;  // Success!
        }
        // Failed — current now has the latest value, loop and retry
    }
}
```

### `compare_exchange_strong` vs `compare_exchange_weak`

| Version | Spurious failure? | Use when |
|---------|-------------------|----------|
| `strong` | ❌ Never | Single attempt, or outside a loop |
| `weak` | ✅ May fail even when values match | In a CAS loop (slightly faster on some CPUs) |

---

## Memory Ordering

When you use atomics, you also control how other memory operations are **ordered around them**. This is crucial on modern CPUs that reorder instructions for performance.

### The Problem

```cpp
// Thread 1:
data = 42;           // [A] Write data
ready.store(true);   // [B] Signal ready

// Thread 2:
if (ready.load()) {  // [C] Check ready
    use(data);       // [D] Read data
}

// On a weakly-ordered CPU (ARM), Thread 2 might see:
// ready = true BUT data is still 0!
// Because the CPU/compiler reordered [A] and [B]
```

### Memory Order Options

| Order | Guarantee | Speed |
|-------|-----------|-------|
| `memory_order_relaxed` | Only atomicity, no ordering | ⚡ Fastest |
| `memory_order_acquire` | Reads after this see all writes from the release | Fast |
| `memory_order_release` | Writes before this are visible to acquire readers | Fast |
| `memory_order_acq_rel` | Both acquire and release | Medium |
| `memory_order_seq_cst` | Total global ordering (default) | 🐢 Slowest |

### The Acquire-Release Pattern

The most common pattern — publish data safely between threads:

```cpp
#include <atomic>
#include <thread>
#include <cassert>

std::atomic<bool> ready{false};
int data = 0;

// PRODUCER (writer)
void producer() {
    data = 42;                                    // Write data first
    ready.store(true, std::memory_order_release); // Release: all prior writes visible
}

// CONSUMER (reader)
void consumer() {
    while (!ready.load(std::memory_order_acquire)) {
        // Spin wait
    }
    // Acquire: we see all writes that happened before the release
    assert(data == 42);  // Guaranteed!
}
```

### When to Use Which

| Scenario | Memory Order |
|----------|-------------|
| Simple counter (don't care about ordering) | `relaxed` |
| Publishing data to another thread | `release` (writer) + `acquire` (reader) |
| Lock/unlock pattern | `acquire` (lock) + `release` (unlock) |
| When in doubt | `seq_cst` (default — safest) |

---

## `std::atomic_flag` — The Simplest Spinlock

```cpp
#include <atomic>
#include <thread>
#include <iostream>

class Spinlock {
public:
    void lock() {
        // test_and_set: set flag to true, return old value
        // Keep spinning while old value was true (someone else has the lock)
        while (flag_.test_and_set(std::memory_order_acquire)) {
            // Busy wait (spinning)
        }
    }

    void unlock() {
        flag_.clear(std::memory_order_release);
    }

private:
    std::atomic_flag flag_ = ATOMIC_FLAG_INIT;
};

Spinlock spin;
int sharedData = 0;

void worker() {
    for (int i = 0; i < 100000; ++i) {
        spin.lock();
        sharedData++;
        spin.unlock();
    }
}
```

> ⚠️ Spinlocks waste CPU cycles while waiting. Use `std::mutex` for general-purpose locking. Use spinlocks only when the critical section is **extremely short** (nanoseconds).

---

## Atomics vs Mutexes

| Feature | `std::atomic` | `std::mutex` |
|---------|--------------|-------------|
| **Lock-free** | ✅ (usually) | ❌ |
| **Overhead** | Very low | Higher (OS syscall) |
| **Best for** | Single variables | Protecting code blocks |
| **Composability** | Hard | Easy (lock_guard) |
| **Complexity** | High (memory ordering) | Low |

**Rule of thumb**:
- Use `std::atomic` for **single counters, flags, pointers**
- Use `std::mutex` for **everything else** (multiple variables, complex operations)

---

## Lock-Free Stack (Advanced Example)

```cpp
#include <atomic>
#include <memory>

template<typename T>
class LockFreeStack {
    struct Node {
        T data;
        Node* next;
        Node(T val) : data(std::move(val)), next(nullptr) {}
    };

    std::atomic<Node*> head_{nullptr};

public:
    void push(T value) {
        Node* newNode = new Node(std::move(value));
        newNode->next = head_.load(std::memory_order_relaxed);

        // CAS loop: keep trying until we successfully update head
        while (!head_.compare_exchange_weak(
            newNode->next, newNode,
            std::memory_order_release,
            std::memory_order_relaxed)) {
            // newNode->next is updated to current head, retry
        }
    }

    bool pop(T& result) {
        Node* oldHead = head_.load(std::memory_order_acquire);

        while (oldHead && !head_.compare_exchange_weak(
            oldHead, oldHead->next,
            std::memory_order_acq_rel,
            std::memory_order_acquire)) {
            // oldHead updated, retry
        }

        if (!oldHead) return false;

        result = std::move(oldHead->data);
        delete oldHead;  // Note: real-world needs hazard pointers or epoch-based reclamation
        return true;
    }
};
```

---

## Practical Exercises

1. **Atomic counter**: Compare performance of `std::atomic<int>` vs `std::mutex`-protected `int` with 4 threads doing 1M increments each.
2. **Spinlock implementation**: Build a spinlock using `atomic_flag`, test with multiple threads.
3. **Acquire-release demo**: Demonstrate that `relaxed` ordering can see stale data, while `acquire/release` guarantees correctness.
4. **Lock-free counter**: Build a lock-free counter using CAS (`compare_exchange_weak` in a loop).

---

## Key Takeaways

- ✅ `std::atomic<T>` makes single-variable operations thread-safe without mutexes
- ✅ CAS (compare-and-swap) is the building block of lock-free algorithms
- ✅ `memory_order_seq_cst` is the safest default — use it unless you need performance
- ✅ Acquire-release is the most common pattern for publishing data
- ✅ `relaxed` is only for things like counters where ordering doesn't matter
- ❌ Atomics don't protect multiple related variables — use mutex for that
- ❌ Lock-free ≠ wait-free ≠ always faster — profile before optimizing

---

## Next

→ [`03-win32-sync.md`](./03-win32-sync.md) — Win32 synchronization primitives
