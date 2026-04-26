# Classes, Objects & Access Control

A **class** is a blueprint. An **object** is an instance created from that blueprint. This is the foundation of all C++ OOP.

---

## Defining a Class

```cpp
class Person {
public:                          // accessible from anywhere
    std::string name;
    int age;

    void greet() {
        std::cout << "Hi, I'm " << name << "\n";
    }

private:                         // accessible only inside the class
    int secret_score;

protected:                       // accessible inside + in derived classes
    int internal_id;
};
```

### Creating Objects

```cpp
Person p1;              // on the stack — destroyed when it goes out of scope
p1.name = "Alice";
p1.age  = 30;
p1.greet();             // prints: Hi, I'm Alice

Person* p2 = new Person();   // on the heap — YOU must delete it
p2->name = "Bob";            // use -> for pointer access
delete p2;                   // manual cleanup — easy to forget!
```

> **Key difference from Java/Python**: C++ objects can live on the **stack** (automatic cleanup) or **heap** (manual cleanup). Prefer stack / smart pointers — don't use raw `new` unless necessary.

---

## Access Specifiers

| Specifier   | Accessible from                            |
| ----------- | ------------------------------------------ |
| `public`    | Anywhere                                   |
| `private`   | Only inside the class itself               |
| `protected` | Inside the class + derived (child) classes |

```cpp
class BankAccount {
public:
    void deposit(double amount) {
        balance += amount;      // public method can touch private data
    }

    double get_balance() const {
        return balance;
    }

private:
    double balance = 0.0;       // hidden — callers can't touch this directly
};

BankAccount acc;
acc.deposit(100.0);
// acc.balance = 999.0;        // ❌ compile error — private
double b = acc.get_balance();  // ✅ via public method
```

---

## `struct` vs `class`

They are **identical** in C++ — the only difference is default access:

```cpp
struct Point {       // members are PUBLIC by default
    int x, y;
};

class Point {        // members are PRIVATE by default
    int x, y;
};
```

Convention: use `struct` for plain data holders, `class` for objects with behaviour.

---

## `const` Member Functions

A method marked `const` promises it won't modify the object. Always mark read-only methods `const`:

```cpp
class Circle {
public:
    double area() const {        // const = "I won't change *this"
        return 3.14159 * radius * radius;
    }

    void set_radius(double r) {  // no const — modifies the object
        radius = r;
    }

private:
    double radius = 1.0;
};

const Circle c;
c.area();        // ✅ const method on const object — fine
// c.set_radius(2.0);  // ❌ can't call non-const method on const object
```

---

## `this` Pointer

Inside any non-static method, `this` is a pointer to the current object:

```cpp
class Counter {
public:
    Counter& increment() {
        ++count;
        return *this;           // return reference to self — enables chaining
    }

    int get() const { return count; }

private:
    int count = 0;
};

Counter c;
c.increment().increment().increment();  // chaining works because of return *this
```

---

## Static Members

`static` members belong to the **class**, not any individual object:

```cpp
class Logger {
public:
    static int instance_count;      // shared across all Logger objects

    Logger()  { ++instance_count; }
    ~Logger() { --instance_count; }
};

int Logger::instance_count = 0;     // define outside (required for static data)

Logger a, b, c;
std::cout << Logger::instance_count;  // 3 — class-level access, no object needed
```

---

## Quick Mental Model

```
class = blueprint
object = built house (stack = rented flat, auto-vacated; heap = owned house, you must sell it)
public  = front door (anyone can knock)
private = locked bedroom (only you)
const method = read-only window — you can look but not move furniture
```

---

## Next

→ [Constructors & Destructors](./02-constructors-destructors.md) — how objects are born and die
