# Areas

An **area** is one slice of a repository's tracked source, walked by one sub-agent. Split `git -C <root> ls-files` into areas: one per context when `GLOSSARY-MAP.md` names contexts, else one per app in `docs/STRUCTURE.md`, else one per top-level source folder. Split an area holding more than about 150 source files by its next folder level. Tests belong to the area they test; generated and vendored code belongs to none. The split is done when every tracked source file outside generated and vendored code belongs to exactly one area.
