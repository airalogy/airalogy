import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const args = ["tauri", "build"];

if (forwardedArgs.length > 0) {
  args.push(...forwardedArgs);
} else if (process.platform === "darwin") {
  args.push("--bundles", "app");
}

const result = spawnSync("pnpm", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
