# Inheritance & Polymorphism

Inheritance lets a class **reuse** another class's code. Polymorphism lets you call the **right version** of a method at runtime even when you only hold a base class pointer.

---

## Basic Inheritance

```cpp
class Animal {
public:
    std::string name;

    Animal(std::string n) : name(n) {}

    void breathe() {
        std::cout << name << " breathes\n";
    }
};

class Dog : public Animal {       // Dog inherits from Animal
public:
    Dog(std::string n) : Animal(n) {}   // call base class constructor

    void bark() {
        std::cout << name << " barks!\n";
    }
};

Dog d("Rex");
d.breathe();   // inherited from Animal
d.bark();      // Dog's own method
```

### Inheritance Access Levels

```cpp
class Derived : public Base    {}; // public    → public stays public
class Derived : protected Base {}; // protected → public becomes protected
class Derived : private Base   {}; // private   → everything becomes private
```

In practice, almost always use `public` inheritance.

---

## Virtual Functions & Polymorphism

Without `virtual`, the method called depends on the **pointer type** (compile-time). With `virtual`, it depends on the **actual object type** (runtime).

```cpp
class Shape {
public:
    // Without virtual — wrong behaviour when called via base pointer
    void draw() {
        std::cout << "Drawing a shape\n";
    }
};

class Circle : public Shape {
public:
    void draw() {
        std::cout << "Drawing a circle\n";
    }
};

Shape* s = new Circle();
s->draw();   // prints "Drawing a shape" ← WRONG! doesn't call Circle's version
```

**Fix: add `virtual`:**

```cpp
class Shape {
public:
    virtual void draw() {        // virtual = "look at the actual object type"
        std::cout << "Drawing a shape\n";
    }

    virtual ~Shape() {}          // ⚠️ always make destructor virtual in base classes!
};

class Circle : public Shape {
public:
    void draw() override {       // override = "I'm replacing the base version"
        std::cout << "Drawing a circle\n";
    }
};

Shape* s = new Circle();
s->draw();   // ✅ prints "Drawing a circle" — correct!
delete s;    // ✅ calls Circle's destructor then Shape's, because of virtual ~Shape()
```

---

## `override` and `final`

```cpp
class Base {
public:
    virtual void process() {}
    virtual void compute() {}
};

class Derived : public Base {
public:
    void process() override {}    // ✅ override confirms you're replacing a virtual
    // void processs() override {}  // ❌ compile error — typo caught at compile time!

    void compute() final {}       // final = no further class can override this
};
```

> Always use `override`. It catches typos and documents intent. Without it, a typo creates a new hidden method instead of overriding.

---

## Pure Virtual / Abstract Classes

A **pure virtual** function (`= 0`) has no implementation in the base class. The class becomes **abstract** — you can't create objects of it directly.

```cpp
class Shape {
public:
    virtual double area() const = 0;     // pure virtual — must be implemented
    virtual void draw() const = 0;

    virtual ~Shape() {}
};

class Circle : public Shape {
public:
    Circle(double r) : radius(r) {}

    double area() const override {
        return 3.14159 * radius * radius;
    }

    void draw() const override {
        std::cout << "○ Circle (r=" << radius << ")\n";
    }

private:
    double radius;
};

class Rectangle : public Shape {
public:
    Rectangle(double w, double h) : width(w), height(h) {}

    double area() const override { return width * height; }
    void draw() const override {
        std::cout << "▭ Rectangle (" << width << "x" << height << ")\n";
    }

private:
    double width, height;
};

// Shape s;   // ❌ compile error — abstract class
Circle c(5.0);
Rectangle r(3.0, 4.0);

// Polymorphism in action:
std::vector<Shape*> shapes = { &c, &r };
for (Shape* s : shapes) {
    s->draw();          // calls the right version at runtime
    std::cout << "Area: " << s->area() << "\n";
}
```

---

## Virtual Destructor — Why It Matters

```cpp
class Base {
public:
    ~Base() { std::cout << "Base destructor\n"; }  // NOT virtual — dangerous!
};

class Derived : public Base {
public:
    int* data = new int[100];
    ~Derived() {
        delete[] data;
        std::cout << "Derived destructor\n";
    }
};

Base* obj = new Derived();
delete obj;   // ❌ Only Base destructor runs! Derived destructor skipped → memory leak
```

**Fix:**

```cpp
class Base {
public:
    virtual ~Base() {}   // ✅ virtual destructor = proper cleanup chain
};
```

> **Rule**: If a class has any `virtual` method, its destructor must also be `virtual`.

---

## Multiple Inheritance

C++ allows inheriting from multiple base classes (unlike Java):

```cpp
class Flyable {
public:
    virtual void fly() = 0;
};

class Swimmable {
public:
    virtual void swim() = 0;
};

class Duck : public Flyable, public Swimmable {
public:
    void fly()  override { std::cout << "Duck flies\n"; }
    void swim() override { std::cout << "Duck swims\n"; }
};
```

In system programming this is mostly used for **interface-like** abstract classes (similar to Java interfaces).

---

## Inheritance vs Composition

Don't overuse inheritance. Prefer **composition** when the relationship is "has-a" not "is-a":

```cpp
// ✅ Composition: Car HAS-A Engine
class Engine { public: void start() {} };
class Car {
    Engine engine;          // member — composition
public:
    void start() { engine.start(); }
};

// ❌ Bad inheritance: Car IS-A Engine? No.
class Car : public Engine {};   // wrong — Car is not a kind of Engine
```

---

## Summary

```
virtual      = "check actual type at runtime"
override     = "I'm replacing a base virtual" (use always!)
final        = "nobody can override this anymore"
= 0          = pure virtual → class becomes abstract (no direct objects)
virtual ~Base() = required for correct destructor chain when using base pointers
```

---

## Next

→ [`std::` Namespace & Standard Library](./04-std-library.md)
