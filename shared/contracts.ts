export type Alignment = "left" | "center" | "right" | "justify" | "distributed";
export type LineSpacingMode = "multiple" | "exact" | "fixed";
export type PaperSize = "A4" | "A3" | "Letter";
export type Orientation = "portrait" | "landscape";
export type Role = "body" | "heading1" | "heading2" | "heading3" | "quote";

export interface MarginRule {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface DocumentRules {
  paperSize?: PaperSize;
  orientation?: Orientation;
  marginsCm?: MarginRule;
}

export interface LineSpacingRule {
  mode: LineSpacingMode;
  value: number;
}

export interface ParagraphRules {
  alignment?: Alignment;
  firstLineIndentChars?: number;
  lineSpacing?: LineSpacingRule;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
}

export interface TextRules {
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  color?: string;
}

export interface HeadingRule {
  level: 1 | 2 | 3;
  paragraph?: ParagraphRules;
  text?: TextRules;
}

export interface ScopeRules {
  body?: {
    paragraph?: ParagraphRules;
    text?: TextRules;
  };
  quote?: {
    paragraph?: ParagraphRules;
    text?: TextRules;
  };
}

export interface UnresolvedItem {
  field: string;
  reason: string;
  sourceText: string;
}

export interface FormattingPreset {
  id: string;
  name: string;
  source: "nl" | "spec" | "preset" | "hybrid";
  description?: string;
  confidence: number;
  documentRules: DocumentRules;
  paragraphRules: ParagraphRules;
  textRules: TextRules;
  headingRules: HeadingRule[];
  scopeRules: ScopeRules;
  rawRequirements: string[];
  unresolvedItems: UnresolvedItem[];
  createdAt: string;
  updatedAt: string;
}

export interface FormattingChange {
  id: string;
  target: string;
  action: string;
  before?: string;
  after: string;
  count: number;
}

export interface FormattingPlan {
  preset: FormattingPreset;
  changes: FormattingChange[];
  warnings: string[];
  unresolvedItems: UnresolvedItem[];
  estimatedImpact: {
    paragraphs: number;
    headings: number;
    sections: number;
  };
}

export interface ParagraphSnapshot {
  index: number;
  text: string;
  outlineLevel?: number;
  styleName?: string;
  role?: Role;
}

export interface DocumentSnapshot {
  documentName?: string;
  pageCount?: number;
  paragraphs: ParagraphSnapshot[];
  stats: {
    paragraphCount: number;
    headingCount: number;
    wordCount: number;
    hasTables: boolean;
    hasImages: boolean;
  };
}

export interface ModelProviderConfig {
  providerId: string;
  name: string;
  providerType: "openai" | "custom-openai-compatible";
  baseUrl: string;
  model: string;
  apiKeyRef?: string;
  enabled: boolean;
  hasApiKey?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPayload {
  providerId?: string;
  name: string;
  providerType: "openai" | "custom-openai-compatible";
  baseUrl: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
}

export interface InterpretRequest {
  prompt?: string;
  specText?: string;
  providerId?: string;
  documentSnapshot?: DocumentSnapshot;
}

export interface PlanRequest {
  preset: FormattingPreset;
  documentSnapshot?: DocumentSnapshot;
}

export interface SpecParseResult {
  fileName: string;
  mimeType: string;
  extractedText: string;
  preset: FormattingPreset;
  warnings: string[];
}
