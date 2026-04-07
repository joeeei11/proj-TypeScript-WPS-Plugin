import OpenAI from "openai";
import { createEmptyPreset, interpretFormattingText, mergePresets } from "../../../shared/heuristics.js";
import type { FormattingPreset, ModelProviderConfig } from "../../../shared/contracts.js";

function extractJson(content: string): string {
  const fenced = content.match(/```json\s*([\s\S]+?)```/i);
  if (fenced) return fenced[1].trim();
  return content.trim();
}

function sanitizePreset(candidate: Partial<FormattingPreset>, fallbackName: string): FormattingPreset {
  const preset = createEmptyPreset(candidate.name || fallbackName);
  return {
    ...preset,
    ...candidate,
    id: preset.id,
    source: "hybrid",
    createdAt: preset.createdAt,
    updatedAt: new Date().toISOString()
  };
}

export async function interpretWithOptionalLlm(
  input: string,
  provider: ModelProviderConfig | undefined,
  apiKey: string | undefined
): Promise<FormattingPreset> {
  const heuristic = interpretFormattingText(input);
  if (!provider || !apiKey) return heuristic;

  const client = new OpenAI({
    apiKey,
    baseURL: provider.baseUrl
  });

  const completion = await client.chat.completions.create({
    model: provider.model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "你是中文文档排版规则提取器。请只输出 JSON，对用户要求进行结构化归纳。不要输出解释。"
      },
      {
        role: "user",
        content: [
          "请将下面的排版要求转成 JSON，字段包括：",
          "name, description, confidence, documentRules, paragraphRules, textRules, headingRules, scopeRules, unresolvedItems, rawRequirements。",
          "headingRules 只允许 level 1-3。",
          "字体字号请转成具体值，例如小四=12。",
          "要求如下：",
          input
        ].join("\n")
      }
    ]
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return heuristic;

  try {
    const parsed = JSON.parse(extractJson(content)) as Partial<FormattingPreset>;
    const llmPreset = sanitizePreset(parsed, heuristic.name);
    return mergePresets(heuristic, llmPreset);
  } catch {
    return heuristic;
  }
}

export async function pingProvider(provider: ModelProviderConfig, apiKey: string): Promise<void> {
  const client = new OpenAI({
    apiKey,
    baseURL: provider.baseUrl
  });

  await client.chat.completions.create({
    model: provider.model,
    temperature: 0,
    messages: [
      { role: "system", content: "Reply with OK only." },
      { role: "user", content: "ping" }
    ]
  });
}
