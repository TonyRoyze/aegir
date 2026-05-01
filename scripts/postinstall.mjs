import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const publicDir = join(projectRoot, "public");
const outputTarPath = join(publicDir, "chromium-pack.tar");
const require = createRequire(import.meta.url);

function getChromiumBinDir() {
  const chromiumEntry = require.resolve("@sparticuz/chromium");
  const chromiumRoot = resolve(dirname(chromiumEntry), "..", "..");
  return join(chromiumRoot, "bin");
}

function main() {
  const chromiumBinDir = getChromiumBinDir();

  if (!existsSync(chromiumBinDir)) {
    throw new Error(`Chromium bin directory not found: ${chromiumBinDir}`);
  }

  mkdirSync(publicDir, { recursive: true });

  execFileSync("tar", ["-cf", outputTarPath, "-C", chromiumBinDir, "."], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  console.log(`Created ${outputTarPath}`);
}

main();
