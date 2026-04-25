import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const cli = resolve(root, "bin", "contextos.js");
const kb = "retail-platform";

rmSync(resolve(process.env.CONTEXTOS_HOME ?? resolve(process.env.HOME ?? ".", ".contextos"), "kbs", kb), { recursive: true, force: true });

run(["init", kb]);
run(["repos", "add", kb, "samples/retail-platform/order-service"]);
run(["repos", "add", kb, "samples/retail-platform/billing-service"]);
run(["repos", "add", kb, "samples/retail-platform/notification-service"]);
run(["update", kb, "--verbose"]);
run(["docs", "generate", kb, "--force"]);
run(["ask", kb, "What is impacted if I change refund eligibility logic?", "--with-docs"]);

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
