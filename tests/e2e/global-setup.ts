import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export default function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;

  const localEnvironment = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
    : "";
  const firestoreEmulator =
    process.env.FIRESTORE_EMULATOR_HOST ??
    localEnvironment.match(/^FIRESTORE_EMULATOR_HOST=(.+)$/m)?.[1];
  if (!firestoreEmulator?.trim()) {
    throw new Error(
      "Browser tests require FIRESTORE_EMULATOR_HOST in the environment or .env.local.",
    );
  }

  execFileSync(
    process.execPath,
    [
      "--env-file-if-exists=.env.local",
      "--experimental-strip-types",
      "scripts/seed-nightfall.ts",
    ],
    { stdio: "inherit" },
  );
}
