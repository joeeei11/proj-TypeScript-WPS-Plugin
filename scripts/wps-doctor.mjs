import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

function findWpsPath() {
  try {
    const output = execSync('reg query "HKCU\\Software\\Kingsoft\\Office\\6.0\\Common" /v InstallRoot', {
      encoding: "utf8"
    });
    const match = output.match(/InstallRoot\s+REG_SZ\s+(.+)/);
    if (!match) return undefined;
    return join(match[1].trim(), "office6", "wps.exe");
  } catch {
    return undefined;
  }
}

const root = process.cwd();
const jspluginsPath = join(process.env.APPDATA || "", "kingsoft", "wps", "jsaddons", "jsplugins.xml");
const publishPath = join(process.env.APPDATA || "", "kingsoft", "wps", "jsaddons", "publish.xml");
const wpsPath = findWpsPath();
const pluginDist = join(root, "dist", "plugin", "ribbon.js");
const panelDist = join(root, "dist", "panel", "index.html");

console.log(`WPS 可执行文件: ${wpsPath && existsSync(wpsPath) ? wpsPath : "未找到"}`);
console.log(`调试注册文件: ${existsSync(jspluginsPath) ? jspluginsPath : "未创建"}`);
console.log(`发布调试文件: ${existsSync(publishPath) ? publishPath : "未创建"}`);
console.log(`插件构建产物: ${existsSync(pluginDist) ? "已存在" : "缺失"}`);
console.log(`面板构建产物: ${existsSync(panelDist) ? "已存在" : "缺失"}`);

if (existsSync(jspluginsPath)) {
  const xml = readFileSync(jspluginsPath, "utf8");
  console.log(`已注册智能排版助手: ${xml.includes("智能排版助手") ? "是" : "否"}`);
  console.log(`已指向本地插件地址: ${xml.includes("http://127.0.0.1:3210/plugin/") ? "是" : "否"}`);
}
if (existsSync(publishPath)) {
  const xml = readFileSync(publishPath, "utf8");
  console.log(`publish.xml 已注册智能排版助手: ${xml.includes("智能排版助手") ? "是" : "否"}`);
  console.log(`publish.xml 已启用 enable_dev: ${xml.includes('enable="enable_dev"') ? "是" : "否"}`);
}
