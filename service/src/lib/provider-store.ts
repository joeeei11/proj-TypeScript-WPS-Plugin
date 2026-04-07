import { randomUUID } from "node:crypto";
import type { ModelProviderConfig, ProviderPayload } from "../../../shared/contracts.js";
import { readSecret, saveSecret } from "./secure-store.js";
import { readJsonFile, writeJsonFile } from "./storage.js";

const FILE_NAME = "providers.json";

export async function listProviders(): Promise<ModelProviderConfig[]> {
  const providers = await readJsonFile<ModelProviderConfig[]>(FILE_NAME, []);
  return providers.map((provider) => ({
    ...provider,
    hasApiKey: Boolean(provider.apiKeyRef)
  }));
}

export async function getProvider(providerId: string): Promise<ModelProviderConfig | undefined> {
  const providers = await readJsonFile<ModelProviderConfig[]>(FILE_NAME, []);
  return providers.find((provider) => provider.providerId === providerId);
}

export async function saveProvider(payload: ProviderPayload): Promise<ModelProviderConfig> {
  const providers = await readJsonFile<ModelProviderConfig[]>(FILE_NAME, []);
  const now = new Date().toISOString();
  const providerId = payload.providerId ?? randomUUID();
  const existing = providers.find((provider) => provider.providerId === providerId);
  let apiKeyRef = existing?.apiKeyRef;

  if (payload.apiKey) {
    apiKeyRef = `${providerId}-apikey`;
    await saveSecret(apiKeyRef, payload.apiKey);
  }

  const provider: ModelProviderConfig = {
    providerId,
    name: payload.name,
    providerType: payload.providerType,
    baseUrl: payload.baseUrl,
    model: payload.model,
    apiKeyRef,
    enabled: payload.enabled,
    hasApiKey: Boolean(apiKeyRef),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  const next = existing
    ? providers.map((item) => (item.providerId === providerId ? provider : item))
    : [...providers, provider];

  await writeJsonFile(FILE_NAME, next);
  return provider;
}

export async function getProviderSecret(providerId: string): Promise<string | undefined> {
  const provider = await getProvider(providerId);
  if (!provider?.apiKeyRef) return undefined;
  return readSecret(provider.apiKeyRef);
}
