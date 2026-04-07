import { copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const outDir = resolve(root, "dist/plugin");
const outDirV2 = resolve(root, "dist/plugin-v2");

const bootstrapHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WPS Formatter Bootstrap</title>
  </head>
  <body>
    <script src="./ribbon.js"></script>
  </body>
</html>
`;

await mkdir(outDir, { recursive: true });
await mkdir(outDirV2, { recursive: true });

await copyFile(resolve(root, "manifest.xml"), resolve(outDir, "manifest.xml"));
await copyFile(resolve(root, "ribbon.xml"), resolve(outDir, "ribbon.xml"));
await copyFile(resolve(outDir, "ribbon.js"), resolve(outDirV2, "ribbon.js"));
await cp(resolve(root, "plugin", "images"), resolve(outDir, "images"), { recursive: true });
await writeFile(resolve(outDir, "index.html"), bootstrapHtml, "utf8");

await copyFile(resolve(root, "manifest.xml"), resolve(outDirV2, "manifest.xml"));
await copyFile(resolve(root, "ribbon.xml"), resolve(outDirV2, "ribbon.xml"));
await cp(resolve(root, "plugin", "images"), resolve(outDirV2, "images"), { recursive: true });
await writeFile(resolve(outDirV2, "index.html"), bootstrapHtml, "utf8");
