Mock only what the test can't run in-process:

- Another repository's interface, even one this brain registers: by [CONTRACTS.md](CONTRACTS.md)
- Third-party APIs (payment, email)
- Time and randomness
- Databases and the file system, when no local stand-in exists (prefer a test database or an in-memory filesystem)

Everything inside the working repository, your own modules and their internal collaborators, runs for real in the test.

## Designing a mocked dependency

Inject each mocked dependency rather than creating it inside, as the `codebase-design` skill's testability rules describe. Then give it an **SDK-style interface**: one function per external operation, rather than one generic fetcher.

```typescript
// GOOD: each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: the mock needs conditional logic to answer each endpoint
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

With the SDK style, each mock returns one specific shape, test setup carries no conditional logic, each test shows which endpoints it exercises, and each endpoint keeps its own types.
