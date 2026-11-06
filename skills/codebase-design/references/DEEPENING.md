How to deepen a cluster of shallow modules safely, given its dependencies.

## Dependency categories

Classify each dependency of the candidate. The category decides how the deepened module is tested across its seam.

1. **In-process**: pure computation, in-memory state, no I/O. Always deepenable: merge the modules and test through the new interface directly, with no adapter.
2. **Local-substitutable**: dependencies with a local test stand-in (PGLite for Postgres, an in-memory filesystem). Deepenable when the stand-in exists: the tests run it, and the seam stays internal, with no port at the module's interface.
3. **Remote but owned**: your own services across a network, most often another repository in the brain. Apply Ports and Adapters: define a **port** at the seam, keep the logic in the deep module, and inject the transport as an adapter: in-memory for tests, HTTP, gRPC or a queue for production. When the other side is a registered repository, its `contract` note fixes what crosses the wire: the port takes whatever shape this module needs, the production adapter maps it to the contract, and the in-memory adapter keeps to the contract's shapes and error modes. Only a change to the contract itself is a contract change ([CONTRACT-CHANGE.md](../../to-tickets/references/CONTRACT-CHANGE.md)).
4. **True external**: third-party services you don't control (Stripe, Twilio). The deepened module takes the dependency as an injected port, and tests provide a mock adapter.

## Testing: replace, don't layer

- Write the new tests at the deepened module's interface, asserting observable outcomes.
- Delete the old unit tests on the shallow modules once those tests exist; they now test past the interface.
