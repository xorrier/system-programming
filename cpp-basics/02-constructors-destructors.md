# Constructors, Destructors & The Rule of Five

This is the syntax block that confuses most people coming from Java/Python. Let's break every piece down.

---

## Constructor — How an Object is Born

A constructor is a special method called **automatically** when an object is created. It has the same name as the class and **no return type**.

```cpp
class Person {
public:
    std::string name;
    int age;

    // Default constructor — called when: Person p;
    Person() : name("Unknown"), age(0) {}

    // Parameterised constructor — called when: Person p("Alice", 30);
    Person(std::string n, int a) : name(n), age(a) {}
};

Person p1;                    // calls default constructor
Person p2("Alice", 30);       // calls parameterised constructor
Person p3 = Person("Bob", 25); // same as above
```

### Initialiser List (`: name(n), age(a)`)

The `: name(n), age(a)` part is a **member initialiser list**. It initialises members **before** the constructor body runs. Always prefer this over assignment inside `{}`:

```cpp
// ✅ GOOD — initialises directly
Person(std::string n, int a) : name(n), age(a) {}

// ❌ Less efficient — default-constructs first, then assigns
Person(std::string n, int a) {
    name = n;   // assignment, not initialisation
    age  = a;
}
```

---

## Destructor — How an Object Dies

The destructor runs **automatically** when an object goes out of scope or is `delete`d. One destructor per class, no parameters, no return type.

```cpp
class FileHandle {
public:
    FileHandle(const char* path) {
        file = fopen(path, "r");
        std::cout << "File opened\n";
    }

    ~FileHandle() {               // destructor — the ~ prefix
        if (file) {
            fclose(file);
            std::cout << "File closed\n";
        }
    }

private:
    FILE* file = nullptr;
};

{
    FileHandle fh("data.txt");    // constructor called — file opened
    // ... use fh ...
}                                 // scope ends — destructor called automatically!
```

> This pattern (constructor acquires, destructor releases) is called **RAII** — the most important pattern in C++ system programming.

---

## The Rule of Five

When your class manages a resource (memory, file handle, socket, mutex...) you usually need to define **all five** of these:

```cpp
class Resource {
public:
    ~Resource();                          // 1. Destructor
    Resource(const Resource&);            // 2. Copy constructor
    Resource& operator=(const Resource&); // 3. Copy assignment
    Resource(Resource&&) noexcept;        // 4. Move constructor
    Resource& operator=(Resource&&) noexcept; // 5. Move assignment
};
```

Let's implement each one with a concrete example — a class that owns a heap-allocated array:

```cpp
class Buffer {
public:
    // ── Regular constructor ─────────────────────────────────────────
    explicit Buffer(size_t size)
        : data_(new int[size]), size_(size) {
        std::cout << "Constructed\n";
    }

    // ── 1. Destructor ───────────────────────────────────────────────
    ~Buffer() {
        delete[] data_;           // free the heap memory
        std::cout << "Destroyed\n";
    }

    // ── 2. Copy constructor ─────────────────────────────────────────
    // Called when: Buffer b2 = b1;  OR  Buffer b2(b1);
    Buffer(const Buffer& other)
        : data_(new int[other.size_]), size_(other.size_) {
        std::copy(other.data_, other.data_ + size_, data_);  // deep copy
        std::cout << "Copy constructed\n";
    }

    // ── 3. Copy assignment ──────────────────────────────────────────
    // Called when: b2 = b1;  (both already exist)
    Buffer& operator=(const Buffer& other) {
        if (this == &other) return *this;   // self-assignment guard
        delete[] data_;                     // free old memory
        data_ = new int[other.size_];
        size_ = other.size_;
        std::copy(other.data_, other.data_ + size_, data_);
        std::cout << "Copy assigned\n";
        return *this;
    }

    // ── 4. Move constructor ─────────────────────────────────────────
    // Called when: Buffer b2 = std::move(b1);
    // "Steal" the resource instead of copying — b1 is left empty
    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;   // leave the moved-from object safe to destroy
        other.size_ = 0;
        std::cout << "Move constructed\n";
    }

    // ── 5. Move assignment ──────────────────────────────────────────
    // Called when: b2 = std::move(b1);  (both already exist)
    Buffer& operator=(Buffer&& other) noexcept {
        if (this == &other) return *this;
        delete[] data_;           // free our current resource
        data_ = other.data_;      // steal other's resource
        size_ = other.size_;
        other.data_ = nullptr;    // leave other safe
        other.size_ = 0;
        std::cout << "Move assigned\n";
        return *this;
    }

private:
    int*   data_;
    size_t size_;
};
```

### Why Copy vs Move?

| Operation | What happens                         | Cost                                         |
| --------- | ------------------------------------ | -------------------------------------------- |
| Copy      | Creates a full duplicate of the data | **Expensive** — allocates + copies all bytes |
| Move      | Transfers ownership — no data copied | **Cheap** — just copies a pointer            |

```cpp
Buffer a(1000);           // Constructed
Buffer b = a;             // Copy constructed — new allocation, data duplicated
Buffer c = std::move(a);  // Move constructed — c steals a's pointer; a is now empty
// a is now in a valid but empty state — don't use a.data_ after this
```

---

## `= default` and `= delete`

You can tell the compiler to auto-generate or explicitly disable these:

```cpp
class Timer {
public:
    Timer() = default;              // compiler generates default constructor
    ~Timer() = default;             // compiler generates destructor

    Timer(const Timer&) = delete;   // ❌ copying not allowed
    Timer& operator=(const Timer&) = delete;
};

Timer t1;
// Timer t2 = t1;   // ❌ compile error — copy is deleted
```

This is how `std::unique_ptr` works — it's moveable but not copyable.

---

## `explicit` Keyword

Prevents accidental implicit conversions:

```cpp
class Wrapper {
public:
    explicit Wrapper(int x) : val(x) {}
    int val;
};

Wrapper w = 42;      // ❌ compile error — explicit blocks implicit conversion
Wrapper w(42);       // ✅ direct initialisation is fine
Wrapper w = Wrapper(42); // ✅ also fine
```

---

## Summary

```
Constructor   = birth certificate
Destructor    = will & estate cleanup
Copy          = photocopy machine (makes a full duplicate)
Move          = moving house (pick up and relocate, original is emptied)
= delete      = "this operation is illegal"
= default     = "compiler, you write this for me"
```

---

## Next

→ [Inheritance & Polymorphism](./03-inheritance-polymorphism.md)
