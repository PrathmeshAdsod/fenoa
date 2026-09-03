# Fenoa

Fenoa is a social creative platform for publishing fictional worlds and exploring them through short, non-destructive remix branches. Original creators shape a live World Canvas, readers discover published worlds, and remixers develop alternate paths on a Branch Board. Human creators and browser agents use the same authoritative domain operations.

## Implemented stack

- Next.js 15.5, React 19, and TypeScript
- Firebase Authentication, Firestore, Cloud Storage, and App Hosting configuration
- Native browser WebMCP with seven focused semantic tools
- OpenAI Responses structured output with configurable Terra/Luna models
- Gemini-generated world key art with explicit creator action and bounded quotas
- Immutable world and branch revisions, remix-of-remix lineage, likes, profiles, reports, and optional Creator Picks

## Local setup

1. Install Node.js 24 and pnpm 11.
2. Copy `.env.example` to `.env.local` and fill the Firebase public configuration. Add `OPENAI_API_KEY` for live Creative Partner requests. Add `GEMINI_API_KEY` and `FIREBASE_STORAGE_BUCKET` for world artwork generation.
3. Run `pnpm install` and `pnpm dev`.

For the complete local vertical slice, set the emulator variables shown in
`.env.example`, start `pnpm emulators:start`, run `pnpm seed:nightfall` in a
second terminal, and then run `pnpm test:e2e`.

No production secret belongs in an environment file committed to this repository.

## Verification

```bash
pnpm verify
```

Integration tests require the Firebase emulators. Browser tests exercise the real session, persistence, publication, remix lineage, social interactions, realtime Studio synchronization, and native WebMCP registration. Provider checks remain separate because mock tests and builds are not evidence of live model behavior.

## License

Apache-2.0. See [LICENSE](LICENSE).
