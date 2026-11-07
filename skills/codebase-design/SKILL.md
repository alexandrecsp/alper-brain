---
name: codebase-design
description: Deep-module vocabulary and the principles for shaping modules. Use when designing or deepening a module's interface or a contract between repositories, deciding where a seam goes, or making code more testable.
user-invocable: false
metadata:
  type: reference
---

Design **deep modules**: a lot of behaviour behind a small interface, placed at a clean seam, testable through that interface. The aim is leverage for callers, locality for maintainers, and testability for everyone.

## Vocabulary

Use these terms exactly, for architecture. Name the modules themselves in the glossary's terms, from the [domain docs](../model-domain/references/DOMAIN-DOCS.md) of the repository that holds each one ("the Order intake module"). Each term lists the words it replaces, so translate those when you meet them.

**Module**: anything with an interface and an implementation. Deliberately scale-agnostic: a function, class, package, tier-spanning slice, or a whole repository as other repositories see it. _Replaces_: unit, component, service.

**Interface**: everything a caller must know to use the module correctly: the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics. _Replaces_: API, signature, a class's public methods, the `interface` keyword (each names only the type-level surface).

**Implementation**: what's inside a module, its body of code. Say "adapter" when the seam is the topic, "implementation" otherwise: a small adapter can have a large implementation (a Postgres repo), and a large adapter a small one (an in-memory fake).

**Depth**: leverage at the interface, the behaviour a caller (or test) can exercise per unit of interface they learn. A module is **deep** when a lot of behaviour sits behind a small interface, **shallow** when the interface is nearly as complex as the implementation. Depth is measured as leverage, never as implementation lines per interface line, which rewards padding.

**Seam** _(Michael Feathers)_: a place where you can alter behaviour without editing in that place; the location at which a module's interface lives. Where the seam goes is its own design decision, apart from what goes behind it. _Replaces_: boundary (overloaded with DDD's bounded context).

**Adapter**: a concrete thing that satisfies an interface at a seam. It names a role (the slot it fills), not substance (what's inside).

**Port**: an interface at a seam that the module owns and adapters plug into. It is either one the module declares for a dependency it needs (a **driven** port: a repository, a gateway, a clock) or one it offers its callers (a **driving** port). The port takes the shape the module needs, and each adapter maps its technology to that shape.

**Leverage**: what callers get from depth. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge, and verification concentrate in one place: fix once, fixed everywhere.

**Contract**: an interface at a seam between repositories (an API, event, queue or shared schema), recorded as a `contract` note in the brain ([FORMAT.md](../brain/references/FORMAT.md)). The **producer** is the repository whose module sits behind the seam. The **consumers** are callers in other repositories, and they count among the module's callers for leverage and for the deletion test.

## Principles

- **Depth is a property of the interface.** A deep module can be built from small, swappable parts inside; they just stay out of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface; keep the internal ones out of the interface even when tests use them.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. A test that needs to reach past the interface says the module is the wrong shape.
- **One adapter means a hypothetical seam; two adapters mean a real one.** Introduce a seam only where something actually varies across it (typically production and test).
- **A contract is the costliest interface to change.** Its consumers land and deploy on their own schedules, so any change to what crosses the wire ships expand–contract across repositories ([CONTRACT-CHANGE.md](../write-tickets/references/CONTRACT-CHANGE.md)). Name its consumers from the brain's contract notes before shaping it, and prefer a design every current consumer already tolerates.

When shaping an interface, ask: can it have fewer methods, simpler parameters, more complexity hidden inside?

## Designing for testability

1. **Accept dependencies rather than creating them**, at construction, so callers never see them.

   ```typescript
   // Testable: the composition root passes the gateway in once
   class OrderProcessor {
     constructor(private payments: PaymentGateway) {}
     process(order: Order): Receipt {}
   }

   // Hard to test: the module creates its own dependency
   class OrderProcessor {
     process(order: Order): Receipt {
       const gateway = new StripeGateway();
     }
   }
   ```

2. **Return results rather than producing side effects.**

   ```typescript
   // Testable
   function calculateDiscount(cart): Discount {}

   // Hard to test
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Keep the surface small.** Fewer methods mean fewer tests; fewer parameters mean simpler setup.

## Going deeper

- **Classifying a module's dependencies** to decide how each crosses its seam and is tested, as when deepening shallow modules or placing a seam with a remote dependency: [DEEPENING.md](references/DEEPENING.md).
- **When an interface is contested, or is a contract other repositories consume**, design it twice with parallel architect sub-agents: [DESIGN-IT-TWICE.md](references/DESIGN-IT-TWICE.md).
