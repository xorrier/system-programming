# Thread Patterns — Pools, IOCP, Producer-Consumer

> **Phase 4 · Topic 4** | Estimated Time: 4 hours

---

## Why Thread Patterns?

Creating a new thread for every task is expensive. Real system software uses patterns that **reuse threads** and **coordinate work** efficiently:

- **Producer-Consumer** — decouple work generation from work processing
- **Thread Pool** — reuse a fixed set of threads for many tasks
- **IOCP** — Windows' high-performance async I/O model
- **Future/Promise** — return values from async operations

---

## Pattern 1: Producer-Consumer

One or more threads produce work items; one or more threads consume them.

```
Producer(s) → [Work Queue] → Consumer(s)
```

### Implementation with `std::mutex` + `std::condition_variable`

```cpp
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <functional>
#include <iostream>
#include <vector>

class WorkQueue {
public:
    using Task = std::function<void()>;

    void submit(Task task) {
        {
            std::lock_guard<std::mutex> lock(mtx_);
            queue_.push(std::move(task));
        }
        cv_.notify_one();
    }

    void shutdown() {
        {
            std::lock_guard<std::mutex> lock(mtx_);
            shutdown_ = true;
        }
        cv_.notify_all();
    }

    // Returns false when shut down and queue is empty
    bool waitAndPop(Task& task) {
        std::unique_lock<std::mutex> lock(mtx_);
        cv_.wait(lock, [this] { return !queue_.empty() || shutdown_; });

        if (queue_.empty()) return false;  // Shutdown

        task = std::move(queue_.front());
        queue_.pop();
        return true;
    }

private:
    std::mutex mtx_;
    std::condition_variable cv_;
    std::queue<Task> queue_;
    bool shutdown_ = false;
};

void producerConsumerDemo() {
    WorkQueue wq;

    // Start 3 consumer threads
    std::vector<std::thread> consumers;
    for (int i = 0; i < 3; ++i) {
        consumers.emplace_back([&wq, i]() {
            WorkQueue::Task task;
            while (wq.waitAndPop(task)) {
                task();
            }
            std::cout << "Consumer " << i << " shutting down\n";
        });
    }

    // Producer: submit 20 tasks
    for (int i = 0; i < 20; ++i) {
        wq.submit([i]() {
            std::cout << "Processing task " << i << " on thread "
                      << std::this_thread::get_id() << "\n";
        });
    }

    wq.shutdown();
    for (auto& t : consumers) t.join();
}
```

---

## Pattern 2: Thread Pool

A fixed number of worker threads that process tasks from a shared queue. This is the most common pattern in production code.

### Simple C++ Thread Pool

```cpp
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <functional>
#include <vector>
#include <future>

class ThreadPool {
public:
    explicit ThreadPool(size_t numThreads) {
        for (size_t i = 0; i < numThreads; ++i) {
            workers_.emplace_back([this]() {
                while (true) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(mtx_);
                        cv_.wait(lock, [this] {
                            return !tasks_.empty() || stop_;
                        });
                        if (stop_ && tasks_.empty()) return;
                        task = std::move(tasks_.front());
                        tasks_.pop();
                    }
                    task();  // Execute outside the lock
                }
            });
        }
    }

    ~ThreadPool() {
        {
            std::lock_guard<std::mutex> lock(mtx_);
            stop_ = true;
        }
        cv_.notify_all();
        for (auto& w : workers_) w.join();
    }

    // Submit a task and get a future for the result
    template<typename F>
    auto submit(F&& func) -> std::future<decltype(func())> {
        using ReturnType = decltype(func());

        auto task = std::make_shared<std::packaged_task<ReturnType()>>(
            std::forward<F>(func)
        );

        std::future<ReturnType> future = task->get_future();
        {
            std::lock_guard<std::mutex> lock(mtx_);
            tasks_.emplace([task]() { (*task)(); });
        }
        cv_.notify_one();
        return future;
    }

private:
    std::vector<std::thread> workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex mtx_;
    std::condition_variable cv_;
    bool stop_ = false;
};
```

Usage:

```cpp
void threadPoolDemo() {
    ThreadPool pool(4);  // 4 worker threads

    // Submit tasks and get futures
    auto f1 = pool.submit([]() { return 42; });
    auto f2 = pool.submit([]() { return std::string("hello"); });

    // Submit many tasks
    std::vector<std::future<int>> results;
    for (int i = 0; i < 100; ++i) {
        results.push_back(pool.submit([i]() {
            return i * i;
        }));
    }

    // Get results
    std::cout << "f1 = " << f1.get() << "\n";   // 42
    std::cout << "f2 = " << f2.get() << "\n";   // "hello"

    for (auto& r : results) {
        std::cout << r.get() << " ";
    }
    // pool destructor joins all threads
}
```

---

## Win32 Thread Pool API

Windows provides a built-in thread pool (no need to implement your own):

```cpp
#include <windows.h>
#include <cstdio>

// Callback function — runs on a pool thread
void CALLBACK poolCallback(PTP_CALLBACK_INSTANCE instance,
                            PVOID context,
                            PTP_WORK work) {
    int id = (int)(intptr_t)context;
    printf("Task %d running on thread %lu\n", id, GetCurrentThreadId());
    Sleep(100);  // Simulate work
}

void win32ThreadPoolDemo() {
    // Submit 10 tasks to the default thread pool
    PTP_WORK workItems[10];
    for (int i = 0; i < 10; ++i) {
        workItems[i] = CreateThreadpoolWork(
            poolCallback,
            (PVOID)(intptr_t)i,
            nullptr  // Default pool environment
        );
        SubmitThreadpoolWork(workItems[i]);
    }

    // Wait for all to complete
    for (int i = 0; i < 10; ++i) {
        WaitForThreadpoolWorkCallbacks(workItems[i], FALSE);
        CloseThreadpoolWork(workItems[i]);
    }

    printf("All tasks done!\n");
}
```

---

## Pattern 3: IOCP (I/O Completion Ports)

**IOCP** is Windows' most scalable async I/O model. Used by high-performance servers (IIS, SQL Server). It combines:

- A **queue** of completed I/O operations
- A **pool** of threads that process completions
- Automatic thread management (OS wakes optimal number of threads)

```
                   ┌──────────────┐
File/Socket I/O →  │  Completion  │ → Worker Thread 1
File/Socket I/O →  │    Port      │ → Worker Thread 2
File/Socket I/O →  │   (Queue)    │ → Worker Thread 3
                   └──────────────┘
```

### Simple IOCP Example

```cpp
#include <windows.h>
#include <cstdio>
#include <vector>
#include <thread>

void iocpDemo() {
    // 1. Create the completion port
    HANDLE hIOCP = CreateIoCompletionPort(
        INVALID_HANDLE_VALUE,  // No file handle yet
        nullptr,               // Create new IOCP
        0,                     // Completion key
        0                      // Threads = number of CPUs
    );

    // 2. Worker threads that process completions
    auto worker = [hIOCP]() {
        DWORD bytes;
        ULONG_PTR key;
        LPOVERLAPPED overlapped;

        while (true) {
            BOOL ok = GetQueuedCompletionStatus(
                hIOCP,
                &bytes,       // Bytes transferred
                &key,         // Completion key (user data)
                &overlapped,  // OVERLAPPED struct
                INFINITE
            );

            if (key == 0xDEAD) break;  // Shutdown signal

            printf("Thread %lu: completed task %llu (bytes: %lu)\n",
                   GetCurrentThreadId(), key, bytes);
        }
    };

    std::vector<std::thread> workers;
    for (int i = 0; i < 4; ++i) {
        workers.emplace_back(worker);
    }

    // 3. Post work items to the IOCP
    for (int i = 1; i <= 20; ++i) {
        PostQueuedCompletionStatus(hIOCP, 0, (ULONG_PTR)i, nullptr);
    }

    // 4. Post shutdown signals
    for (int i = 0; i < 4; ++i) {
        PostQueuedCompletionStatus(hIOCP, 0, 0xDEAD, nullptr);
    }

    for (auto& w : workers) w.join();
    CloseHandle(hIOCP);
}
```

---

## Pattern 4: Future and Promise

`std::future` and `std::promise` provide a way to get a **return value** from an async operation:

```cpp
#include <future>
#include <thread>
#include <iostream>

// Using std::async — easiest way
void asyncDemo() {
    // Launch an async task
    auto future = std::async(std::launch::async, []() {
        // Runs on a separate thread
        std::this_thread::sleep_for(std::chrono::seconds(1));
        return 42;
    });

    // Do other work while task runs...
    std::cout << "Waiting for result...\n";

    // Get the result (blocks until ready)
    int result = future.get();
    std::cout << "Result: " << result << "\n";
}

// Using std::promise — more control
void promiseDemo() {
    std::promise<int> promise;
    std::future<int> future = promise.get_future();

    std::thread t([&promise]() {
        // Compute result
        int result = 42;
        promise.set_value(result);  // Fulfill the promise
    });

    int value = future.get();  // Blocks until promise is fulfilled
    std::cout << "Got: " << value << "\n";

    t.join();
}
```

### `std::async` Launch Policies

| Policy | Meaning |
|--------|---------|
| `std::launch::async` | Run on a new thread immediately |
| `std::launch::deferred` | Run lazily when `.get()` is called |
| `std::launch::async \| std::launch::deferred` | Implementation decides (default) |

---

## Choosing the Right Pattern

| Need | Pattern |
|------|---------|
| Decouple work generation from processing | Producer-Consumer |
| Limit concurrency, reuse threads | Thread Pool |
| High-performance server I/O | IOCP |
| Get a return value from async work | Future/Promise |
| Fire-and-forget background task | `std::async` or detached thread |

---

## Practical Exercises

1. **Thread pool**: Build the thread pool above, submit 100 tasks, verify all complete.
2. **Parallel file processor**: Use a thread pool to read and checksum 10 files in parallel.
3. **IOCP echo server**: Build a simple TCP echo server using IOCP.
4. **Async pipeline**: Chain multiple `std::async` calls: task A → result feeds task B → result feeds task C.

---

## Key Takeaways

- ✅ Thread pools reuse threads — avoid create/destroy overhead
- ✅ Producer-consumer decouples work generation from processing
- ✅ IOCP is the gold standard for scalable I/O on Windows
- ✅ `std::async` + `std::future` for simple async tasks with return values
- ✅ Win32's `CreateThreadpoolWork` is easier than building your own pool
- ❌ Don't create a thread per task — thread creation is expensive
- ❌ Don't forget to `join()` pool threads before destruction

---

## Next Phase

→ [`../05-windows-internals/`](../05-windows-internals/) — Windows Update Internals
