import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const pluginName = "智能排版助手";
const pluginUrl = "http://127.0.0.1:3210/plugin-v5/";
const addonType = "wps";
const removeMode = process.argv.includes("--remove");
const legacyNames = ["智能排版助手", "智能排版助手 V2", "智能排版助手 V3", "智能排版助手 V4", "智能排版助手 V5", "WPS Formatter", "WPS Formatter V2", "WPS Formatter V3", "WPS Formatter V4", "WPS Formatter V5"];
const legacyUrls = [
  "http://127.0.0.1:3210/plugin/",
  "http://127.0.0.1:3210/plugin-v2/",
  "http://127.0.0.1:3210/plugin-v3/",
  "http://127.0.0.1:3210/plugin-v4/",
  "http://127.0.0.1:3210/plugin-v5/"
];

const jsaddonsDir = join(process.env.APPDATA || "", "kingsoft", "wps", "jsaddons");
const jspluginsPath = join(jsaddonsDir, "jsplugins.xml");
const publishPath = join(jsaddonsDir, "publish.xml");
const backupPath = join(jsaddonsDir, "jsplugins.xml.codex-backup");
const publishBackupPath = join(jsaddonsDir, "publish.xml.codex-backup");

function ensureDir() {
  mkdirSync(jsaddonsDir, { recursive: true });
}

function ensureBackup() {
  if (existsSync(jspluginsPath) && !existsSync(backupPath)) {
    copyFileSync(jspluginsPath, backupPath);
  }

  if (existsSync(publishPath) && !existsSync(publishBackupPath)) {
    copyFileSync(publishPath, publishBackupPath);
  }
}

function pluginNode() {
  return `  <jspluginonline name="${pluginName}" type="${addonType}" url="${pluginUrl}" />`;
}

function publishNode() {
  return `  <jspluginonline name="${pluginName}" type="${addonType}" url="${pluginUrl}" debug="" enable="enable_dev" install="null" customDomain=""/>`;
}

function stripEntries(content) {
  let next = content.replace(/\r/g, "");

  for (const name of legacyNames) {
    next = next.replace(new RegExp(`\\s*<jspluginonline[^>]*name="${name}"[^>]*/>\\s*`, "g"), "\n");
  }

  for (const url of legacyUrls) {
    next = next.replace(new RegExp(`\\s*<jspluginonline[^>]*url="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>\\s*`, "g"), "\n");
  }

  return next.replace(/\n{3,}/g, "\n\n");
}

function buildXml(existingContent, nodeFactory) {
  if (!existingContent.trim()) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<jsplugins>\n${nodeFactory()}\n</jsplugins>\n`;
  }

  const stripped = stripEntries(existingContent);
  if (!stripped.includes("<jsplugins")) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<jsplugins>\n${nodeFactory()}\n</jsplugins>\n`;
  }

  if (removeMode) {
    return stripped;
  }

  if (/<\/jsplugins>/.test(stripped)) {
    return stripped.replace(/<\/jsplugins>/, `${nodeFactory()}\n</jsplugins>`);
  }

  return `${stripped}\n${nodeFactory()}\n`;
}

ensureDir();
ensureBackup();

const current = existsSync(jspluginsPath) ? readFileSync(jspluginsPath, "utf8") : "";
const publishCurrent = existsSync(publishPath) ? readFileSync(publishPath, "utf8") : "";

writeFileSync(jspluginsPath, buildXml(current, pluginNode), "utf8");
writeFileSync(publishPath, buildXml(publishCurrent, publishNode), "utf8");

if (removeMode) {
  console.log(`Removed WPS debug registration from ${jspluginsPath} and ${publishPath}.`);
} else {
  console.log(`Updated WPS debug registration: ${jspluginsPath}`);
  console.log(`Updated WPS publish registration: ${publishPath}`);
  console.log(`Plugin URL: ${pluginUrl}`);
}
