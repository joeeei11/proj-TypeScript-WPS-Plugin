import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

await copyFile(resolve(root, "plugin", "ribbon.js"), resolve(root, "dist", "plugin", "ribbon.js"));
