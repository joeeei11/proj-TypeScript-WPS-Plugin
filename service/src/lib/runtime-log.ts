import { appendFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const logDir = resolve(process.cwd(), "logs");
const logFile = join(logDir, "runtime.log");

export async function writeRuntimeLog(line: string): Promise<void> {
  await mkdir(logDir, { recursive: true });
  await appendFile(logFile, `${new Date().toISOString()} ${line}\n`, "utf8");
}
