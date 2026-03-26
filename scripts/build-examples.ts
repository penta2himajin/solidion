/**
 * Build all examples and sync their dist/ output to site/public/examples/<name>-app/.
 *
 * Usage:
 *   npx tsx scripts/build-examples.ts          # build + sync
 *   npx tsx scripts/build-examples.ts --sync   # sync only (skip build)
 */

import { execSync } from "child_process";
import { readdirSync, statSync, cpSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const examplesDir = join(root, "examples");
const sitePublic = join(root, "site", "public", "examples");

const syncOnly = process.argv.includes("--sync");

const examples = readdirSync(examplesDir).filter((name) => {
  const p = join(examplesDir, name);
  return statSync(p).isDirectory() && existsSync(join(p, "package.json"));
});

for (const name of examples) {
  const dir = join(examplesDir, name);

  if (!syncOnly) {
    console.log(`\n=== Building ${name} ===`);
    execSync("npm install", { cwd: dir, stdio: "inherit" });
    execSync("npx vite build", { cwd: dir, stdio: "inherit" });
  }

  const distDir = join(dir, "dist");
  const targetDir = join(sitePublic, `${name}-app`);

  if (existsSync(distDir)) {
    console.log(`  -> Syncing ${name}/dist/ to site/public/examples/${name}-app/`);
    mkdirSync(targetDir, { recursive: true });
    cpSync(distDir, targetDir, { recursive: true });
  } else {
    console.warn(`  !! ${name}/dist/ not found, skipping sync`);
  }
}

console.log("\nDone.");
