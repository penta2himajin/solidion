/**
 * Copy each example's dist/ into public/examples/<name>-app/.
 * Pure Node.js — no external dependencies needed.
 * Runs as site prebuild so CF Pages always has latest example apps.
 */
const { readdirSync, cpSync, existsSync, mkdirSync, statSync } = require("fs");
const { join } = require("path");

const examplesDir = join(__dirname, "..", "..", "examples");
const publicDir = join(__dirname, "..", "public", "examples");

const names = readdirSync(examplesDir).filter((name) => {
  const p = join(examplesDir, name);
  return statSync(p).isDirectory() && existsSync(join(p, "dist"));
});

for (const name of names) {
  const src = join(examplesDir, name, "dist");
  const dest = join(publicDir, `${name}-app`);
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`  synced ${name}/dist/ -> public/examples/${name}-app/`);
}

console.log(`Done (${names.length} examples).`);
