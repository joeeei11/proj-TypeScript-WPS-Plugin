import { describe, expect, it } from "vitest";
import { buildFormattingPlan } from "../service/src/lib/plan-generator";
import { interpretFormattingText } from "../shared/heuristics";

describe("interpretFormattingText", () => {
  it("extracts core body and heading rules from Chinese prompt", () => {
    const preset = interpretFormattingText(
      "正文小四宋体，1.5倍行距，首行缩进2字符；一级标题三号黑体居中；页边距上边距2.54厘米，下边距2.54厘米，左边距3厘米，右边距3厘米。"
    );

    expect(preset.textRules.fontFamily).toBe("宋体");
    expect(preset.textRules.fontSizePt).toBe(12);
    expect(preset.paragraphRules.firstLineIndentChars).toBe(2);
    expect(preset.paragraphRules.lineSpacing?.mode).toBe("multiple");
    expect(preset.headingRules[0]?.text?.fontFamily).toBe("黑体");
    expect(preset.documentRules.marginsCm?.left).toBe(3);
  });
});

describe("buildFormattingPlan", () => {
  it("creates changes and warnings from preset plus document snapshot", () => {
    const preset = interpretFormattingText("正文小四宋体；一级标题三号黑体居中。");
    const plan = buildFormattingPlan(preset, {
      documentName: "测试文档",
      paragraphs: [
        { index: 1, text: "一、总则", role: "heading1" },
        { index: 2, text: "这里是正文内容。", role: "body" }
      ],
      stats: {
        paragraphCount: 2,
        headingCount: 1,
        wordCount: 24,
        hasTables: true,
        hasImages: false
      }
    });

    expect(plan.changes.length).toBeGreaterThan(1);
    expect(plan.estimatedImpact.paragraphs).toBe(2);
    expect(plan.warnings.some((item) => item.includes("表格"))).toBe(true);
  });
});
