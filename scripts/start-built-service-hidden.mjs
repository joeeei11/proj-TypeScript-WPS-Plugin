import { spawn } from "node:child_process";
import { resolve } from "node:path";

const cwd = process.cwd();
const serviceEntry = resolve(cwd, "dist/service/service/src/index.js");

const child = spawn("node", [serviceEntry], {
  cwd,
  detached: true,
  stdio: "ignore",
  windowsHide: true
});

child.unref();

console.log(`已在后台启动构建版本地服务: ${serviceEntry}`);
