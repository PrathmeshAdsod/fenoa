# Fenoa

Fenoa is a social creative platform for publishing fictional worlds and exploring them through short, non-destructive remix branches. Original creators shape a live World Canvas, readers discover published worlds, and remixers develop alternate paths on a Branch Board. Human creators and browser agents use the same authoritative domain operations.

## Implemented stack

- Next.js 15.5, React 19, and TypeScript
- Firebase Authentication, Firestore, Cloud Storage, and App Hosting configuration
- Native browser WebMCP with seven focused semantic tools
- OpenAI Responses structured output with configurable Terra/Luna models
- Gemini-generated world key art with explicit creator action and bounded quotas
- Immutable world and branch revisions, remix-of-remix lineage, likes, profiles, reports, and optional Creator Picks

The repository stays on the maintained Next.js 15 line. Firebase App Hosting
[currently lists 15.2.x as its active support line](https://firebase.google.com/docs/app-hosting/frameworks-tooling),
while [current Next.js security releases](https://nextjs.org/blog/august-2026-security-release)
are issued on 15.5.x. Fenoa therefore pins the latest audited 15.5.x patch rather
than shipping a framework line that no longer receives current security fixes.

## Local setup

1. Install Node.js 24 and pnpm 11.
2. Copy `.env.example` to `.env.local` and fill the Firebase public configuration. Add `OPENAI_API_KEY` for live Creative Partner requests. Add `GEMINI_API_KEY` and `FIREBASE_STORAGE_BUCKET` for world artwork generation.
3. Run `pnpm install` and `pnpm dev`.

For the complete local vertical slice, set the emulator variables shown in
`.env.example`, start `pnpm emulators:start`, run `pnpm seed:nightfall` in a
second terminal, and then run `pnpm test:e2e`.

No production secret belongs in an environment file committed to this repository.
App Hosting receives Firebase's public web configuration from its managed
`FIREBASE_WEBAPP_CONFIG`; `next.config.ts` maps that configuration into the
browser bundle without committing the Firebase API key. Provider keys are
referenced from Secret Manager in `apphosting.yaml`.

## Verification

```bash
pnpm verify
```

Integration tests require the Firebase emulators. Browser tests exercise the real session, persistence, publication, remix lineage, social interactions, realtime Studio synchronization, and native WebMCP registration. Provider checks remain separate because mock tests and builds are not evidence of live model behavior.

Firestore rules tests prove that drafts and creative sessions are owner-only,
unpublished revisions stay private, and direct client writes cannot bypass the
server domain layer.

## License

Apache-2.0. See [LICENSE](LICENSE).
