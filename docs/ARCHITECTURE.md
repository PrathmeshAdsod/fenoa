# Fenoa architecture

Fenoa exposes one set of domain capabilities through two interfaces:

```text
Human UI  ─┐
           ├─> typed Domain Client -> Next.js route -> domain service -> Firestore
WebMCP    ─┘
```

React components and WebMCP callbacks do not implement independent database mutations. The server derives identity from a verified Firebase session, validates inputs with Zod, enforces ownership and creative constraints, checks optimistic versions, and then performs transactional writes.

## Core invariants

1. Child remixes never mutate parent worlds or branches.
2. Published revisions are immutable and inheritance references exact revisions.
3. Human UI and native WebMCP use the same typed domain operations.
4. Direct client writes are denied; Firestore client access is limited to authorized realtime reads.
5. Active Studio state uses scoped listeners with cleanup, never polling.
6. Episode narrative rewrites declare structured effects so typed locks can be enforced.
7. AI output is untrusted structured input until server validation succeeds.
8. Publishing remains an explicit human action and is never exposed through WebMCP.
9. Provider failure is visible; the product never substitutes fixture output for a live result.

## WebMCP lifecycle

Studio tools are registered only after an owned branch is loaded. The registration receives a page-scoped `AbortController` signal. Navigation, branch changes, logout, and component unmount abort the registration, while each tool callback forwards cancellation to the same domain-client request used by the human controls.

`get_branch_state` is intentionally compact. Agents retrieve a single bounded episode through `get_episode` before using `update_episode`, which requires the episode version returned by that read.
