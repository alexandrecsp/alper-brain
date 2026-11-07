---
name: project-structure
description: Folder layout and file names: the working repository's docs/STRUCTURE.md, else the default hexagonal layout for frontend, backend and full-stack apps. Use when creating, moving or naming a file, starting a project, or recording a repository's layout.
user-invocable: false
metadata:
  type: reference
---

Lay code out as a **hexagon** per module (Ports and Adapters, Cockburn): the domain at the centre, the application around it, infrastructure at the edge. One layout serves every language; only the casing of names changes.

**The repository's own layout comes first.** The session starts in the brain, so name the **working repository** by [FORMAT.md](../brain/references/FORMAT.md)'s working repository rules and read `<root>/docs/STRUCTURE.md` by absolute path: the section of the app you are placing a file in. It is that repository's source of truth and wins over everything below, which fills in only where it is silent. When the repository has none, place the file by the default below and tell the user `/brain setup` records its layout.

## Vocabulary

Use these terms exactly; `port` and `adapter` mean what they mean in `codebase-design`.

- **Module**: a feature-sized slice named by a `GLOSSARY.md` term, holding its own hexagon. Code is grouped by module first, layer second.
- **Domain**: the module's rules: entities, value objects, and the driven ports they need, plus domain events and errors. Pure: no framework, no I/O.
- **Aggregate**: a root entity and the entities and value objects it guards, loaded and saved as one. Each root gets one repository port.
- **Driven port**: an interface the module needs from the outside (a repository, a gateway, a clock, a unit of work). It lives in the domain, so every port has one home.
- **Application**: the module's use cases, the services they share, and the DTOs they take and return.
- **Use case**: the only entry point for one user intent, and the module's **driving port**: adapters call it directly, through no separate interface.
- **Service**: application logic shared by two or more use cases, called only by use cases. A service with one caller folds back into it.
- **DTO**: data shaped to cross a boundary, owned by the side that defines the boundary.
- **Infrastructure**: the adapters, plus the module's wiring. A **driving adapter** turns an outside call (HTTP, CLI, UI event, queue message, framework route) into a use-case call; a **driven adapter** implements a driven port with a technology (Postgres, Stripe, `fetch`, in-memory).
- **Composition root**: the one place per app that wires driven adapters into use cases.
- **Shared kernel**: `shared/`, code every module may use; it imports from no module.

## Layout

```
<module>/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── ports/            ← driven ports
│   ├── events/
│   └── errors/
├── application/
│   ├── use-cases/        ← driving ports
│   ├── services/
│   └── dtos/             ← commands and results
└── infrastructure/
    ├── driving/
    │   └── dtos/         ← requests and responses, with their mappers
    ├── driven/
    │   └── dtos/         ← persistence models and external payloads, with their mappers
    └── config/           ← the module's wiring
```

- **Dependencies point inward**: infrastructure → application → domain. The domain imports only the domain and the shared kernel.
- **Use cases take commands and return results.** Driving adapters map their DTOs to and from these, so they never hold a domain entity. Driven adapters implement domain ports in entity terms and map each entity to and from their own model.
- **Entities and value objects are classes**, in every language, carrying state and behaviour together; interfaces are for ports. The domain holds no DTOs: they live at the boundaries around it.
- **A module's interface is its use cases, application DTOs, and the domain events it publishes.** Another module imports only those, through the module's public entry (`index.ts`, `__init__.py`, the packages [JAVA.md](references/JAVA.md) names).
- **Every driven port has two adapters**: production, and the in-memory one use-case tests run on (`codebase-design`'s "two adapters mean a real one").
- **A folder exists once it holds a file.** A display-only frontend module can be just `infrastructure/driving/`.
- **Tests sit beside the file they test**, where the language allows; use-case tests run at the application seam with in-memory driven adapters.
- **Another repository is a driven port like any other**, named for what the module needs from it (`InvoiceGateway Port`), so it survives that repository being renamed or split. Its adapter is named for the technology (`Http InvoiceGateway Adapter`); a generated client (OpenAPI, protobuf) lives inside that adapter's technology folder, `infrastructure/driven/<technology>/`, and only that adapter imports it. Its in-memory adapter is what lets this repository's milestone test without the other one running.
- **A contract's wire shape lives only in infrastructure DTOs**: the producer's driving `Request` and `Response`, or the `Payload` its driven publisher adapter maps a domain event to; the consumer's driven `Payload`, and the `Listener` that receives an event it consumes. Each is one glob away, so a diff that touches one is a contract change ([CONTRACT-CHANGE.md](../write-tickets/references/CONTRACT-CHANGE.md)).

## Names

Entities and value objects take the plain glossary noun: they are the domain's language. Every other file names its role with a suffix, so its layer reads from a tab title or a search hit, and every role is one glob away.

| Folder | Role suffix | Example |
|---|---|---|
| `domain/entities` | none | Order |
| `domain/value-objects` | none | Money |
| `domain/ports` | Port | OrderRepository Port |
| `domain/events` | Event | OrderPlaced Event |
| `domain/errors` | Error | InsufficientStock Error |
| `application/use-cases` | UseCase | PlaceOrder UseCase |
| `application/services` | Service | Pricing Service |
| `application/dtos` | Command, Query, Result | PlaceOrder Command, Order Result |
| `infrastructure/driving` | the channel: Controller, Listener, Cli, Actions | Order Controller |
| `infrastructure/driving/dtos` | Request, Response | PlaceOrder Request |
| `infrastructure/driven` | Adapter, prefixed by technology | Postgres OrderRepository Adapter |
| `infrastructure/driven/dtos` | Model (persistence), Payload (external API), prefixed by technology | Postgres Order Model |
| any `dtos` | Mapper | Order Mapper |

Each language spells the same name its own way:

- **TypeScript**: kebab-case: [TYPESCRIPT.md](references/TYPESCRIPT.md).
- **Python**: snake_case: [PYTHON.md](references/PYTHON.md).
- **Java**: PascalCase class names, packages for folders: [JAVA.md](references/JAVA.md).

A name the framework reserves (`page.tsx`, `route.ts`, `+page.svelte`) keeps the framework's name: the folder makes it a driving adapter.

## Archetypes

Detect the archetype from the manifests, then read its file:

- **Full-stack**: a framework that serves UI and server code from one app (`next`, `nuxt`, `@remix-run/*`, `@sveltejs/kit`). [FULLSTACK.md](references/FULLSTACK.md).
- **Frontend**: a UI framework with no server of its own (`react`, `vue`, `svelte` with `vite`). [FRONTEND.md](references/FRONTEND.md).
- **Backend**: a server, worker or CLI entry point (`express`, `fastify`, `@nestjs/core`, `spring-boot`, `django`, `fastapi`). [BACKEND.md](references/BACKEND.md).
- **Library**: a package other apps or repositories import, with no entry point of its own (a monorepo's `packages/*`, a published client or contracts package). Its modules keep the hexagon where they hold rules; it has no composition root, and its public entry is its interface. A package of wire types alone is one `dtos/` folder, suffixed as the boundary names them.

A monorepo gets an archetype per app or package (`apps/web` frontend, `apps/api` backend, `packages/contracts` library), each laid out on its own.

## Recording

To write or update a repository's `docs/STRUCTURE.md`, follow [RECORDING.md](references/RECORDING.md).
