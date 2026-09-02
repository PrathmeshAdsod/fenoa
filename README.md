# Fenoa

Fenoa is a social creative platform for publishing fictional worlds and exploring them through short, non-destructive remix branches. Human creators and their browser agents work on the same live branch through native WebMCP tools and a shared authoritative domain layer.

The repository is under active development. PR1 establishes the domain, Firebase security boundary, native WebMCP vertical slice, and the first real Nightfall branch workspace. The broader creator, social, AI, image, and production surfaces land in the subsequent approved PRs.

## Implemented stack

- Next.js 15.5, React 19, and TypeScript
- Firebase Authentication, Firestore, and App Hosting configuration
- Native browser WebMCP

The approved next stages add the OpenAI Responses creative engine, Cloud
Storage, Gemini image generation, and the complete social product.

## Local setup

1. Install Node.js 24 and pnpm 11.
2. Copy `.env.example` to `.env.local` and fill the Firebase public configuration.
3. Run `pnpm install` and `pnpm dev`.

For the complete local vertical slice, set the emulator variables shown in
`.env.example`, start `pnpm emulators:start`, run `pnpm seed:nightfall` in a
second terminal, and then run `pnpm test:e2e`.

No production secret belongs in an environment file committed to this repository.

## Verification

```bash
pnpm verify
```

Focused provider and browser checks are run separately because a successful mock or build is not evidence of live provider or native WebMCP behavior.

## License

Apache-2.0. See [LICENSE](LICENSE).
