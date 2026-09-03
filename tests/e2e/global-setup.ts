import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export default function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;

  const localEnvironment = readFileSync(".env.local", "utf8");
  const firestoreEmulator = localEnvironment.match(
    /^FIRESTORE_EMULATOR_HOST=(.+)$/m,
  )?.[1];
  if (!firestoreEmulator?.trim()) {
    throw new Error(
      "Local browser tests require FIRESTORE_EMULATOR_HOST in .env.local.",
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
