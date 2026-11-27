# Multiple contexts

A repository that keeps a root `GLOSSARY-MAP.md` holds several contexts. The map lists each context's glossary and how the contexts relate:

```
/
├── GLOSSARY-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── GLOSSARY.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── GLOSSARY.md
│       └── docs/adr/
```

Infer from the map which context the topic belongs to; if it is unclear, ask. A term goes in its context's `GLOSSARY.md`. A decision that binds one context goes in that context's `docs/adr/`, and one that spans contexts in the root `docs/adr/`. When a term crosses contexts, read the map's relationships first, and record a new relationship in the map. Across repositories there is no map: the brain's `contract` notes are the relationships, by [DOMAIN-DOCS.md](DOMAIN-DOCS.md)'s **Where each fact lives**.
