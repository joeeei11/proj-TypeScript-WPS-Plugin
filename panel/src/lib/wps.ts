import type {
  Alignment,
  DocumentSnapshot,
  FormattingPlan,
  FormattingPreset,
  ParagraphRules,
  ParagraphSnapshot,
  Role,
  TextRules
} from "../../../shared/contracts";
import { inferRoleFromParagraph } from "../../../shared/heuristics";

type MaybeApplication = Record<string, any> | undefined;

type Resolution = {
  app: MaybeApplication;
  source: string;
  diagnostics: string[];
};

function looksLikeApplication(candidate: unknown): candidate is Record<string, any> {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, any>;
  return Boolean(
    value.ActiveDocument ||
    value.CreateTaskPane ||
    value.PluginStorage ||
    value.ApiEvent ||
    value.OAAssist
  );
}

function readCandidate(label: string, getter: () => unknown, diagnostics: string[]): unknown {
  try {
    const value = getter();
    diagnostics.push(`${label}: ${value ? "ok" : "empty"}`);
    return value;
  } catch (error) {
    diagnostics.push(`${label}: error ${(error as Error).message}`);
    return undefined;
  }
}

function resolveApplication(): Resolution {
  const hostWindow = window as any;
  const diagnostics: string[] = [];

  const candidates: Array<{ label: string; value: unknown }> = [
    { label: "window.Application", value: readCandidate("window.Application", () => hostWindow.Application, diagnostics) },
    { label: "globalThis.Application", value: readCandidate("globalThis.Application", () => (globalThis as any).Application, diagnostics) },
    { label: "window.wps", value: readCandidate("window.wps", () => hostWindow.wps, diagnostics) },
    { label: "window.wps.Application", value: readCandidate("window.wps.Application", () => hostWindow.wps?.Application, diagnostics) },
    { label: "window.wps.WpsApplication", value: readCandidate("window.wps.WpsApplication", () => hostWindow.wps?.WpsApplication, diagnostics) },
    { label: "window.parent.Application", value: readCandidate("window.parent.Application", () => hostWindow.parent?.Application, diagnostics) },
    { label: "window.top.Application", value: readCandidate("window.top.Application", () => hostWindow.top?.Application, diagnostics) },
    { label: "window.external.Application", value: readCandidate("window.external.Application", () => hostWindow.external?.Application, diagnostics) }
  ];

  for (const candidate of candidates) {
    if (looksLikeApplication(candidate.value)) {
      return {
        app: candidate.value,
        source: candidate.label,
        diagnostics
      };
    }
  }

  return {
    app: undefined,
    source: "unresolved",
    diagnostics
  };
}

export function getWpsDiagnostics(): string {
  const resolution = resolveApplication();
  const activeDocument = resolution.app?.ActiveDocument;
  const summary = resolution.app
    ? `宿主来源: ${resolution.source}${activeDocument ? "，已连接文档。" : "，但当前没有活动文档。"}`
    : "未检测到 WPS 宿主对象。";

  return `${summary} ${resolution.diagnostics.join(" | ")}`;
}

function ensureApplication(context: "analyze" | "apply"): Record<string, any> {
  const resolution = resolveApplication();
  if (!resolution.app) {
    throw new Error(`未连接到 WPS 宿主，无法${context === "analyze" ? "读取文档" : "应用排版"}。${getWpsDiagnostics()}`);
  }

  return resolution.app;
}

function textFromParagraph(paragraph: any): string {
  return String(paragraph?.Range?.Text ?? paragraph?.Text ?? "")
    .replace(/[\r\u0007]/g, "")
    .trim();
}

function readParagraphs(document: any): ParagraphSnapshot[] {
  const count = Number(document?.Paragraphs?.Count ?? 0);
  const paragraphs: ParagraphSnapshot[] = [];
  const max = Math.min(count, 120);

  for (let index = 1; index <= max; index += 1) {
    const paragraph = document.Paragraphs.Item(index);
    const text = textFromParagraph(paragraph);
    if (!text) continue;

    const outlineLevel = Number(paragraph?.OutlineLevel ?? paragraph?.Range?.ParagraphFormat?.OutlineLevel ?? 10);
    const role = inferRoleFromParagraph(text, Number.isFinite(outlineLevel) ? outlineLevel : undefined);
    paragraphs.push({
      index,
      text,
      outlineLevel,
      styleName: paragraph?.Range?.Style?.NameLocal ?? paragraph?.Range?.Style?.Name,
      role
    });
  }

  return paragraphs;
}

export async function analyzeCurrentDocument(): Promise<DocumentSnapshot> {
  const app = ensureApplication("analyze");
  const document = app.ActiveDocument;
  if (!document) {
    throw new Error(`当前没有打开的 WPS 文字文档。${getWpsDiagnostics()}`);
  }

  const paragraphs = readParagraphs(document);
  const headingCount = paragraphs.filter((item) => item.role?.startsWith("heading")).length;
  const wordCount = paragraphs.reduce((sum, item) => sum + item.text.length, 0);

  return {
    documentName: document.Name ?? "当前文档",
    pageCount: Number(document.BuiltInDocumentProperties?.Item?.("Number of Pages")?.Value ?? 0) || undefined,
    paragraphs,
    stats: {
      paragraphCount: Number(document.Paragraphs?.Count ?? paragraphs.length),
      headingCount,
      wordCount,
      hasTables: Number(document.Tables?.Count ?? 0) > 0,
      hasImages: Number(document.InlineShapes?.Count ?? 0) > 0
    }
  };
}

function applyText(font: any, rules?: TextRules): void {
  if (!font || !rules) return;
  if (rules.fontFamily) {
    font.NameFarEast = rules.fontFamily;
    font.Name = rules.fontFamily;
  }
  if (rules.fontSizePt) font.Size = rules.fontSizePt;
  if (typeof rules.bold === "boolean") font.Bold = rules.bold ? 1 : 0;
  if (rules.color) font.Color = rules.color;
}

function alignmentToWps(alignment: Alignment | undefined): number | undefined {
  if (!alignment) return undefined;

  const map: Record<Alignment, number> = {
    left: 0,
    center: 1,
    right: 2,
    justify: 3,
    distributed: 4
  };

  return map[alignment];
}

function applyParagraph(format: any, rules?: ParagraphRules): void {
  if (!format || !rules) return;

  const alignment = alignmentToWps(rules.alignment);
  if (alignment !== undefined) format.Alignment = alignment;
  if (rules.firstLineIndentChars !== undefined && "CharacterUnitFirstLineIndent" in format) {
    format.CharacterUnitFirstLineIndent = rules.firstLineIndentChars;
  }
  if (rules.spacingBeforePt !== undefined) format.SpaceBefore = rules.spacingBeforePt;
  if (rules.spacingAfterPt !== undefined) format.SpaceAfter = rules.spacingAfterPt;
  if (rules.lineSpacing) {
    format.LineSpacing = rules.lineSpacing.mode === "multiple"
      ? rules.lineSpacing.value * 12
      : rules.lineSpacing.value;
  }
}

function resolveRulesForRole(preset: FormattingPreset, role: Role): { text?: TextRules; paragraph?: ParagraphRules } {
  if (role === "body") {
    return {
      text: { ...preset.textRules, ...preset.scopeRules.body?.text },
      paragraph: { ...preset.paragraphRules, ...preset.scopeRules.body?.paragraph }
    };
  }

  if (role === "quote") {
    return {
      text: { ...preset.textRules, ...preset.scopeRules.quote?.text },
      paragraph: { ...preset.paragraphRules, ...preset.scopeRules.quote?.paragraph }
    };
  }

  const level = Number(role.replace("heading", "")) as 1 | 2 | 3;
  const headingRule = preset.headingRules.find((item) => item.level === level);
  return {
    text: { ...preset.textRules, ...headingRule?.text },
    paragraph: { ...preset.paragraphRules, ...headingRule?.paragraph }
  };
}

function applyPageRules(document: any, preset: FormattingPreset): void {
  const section = document?.Sections?.Item?.(1);
  const pageSetup = section?.PageSetup;
  if (!pageSetup) return;

  if (preset.documentRules.orientation) {
    pageSetup.Orientation = preset.documentRules.orientation === "portrait" ? 0 : 1;
  }

  const margins = preset.documentRules.marginsCm;
  if (margins) {
    const cmToPt = (value: number) => value * 28.35;
    if (margins.top !== undefined) pageSetup.TopMargin = cmToPt(margins.top);
    if (margins.bottom !== undefined) pageSetup.BottomMargin = cmToPt(margins.bottom);
    if (margins.left !== undefined) pageSetup.LeftMargin = cmToPt(margins.left);
    if (margins.right !== undefined) pageSetup.RightMargin = cmToPt(margins.right);
  }
}

export async function applyFormattingPlan(plan: FormattingPlan): Promise<{ ok: boolean; message: string }> {
  const app = ensureApplication("apply");
  const document = app.ActiveDocument;
  if (!document) {
    throw new Error(`当前没有打开的 WPS 文字文档，无法应用排版。${getWpsDiagnostics()}`);
  }

  applyPageRules(document, plan.preset);
  const paragraphCount = Number(document.Paragraphs?.Count ?? 0);

  for (let index = 1; index <= paragraphCount; index += 1) {
    const paragraph = document.Paragraphs.Item(index);
    const text = textFromParagraph(paragraph);
    const role = inferRoleFromParagraph(
      text,
      Number(paragraph?.OutlineLevel ?? paragraph?.Range?.ParagraphFormat?.OutlineLevel)
    );
    const rules = resolveRulesForRole(plan.preset, role);
    applyText(paragraph?.Range?.Font, rules.text);
    applyParagraph(paragraph?.Range?.ParagraphFormat ?? paragraph, rules.paragraph);
  }

  try {
    const selectedRange = app.Selection?.Range;
    if (selectedRange?.Select) {
      selectedRange.Select();
    }
  } catch {
    // Ignore refresh failures; formatting has already been applied.
  }

  return {
    ok: true,
    message: `已将 ${plan.changes.length} 类排版规则应用到当前文档。`
  };
}

export function isWpsRuntime(): boolean {
  return Boolean(resolveApplication().app?.ActiveDocument);
}

export function hasWpsHost(): boolean {
  return Boolean(resolveApplication().app);
}
