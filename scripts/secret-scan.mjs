import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const patterns = [
  "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
  "sk-[A-Za-z0-9_-]{20,}",
  "AIza[0-9A-Za-z_-]{35}",
  "gh[pousr]_[A-Za-z0-9]{20,}",
];

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((file) => file !== "scripts/secret-scan.mjs");

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (new RegExp(pattern).test(content)) {
      console.error(`Potential secret found in ${file}`);
      process.exit(1);
    }
  }
}

console.log(`Secret scan passed for ${files.length} repository files.`);
