import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = "WpsTypesetterPlugin";

export function getDataRoot(): string {
  const base = process.env.APPDATA || process.cwd();
  return join(base, APP_DIR);
}

export async function ensureDataLayout(): Promise<void> {
  const root = getDataRoot();
  await mkdir(root, { recursive: true });
  await mkdir(join(root, "secrets"), { recursive: true });
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  const fullPath = join(getDataRoot(), fileName);
  if (!existsSync(fullPath)) return fallback;
  const content = await readFile(fullPath, "utf8");
  return JSON.parse(content) as T;
}

export async function writeJsonFile<T>(fileName: string, value: T): Promise<void> {
  await ensureDataLayout();
  const fullPath = join(getDataRoot(), fileName);
  await writeFile(fullPath, JSON.stringify(value, null, 2), "utf8");
}

export function resolveSecretPath(name: string): string {
  return join(getDataRoot(), "secrets", `${name}.txt`);
}
