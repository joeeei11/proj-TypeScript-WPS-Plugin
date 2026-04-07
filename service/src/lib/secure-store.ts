import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolveSecretPath } from "./storage.js";

async function runPowerShell(script: string, env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell", ["-NoProfile", "-Command", script], {
      env: { ...process.env, ...env },
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `PowerShell exited with ${code}`));
    });
  });
}

async function encryptValue(value: string): Promise<string> {
  const script = "$plain=[Environment]::GetEnvironmentVariable('WPS_TYPES_SECRET','Process'); ConvertTo-SecureString -String $plain -AsPlainText -Force | ConvertFrom-SecureString";
  return runPowerShell(script, { WPS_TYPES_SECRET: value });
}

async function decryptValue(payload: string): Promise<string> {
  const script = "$cipher=[Environment]::GetEnvironmentVariable('WPS_TYPES_SECRET','Process'); $secure=ConvertTo-SecureString $cipher; [System.Net.NetworkCredential]::new('', $secure).Password";
  return runPowerShell(script, { WPS_TYPES_SECRET: payload });
}

export async function saveSecret(name: string, value: string): Promise<string> {
  const encrypted = await encryptValue(value);
  const path = resolveSecretPath(name);
  await writeFile(path, encrypted, "utf8");
  return name;
}

export async function readSecret(name: string): Promise<string | undefined> {
  const path = resolveSecretPath(name);
  if (!existsSync(path)) return undefined;
  const encrypted = await readFile(path, "utf8");
  return decryptValue(encrypted.trim());
}
