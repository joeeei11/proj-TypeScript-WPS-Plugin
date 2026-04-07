import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import type { SpecParseResult } from "../../../shared/contracts.js";
import { interpretFormattingText } from "../../../shared/heuristics.js";

function bufferToText(buffer: Buffer): string {
  return buffer.toString("utf8").replace(/\u0000/g, "").trim();
}

export async function parseSpecFile(
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<SpecParseResult> {
  const lower = fileName.toLowerCase();
  let extractedText = "";
  const warnings: string[] = [];

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value.trim();
    warnings.push(...result.messages.map((message) => message.message));
  } else if (lower.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    extractedText = result.text.trim();
    if (!extractedText) warnings.push("PDF 未提取到有效文本，扫描件/OCR 场景暂不支持。");
  } else if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    extractedText = bufferToText(buffer);
  } else {
    extractedText = bufferToText(buffer);
    warnings.push("已按纯文本处理该文件类型。");
  }

  const preset = interpretFormattingText(extractedText, `${fileName} 解析方案`);
  preset.source = "spec";
  preset.confidence = extractedText ? Math.max(0.58, preset.confidence) : 0.2;

  return {
    fileName,
    mimeType,
    extractedText,
    preset,
    warnings
  };
}
