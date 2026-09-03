# Fenoa architecture

Fenoa exposes one set of domain capabilities through two interfaces:

```text
Human UI  ─┐
           ├─> typed Domain Client -> Next.js route -> domain service -> Firestore
WebMCP    ─┘

Creative Partner -> creative service -> OpenAI Responses -> validated operations
                                           │
                                           └─> the same domain operations -> Firestore

World Canvas -> explicit image request -> Gemini image output -> Cloud Storage
                                                        │
                                                        └─> version-checked draft reference
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
10. Closing remixes on the root world closes both direct remixes and remix-of-remix creation.

## Publication and lineage

Editable worlds and branches live in owner-only draft documents. Publishing writes a new immutable revision and advances a small public projection to that exact revision. Public pages resolve content through the projection, so unpublished draft changes never leak into discovery.

A direct remix records the source world revision and copies its cast, relationships, facts, and creative constraints into inherited state. A remix of a branch records both the root world revision and exact parent branch revision. Parent documents are never edited by child work. Likes use one server-owned identity per user and branch, while Creator Pick can only be changed by the root world creator.

Active creator and remix studios each use a minimal scoped Firestore listener for the artifact being edited. Server routes remain the only mutation path; there is no active-state polling.

## WebMCP lifecycle

Studio tools are registered only after an owned branch is loaded. The registration receives a page-scoped `AbortController` signal. Navigation, branch changes, logout, and component unmount abort the registration, while each tool callback forwards cancellation to the same domain-client request used by the human controls.

`get_branch_state` is intentionally compact. Agents retrieve a single bounded episode through `get_episode` before using `update_episode`, which requires the episode version returned by that read.

The focused Studio tool set is:

- `get_branch_state`
- `get_episode`
- `update_episode`
- `set_story_constraint`
- `move_episode`
- `add_branch_character`
- `update_branch_rule`

## Creative collaboration

The Creative Partner is an editorial control beside the Branch Board, not a second chat-shaped product. Every response evaluates readiness and returns structured idea notes. There is no minimum or target session length. `Build now` remains available on every turn until the 12-turn safety cap.

The server sends bounded current branch state and recent collaboration history through the OpenAI Responses API. The model and reasoning effort are configurable; production defaults to `gpt-5.6-terra` with medium reasoning. BUILD responses are parsed into at most four typed operations, checked against optimistic versions and locked story constraints, and committed atomically with their activity and undo snapshot. Quotas and a one-request session lease bound cost and concurrency without introducing polling.

The original creator has an equivalent structured collaborator for the World Canvas. Suggestions and challenges remain advisory. BUILD patches are validated against the same world contract used by manual saves, and publishing always stays a separate human action.

## Production configuration

Firebase App Hosting supplies its managed `FIREBASE_CONFIG` and
`FIREBASE_WEBAPP_CONFIG` values. The Admin SDK uses the former directly, while
the Next.js build maps the latter into the public Firebase client bundle. Only
provider credentials are Secret Manager references. Firestore rules and indexes
are deployed independently so a failed application rollout cannot weaken the
data boundary.

The default App Hosting profile scales to zero, caps instances and concurrency,
and leaves the creative model configurable. The repository pins the maintained
Next.js 15.5 security line because current Next.js critical fixes are not issued
for the older 15.2 line listed in App Hosting's support table. This compatibility
exception is explicit and covered by the production build and browser gates.
