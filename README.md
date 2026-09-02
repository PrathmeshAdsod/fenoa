# Fenoa

Fenoa is a social creative platform for publishing fictional worlds and exploring them through short, non-destructive remix branches. Human creators and their browser agents work on the same live branch through native WebMCP tools and a shared authoritative domain layer.

The repository is under active development. The current Remix Studio provides a transactional Branch Board, structured constraints, bounded undo, a native WebMCP tool set, and an OpenAI Responses creative collaborator. Creator, discovery, social, image, and production surfaces land in the remaining approved stages.

## Implemented stack

- Next.js 15.5, React 19, and TypeScript
- Firebase Authentication, Firestore, and App Hosting configuration
- Native browser WebMCP with seven focused semantic tools
- OpenAI Responses structured output with configurable Terra/Luna models

The approved next stages add Cloud Storage, Gemini image generation, and the complete social product.

## Local setup

1. Install Node.js 24 and pnpm 11.
2. Copy `.env.example` to `.env.local`, fill the Firebase public configuration, and add `OPENAI_API_KEY` for live Creative Partner requests.
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
