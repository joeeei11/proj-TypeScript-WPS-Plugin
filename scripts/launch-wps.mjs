import { execSync, spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

function findWpsPath() {
  const output = execSync('reg query "HKCU\\Software\\Kingsoft\\Office\\6.0\\Common" /v InstallRoot', {
    encoding: "utf8"
  });
  const match = output.match(/InstallRoot\s+REG_SZ\s+(.+)/);
  if (!match) {
    throw new Error("未找到 WPS 安装路径。");
  }
  const candidate = join(match[1].trim(), "office6", "wps.exe");
  if (!existsSync(candidate)) {
    throw new Error(`WPS 可执行文件不存在: ${candidate}`);
  }
  return candidate;
}

const wpsPath = findWpsPath();
const targetArg = process.argv[2] ? resolve(process.argv[2]) : undefined;
const args = targetArg ? [targetArg] : [];

spawn(wpsPath, args, {
  detached: true,
  stdio: "ignore"
}).unref();

console.log(targetArg ? `已启动 WPS 并尝试打开: ${targetArg}` : "已启动 WPS。");
