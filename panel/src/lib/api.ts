import type {
  FormattingPlan,
  FormattingPreset,
  ModelProviderConfig,
  ProviderPayload,
  SpecParseResult
} from "../../../shared/contracts";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => fetch("/api/health").then(parseJson<{ ok: boolean; panelBuilt: boolean; pluginBuilt: boolean }>),
  listProviders: () => fetch("/api/providers").then(parseJson<ModelProviderConfig[]>),
  saveProvider: (payload: ProviderPayload) =>
    fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(parseJson<ModelProviderConfig>),
  testProvider: (payload: ProviderPayload) =>
    fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(parseJson<{ ok: boolean }>),
  parseSpec: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch("/api/specs/parse", {
        method: "POST",
        body: formData
      }).then(parseJson<SpecParseResult>);
  },
  interpret: (payload: { prompt?: string; specText?: string; providerId?: string }) =>
    fetch("/api/format/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(parseJson<FormattingPreset>),
  plan: (payload: { preset: FormattingPreset; documentSnapshot?: unknown }) =>
    fetch("/api/format/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(parseJson<FormattingPlan>),
  listPresets: () => fetch("/api/presets").then(parseJson<FormattingPreset[]>),
  savePreset: (preset: FormattingPreset) =>
    fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset)
      }).then(parseJson<FormattingPreset>)
};
