import type {
  Alignment,
  DocumentSnapshot,
  FormattingPreset,
  HeadingRule,
  MarginRule,
  Orientation,
  PaperSize,
  ParagraphRules,
  Role,
  TextRules,
  UnresolvedItem
} from "./contracts.js";
import { createId } from "./id.js";

const FONT_SIZE_MAP: Record<string, number> = {
  "初号": 42,
  "小初": 36,
  "一号": 26,
  "小一": 24,
  "二号": 22,
  "小二": 18,
  "三号": 16,
  "小三": 15,
  "四号": 14,
  "小四": 12,
  "五号": 10.5,
  "小五": 9
};

const ALIGNMENT_PATTERNS: Array<[RegExp, Alignment]> = [
  [/两端对齐|左右对齐/g, "justify"],
  [/分散对齐/g, "distributed"],
  [/居中|居中对齐/g, "center"],
  [/右对齐/g, "right"],
  [/左对齐/g, "left"]
];

const FONT_FAMILIES = ["宋体", "仿宋", "黑体", "楷体", "微软雅黑", "Times New Roman", "Arial"];

function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyPreset(name = "未命名方案"): FormattingPreset {
  const now = nowIso();
  return {
    id: createId("preset"),
    name,
    source: "nl",
    description: "",
    confidence: 0.45,
    documentRules: {},
    paragraphRules: {},
    textRules: {},
    headingRules: [],
    scopeRules: {},
    rawRequirements: [],
    unresolvedItems: [],
    createdAt: now,
    updatedAt: now
  };
}

function normalizeText(input: string): string {
  return input.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function extractFontSize(segment: string): number | undefined {
  for (const [label, pt] of Object.entries(FONT_SIZE_MAP)) {
    if (segment.includes(label)) return pt;
  }
  const numeric = segment.match(/(\d+(?:\.\d+)?)\s*(?:磅|pt)/i);
  return numeric ? Number(numeric[1]) : undefined;
}

function extractFontFamily(segment: string): string | undefined {
  return FONT_FAMILIES.find((font) => segment.includes(font));
}

function extractAlignment(segment: string): Alignment | undefined {
  return ALIGNMENT_PATTERNS.find(([pattern]) => pattern.test(segment))?.[1];
}

function extractIndent(segment: string): number | undefined {
  const match = segment.match(/首行缩进\s*(\d+(?:\.\d+)?)\s*(?:字符|字)/);
  return match ? Number(match[1]) : undefined;
}

function extractLineSpacing(segment: string): ParagraphRules["lineSpacing"] | undefined {
  const multiple = segment.match(/(\d+(?:\.\d+)?)\s*倍行距/);
  if (multiple) return { mode: "multiple", value: Number(multiple[1]) };

  const fixed = segment.match(/固定值\s*(\d+(?:\.\d+)?)\s*(?:磅|pt)/);
  if (fixed) return { mode: "fixed", value: Number(fixed[1]) };

  const exact = segment.match(/行距\s*(\d+(?:\.\d+)?)\s*(?:磅|pt)/);
  if (exact) return { mode: "exact", value: Number(exact[1]) };

  return undefined;
}

function extractSpacing(segment: string): Partial<Pick<ParagraphRules, "spacingBeforePt" | "spacingAfterPt">> {
  const result: Partial<Pick<ParagraphRules, "spacingBeforePt" | "spacingAfterPt">> = {};
  const before = segment.match(/段前\s*(\d+(?:\.\d+)?)\s*(?:磅|pt)/);
  const after = segment.match(/段后\s*(\d+(?:\.\d+)?)\s*(?:磅|pt)/);
  if (before) result.spacingBeforePt = Number(before[1]);
  if (after) result.spacingAfterPt = Number(after[1]);
  return result;
}

function extractMargins(segment: string): MarginRule | undefined {
  const result: MarginRule = {};
  const mappings: Array<[keyof MarginRule, RegExp]> = [
    ["top", /上边距\s*(\d+(?:\.\d+)?)\s*(?:厘米|cm)/],
    ["bottom", /下边距\s*(\d+(?:\.\d+)?)\s*(?:厘米|cm)/],
    ["left", /左边距\s*(\d+(?:\.\d+)?)\s*(?:厘米|cm)/],
    ["right", /右边距\s*(\d+(?:\.\d+)?)\s*(?:厘米|cm)/]
  ];

  for (const [key, regex] of mappings) {
    const match = segment.match(regex);
    if (match) result[key] = Number(match[1]);
  }

  return Object.keys(result).length ? result : undefined;
}

function extractPaperSize(segment: string): PaperSize | undefined {
  if (/A4/i.test(segment)) return "A4";
  if (/A3/i.test(segment)) return "A3";
  if (/Letter/i.test(segment)) return "Letter";
  return undefined;
}

function extractOrientation(segment: string): Orientation | undefined {
  if (segment.includes("横向")) return "landscape";
  if (segment.includes("纵向") || segment.includes("竖向")) return "portrait";
  return undefined;
}

function detectScope(segment: string): Role {
  if (/一级标题|标题1|标题一/.test(segment)) return "heading1";
  if (/二级标题|标题2|标题二/.test(segment)) return "heading2";
  if (/三级标题|标题3|标题三/.test(segment)) return "heading3";
  if (/引用|引文/.test(segment)) return "quote";
  return "body";
}

function applyTextRules(target: TextRules, segment: string): void {
  const fontFamily = extractFontFamily(segment);
  if (fontFamily) target.fontFamily = fontFamily;

  const fontSizePt = extractFontSize(segment);
  if (fontSizePt) target.fontSizePt = fontSizePt;

  if (/加粗/.test(segment)) target.bold = true;
  if (/不加粗|取消加粗/.test(segment)) target.bold = false;
}

function applyParagraphRules(target: ParagraphRules, segment: string): void {
  const alignment = extractAlignment(segment);
  if (alignment) target.alignment = alignment;

  const indent = extractIndent(segment);
  if (indent !== undefined) target.firstLineIndentChars = indent;

  const lineSpacing = extractLineSpacing(segment);
  if (lineSpacing) target.lineSpacing = lineSpacing;

  Object.assign(target, extractSpacing(segment));
}

function upsertHeadingRule(rules: HeadingRule[], level: 1 | 2 | 3): HeadingRule {
  const existing = rules.find((rule) => rule.level === level);
  if (existing) return existing;
  const created: HeadingRule = { level, paragraph: {}, text: {} };
  rules.push(created);
  return created;
}

function collectSegments(input: string): string[] {
  return normalizeText(input)
    .split(/[。\n；;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function interpretFormattingText(input: string, name = "智能排版方案"): FormattingPreset {
  const preset = createEmptyPreset(name);
  const unresolvedItems: UnresolvedItem[] = [];
  const segments = collectSegments(input);

  preset.rawRequirements = segments;
  preset.confidence = segments.length ? 0.72 : 0.3;

  for (const segment of segments) {
    const scope = detectScope(segment);
    const margins = extractMargins(segment);
    if (margins) preset.documentRules.marginsCm = { ...preset.documentRules.marginsCm, ...margins };

    const paperSize = extractPaperSize(segment);
    if (paperSize) preset.documentRules.paperSize = paperSize;

    const orientation = extractOrientation(segment);
    if (orientation) preset.documentRules.orientation = orientation;

    if (scope === "body") {
      applyTextRules(preset.textRules, segment);
      applyParagraphRules(preset.paragraphRules, segment);
      if (/正文/.test(segment)) {
        preset.scopeRules.body ??= { paragraph: {}, text: {} };
        applyTextRules(preset.scopeRules.body.text ??= {}, segment);
        applyParagraphRules(preset.scopeRules.body.paragraph ??= {}, segment);
      }
      if (/引用|引文/.test(segment)) {
        preset.scopeRules.quote ??= { paragraph: {}, text: {} };
        applyTextRules(preset.scopeRules.quote.text ??= {}, segment);
        applyParagraphRules(preset.scopeRules.quote.paragraph ??= {}, segment);
      }
    } else if (scope.startsWith("heading")) {
      const level = Number(scope.replace("heading", "")) as 1 | 2 | 3;
      const rule = upsertHeadingRule(preset.headingRules, level);
      applyTextRules(rule.text ??= {}, segment);
      applyParagraphRules(rule.paragraph ??= {}, segment);
    }

    const hasRecognizedRule =
      Boolean(margins) ||
      Boolean(paperSize) ||
      Boolean(orientation) ||
      Boolean(extractFontFamily(segment)) ||
      Boolean(extractFontSize(segment)) ||
      Boolean(extractAlignment(segment)) ||
      Boolean(extractIndent(segment)) ||
      Boolean(extractLineSpacing(segment)) ||
      /加粗|不加粗|取消加粗/.test(segment);

    if (!hasRecognizedRule) {
      unresolvedItems.push({
        field: "unknown",
        reason: "当前规则未被 V1 解析器识别",
        sourceText: segment
      });
    }
  }

  preset.unresolvedItems = unresolvedItems;
  if (input.length > 160) preset.source = "hybrid";
  preset.updatedAt = nowIso();
  return preset;
}

export function mergePresets(base: FormattingPreset, incoming: FormattingPreset): FormattingPreset {
  const merged = createEmptyPreset(incoming.name || base.name);
  merged.id = base.id;
  merged.source = incoming.source === "nl" && base.source === "spec" ? "hybrid" : incoming.source;
  merged.description = incoming.description || base.description;
  merged.confidence = Math.max(base.confidence, incoming.confidence);
  merged.documentRules = {
    ...base.documentRules,
    ...incoming.documentRules,
    marginsCm: {
      ...base.documentRules.marginsCm,
      ...incoming.documentRules.marginsCm
    }
  };
  merged.paragraphRules = { ...base.paragraphRules, ...incoming.paragraphRules };
  merged.textRules = { ...base.textRules, ...incoming.textRules };
  merged.scopeRules = {
    body: {
      paragraph: {
        ...base.scopeRules.body?.paragraph,
        ...incoming.scopeRules.body?.paragraph
      },
      text: {
        ...base.scopeRules.body?.text,
        ...incoming.scopeRules.body?.text
      }
    },
    quote: {
      paragraph: {
        ...base.scopeRules.quote?.paragraph,
        ...incoming.scopeRules.quote?.paragraph
      },
      text: {
        ...base.scopeRules.quote?.text,
        ...incoming.scopeRules.quote?.text
      }
    }
  };
  merged.headingRules = ([1, 2, 3] as const).flatMap((level) => {
    const previous = base.headingRules.find((rule: HeadingRule) => rule.level === level);
    const next = incoming.headingRules.find((rule: HeadingRule) => rule.level === level);
    if (!previous && !next) return [];
    return [{
      level: level as 1 | 2 | 3,
      paragraph: { ...previous?.paragraph, ...next?.paragraph },
      text: { ...previous?.text, ...next?.text }
    }];
  });
  merged.rawRequirements = [...base.rawRequirements, ...incoming.rawRequirements];
  merged.unresolvedItems = [...base.unresolvedItems, ...incoming.unresolvedItems];
  merged.createdAt = base.createdAt;
  merged.updatedAt = nowIso();
  return merged;
}

export function inferRoleFromParagraph(text: string, outlineLevel?: number): Role {
  if (outlineLevel === 1 || /^第[一二三四五六七八九十]+章|^[一二三四五六七八九十]+、/.test(text)) return "heading1";
  if (outlineLevel === 2 || /^\d+\.\d+/.test(text) || /^[（(]一[)）]/.test(text)) return "heading2";
  if (outlineLevel === 3 || /^\d+\.\d+\.\d+/.test(text) || /^[（(]1[)）]/.test(text)) return "heading3";
  if (/^“.+”|^>.*/.test(text)) return "quote";
  return "body";
}

export function summarizeDocument(snapshot: DocumentSnapshot): string {
  return `${snapshot.documentName ?? "当前文档"}，共 ${snapshot.stats.paragraphCount} 段，标题 ${snapshot.stats.headingCount} 个`;
}
