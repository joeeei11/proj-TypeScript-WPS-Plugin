import type { FormattingPreset } from "../../../shared/contracts.js";
import { readJsonFile, writeJsonFile } from "./storage.js";

const FILE_NAME = "presets.json";

export async function listPresets(): Promise<FormattingPreset[]> {
  return readJsonFile<FormattingPreset[]>(FILE_NAME, []);
}

export async function savePreset(preset: FormattingPreset): Promise<FormattingPreset> {
  const presets = await listPresets();
  const existing = presets.find((item) => item.id === preset.id);
  const updatedPreset = {
    ...preset,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? preset.createdAt
  };
  const next = existing
    ? presets.map((item) => (item.id === preset.id ? updatedPreset : item))
    : [updatedPreset, ...presets];
  await writeJsonFile(FILE_NAME, next);
  return updatedPreset;
}
