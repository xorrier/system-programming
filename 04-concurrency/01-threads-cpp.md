# C++ Threads (`std::thread`, Mutex, Condition Variable)

> **Phase 4 · Topic 1** | Estimated Time: 3 hours

---

## Why C++ Threads?

We covered OS-level threads (`CreateThread`, `pthread_create`) in Phase 3. C++11 introduced **portable threading** in the standard library. Benefits:

- **Cross-platform** — same code works on Windows, Linux, macOS
- **RAII-based** — `lock_guard` and `unique_lock` prevent forgetting to unlock
- **Type-safe** — pass any arguments, not just `void*`
- **Modern** — lambdas, futures, condition variables built in

---

## `std::thread` Basics

```cpp
#include <thread>
#include <iostream>

void sayHello(int id) {
    std::cout << "Hello from thread " << id << "!\n";
}

int main() {
    // Create a thread that runs sayHello(42)
    std::thread t(sayHello, 42);

    // MUST join or detach before the thread object is destroyed
    t.join();   // Wait for thread to finish

    return 0;
}
```

### Creating Threads with Lambdas

```cpp
#include <thread>
#include <iostream>
#include <vector>

int main() {
    std::vector<std::thread> threads;

    for (int i = 0; i < 4; ++i) {
        threads.emplace_back([i]() {
            std::cout << "Thread " << i << " running\n";
        });
    }

    // Join all threads
    for (auto& t : threads) {
        t.join();
    }
}
```

### Join vs Detach

| Method | Meaning | When to Use |
|--------|---------|-------------|
| `join()` | Block until thread finishes | When you need the result |
| `detach()` | Let thread run independently | Fire-and-forget tasks |

```cpp
std::thread t([] { /* work */ });

t.join();     // Wait for it
// OR
t.detach();   // Let it run free

// ⚠️ If neither is called before `t` is destroyed → std::terminate()!
```

### Passing Arguments

```cpp
void process(int id, const std::string& name) {
    std::cout << id << ": " << name << "\n";
}

// Arguments are COPIED by default
std::thread t1(process, 1, "Alice");

// Use std::ref to pass by reference (needed for std::thread argument forwarding)
int counter = 0;
std::thread t2([](int& c) { c++; }, std::ref(counter));
t2.join();
// counter is now 1

// Simpler alternative: capture by reference in the lambda
// std::thread t3([&counter]() { counter++; });
```

---

## `std::mutex` — Protecting Shared Data

Without a mutex, multiple threads accessing the same data = **data race** = undefined behavior.

```cpp
#include <thread>
#include <mutex>
#include <iostream>

int counter = 0;
std::mutex mtx;

void increment(int times) {
    for (int i = 0; i < times; ++i) {
        mtx.lock();
        counter++;          // Protected by mutex
        mtx.unlock();
    }
}

int main() {
    std::thread t1(increment, 100000);
    std::thread t2(increment, 100000);
    t1.join();
    t2.join();

    std::cout << "Counter: " << counter << "\n";  // Always 200000
}
```

---

## `std::lock_guard` — RAII Mutex Locking

**Never call `lock()`/`unlock()` manually** — use `lock_guard` instead:

```cpp
#include <mutex>

std::mutex mtx;
int sharedData = 0;

void safeIncrement() {
    std::lock_guard<std::mutex> lock(mtx);  // Locks in constructor
    sharedData++;
    // ... even if exception thrown here, mutex is unlocked
}   // lock_guard destructor calls mtx.unlock()
```

### `std::unique_lock` — More Flexible

```cpp
std::mutex mtx;

void flexibleLocking() {
    std::unique_lock<std::mutex> lock(mtx);

    // Can unlock early
    lock.unlock();
    // ... do non-critical work ...
    lock.lock();  // Re-lock

    // Can also defer locking
    std::unique_lock<std::mutex> lock2(mtx, std::defer_lock);
    // Not locked yet
    lock2.lock();  // Lock when ready
}
```

### `std::scoped_lock` (C++17) — Lock Multiple Mutexes

```cpp
std::mutex mtx1, mtx2;

void transferMoney(/* ... */) {
    // Locks BOTH mutexes without risking deadlock
    std::scoped_lock lock(mtx1, mtx2);
    // ... safe to access data protected by either mutex
}
```

---

## `std::condition_variable` — Thread Signaling

Condition variables let one thread **wait** until another thread **signals** it:

```cpp
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <iostream>

std::mutex mtx;
std::condition_variable cv;
std::queue<int> workQueue;
bool done = false;

// PRODUCER: adds work items
void producer() {
    for (int i = 0; i < 10; ++i) {
        {
            std::lock_guard<std::mutex> lock(mtx);
            workQueue.push(i);
            std::cout << "Produced: " << i << "\n";
        }
        cv.notify_one();  // Wake up one waiting consumer
    }

    {
        std::lock_guard<std::mutex> lock(mtx);
        done = true;
    }
    cv.notify_all();  // Wake up all consumers
}

// CONSUMER: processes work items
void consumer() {
    while (true) {
        std::unique_lock<std::mutex> lock(mtx);

        // Wait until there's work OR we're done
        cv.wait(lock, [] { return !workQueue.empty() || done; });

        if (workQueue.empty() && done) break;  // No more work

        int item = workQueue.front();
        workQueue.pop();
        lock.unlock();  // Unlock while processing

        std::cout << "Consumed: " << item << "\n";
    }
}

int main() {
    std::thread prod(producer);
    std::thread cons(consumer);
    prod.join();
    cons.join();
}
```

### Why the Predicate Matters

```cpp
// ❌ BAD — spurious wakeups!
cv.wait(lock);  // May wake up even when nothing changed

// ✅ GOOD — always use a predicate
cv.wait(lock, [] { return !queue.empty(); });
// Equivalent to:
// while (!condition) cv.wait(lock);
```

---

## Deadlocks

A **deadlock** happens when two threads wait for each other forever:

```cpp
std::mutex m1, m2;

// Thread 1:                    Thread 2:
// m1.lock();                   m2.lock();
// m2.lock();  ← BLOCKED        m1.lock();  ← BLOCKED
// Both threads stuck forever!
```

### How to Avoid Deadlocks

1. **Always lock in the same order**: If all threads lock `m1` before `m2`, no deadlock
2. **Use `std::scoped_lock`**: It acquires multiple locks atomically
3. **Use `std::lock()`**: Locks multiple mutexes without deadlock

```cpp
// ✅ Safe — std::scoped_lock handles ordering
std::scoped_lock lock(m1, m2);

// ✅ Safe — std::lock + adopt_lock
std::lock(m1, m2);
std::lock_guard<std::mutex> lg1(m1, std::adopt_lock);
std::lock_guard<std::mutex> lg2(m2, std::adopt_lock);
```

---

## Thread-Safe Data Structure Example

```cpp
#include <mutex>
#include <queue>
#include <optional>

template<typename T>
class ThreadSafeQueue {
public:
    void push(T value) {
        std::lock_guard<std::mutex> lock(mtx_);
        queue_.push(std::move(value));
        cv_.notify_one();
    }

    // Blocks until an item is available
    T pop() {
        std::unique_lock<std::mutex> lock(mtx_);
        cv_.wait(lock, [this] { return !queue_.empty(); });
        T val = std::move(queue_.front());
        queue_.pop();
        return val;
    }

    // Non-blocking — returns nullopt if empty
    std::optional<T> tryPop() {
        std::lock_guard<std::mutex> lock(mtx_);
        if (queue_.empty()) return std::nullopt;
        T val = std::move(queue_.front());
        queue_.pop();
        return val;
    }

    bool empty() const {
        std::lock_guard<std::mutex> lock(mtx_);
        return queue_.empty();
    }

private:
    mutable std::mutex mtx_;
    std::queue<T> queue_;
    std::condition_variable cv_;
};
```

---

## Practical Exercises

1. **Parallel sum**: Split an array into 4 chunks, sum each in a separate thread, combine results.
2. **Producer-consumer**: Implement the pattern above with multiple producers and consumers.
3. **Thread-safe counter**: Create a counter class with `increment()`, `decrement()`, and `get()` — all thread-safe.
4. **Dining philosophers**: Implement the classic problem, demonstrate deadlock, then fix it.

---

## Key Takeaways

- ✅ Use `std::thread` for portable threading (not `CreateThread` directly)
- ✅ Always `join()` or `detach()` before thread destruction
- ✅ Use `lock_guard` / `scoped_lock` — never raw `lock()`/`unlock()`
- ✅ `condition_variable` for thread signaling (always with a predicate)
- ✅ `scoped_lock` prevents deadlocks when locking multiple mutexes
- ❌ Never access shared data without a lock
- ❌ Don't use `cv.wait(lock)` without a predicate — spurious wakeups!

---

## Next

→ [`02-atomics.md`](./02-atomics.md) — `std::atomic` and memory ordering
