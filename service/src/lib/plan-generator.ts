import type {
  DocumentSnapshot,
  FormattingChange,
  FormattingPlan,
  FormattingPreset
} from "../../../shared/contracts.js";
import { createId } from "../../../shared/id.js";
import { inferRoleFromParagraph } from "../../../shared/heuristics.js";

function createChange(target: string, action: string, after: string, count: number): FormattingChange {
  return {
    id: createId("change"),
    target,
    action,
    after,
    count
  };
}

function countHeadings(snapshot: DocumentSnapshot | undefined, level: 1 | 2 | 3): number {
  if (!snapshot) return 0;
  return snapshot.paragraphs.filter((paragraph) => inferRoleFromParagraph(paragraph.text, paragraph.outlineLevel) === `heading${level}`).length;
}

export function buildFormattingPlan(
  preset: FormattingPreset,
  snapshot?: DocumentSnapshot
): FormattingPlan {
  const changes: FormattingChange[] = [];
  const warnings = [...preset.unresolvedItems.map((item) => `${item.field}: ${item.reason}`)];

  if (preset.documentRules.paperSize) {
    changes.push(createChange("页面", "设置纸张", preset.documentRules.paperSize, 1));
  }

  if (preset.documentRules.orientation) {
    changes.push(createChange("页面", "设置方向", preset.documentRules.orientation === "portrait" ? "纵向" : "横向", 1));
  }

  const margins = preset.documentRules.marginsCm;
  if (margins && Object.keys(margins).length) {
    const text = Object.entries(margins)
      .map(([key, value]) => `${key}:${value}cm`)
      .join("，");
    changes.push(createChange("页面", "设置页边距", text, 1));
  }

  if (Object.keys(preset.textRules).length || Object.keys(preset.paragraphRules).length) {
    const bodyCount = snapshot?.stats.paragraphCount ?? 0;
    changes.push(
      createChange(
        "正文",
        "应用正文样式",
        [
          preset.textRules.fontFamily ? `字体 ${preset.textRules.fontFamily}` : "",
          preset.textRules.fontSizePt ? `字号 ${preset.textRules.fontSizePt}pt` : "",
          preset.paragraphRules.alignment ? `对齐 ${preset.paragraphRules.alignment}` : ""
        ]
          .filter(Boolean)
          .join("，") || "段落格式调整",
        Math.max(bodyCount - (snapshot?.stats.headingCount ?? 0), 0)
      )
    );
  }

  for (const rule of preset.headingRules) {
    changes.push(
      createChange(
        `标题 ${rule.level}`,
        "应用标题样式",
        [
          rule.text?.fontFamily ? `字体 ${rule.text.fontFamily}` : "",
          rule.text?.fontSizePt ? `字号 ${rule.text.fontSizePt}pt` : "",
          rule.paragraph?.alignment ? `对齐 ${rule.paragraph.alignment}` : ""
        ]
          .filter(Boolean)
          .join("，") || "标题样式调整",
        countHeadings(snapshot, rule.level)
      )
    );
  }

  if (snapshot?.stats.hasTables) {
    warnings.push("当前文档含表格，V1 不会主动调整表格内部样式。");
  }
  if (snapshot?.stats.hasImages) {
    warnings.push("当前文档含图片，V1 不会主动调整图片位置与题注。");
  }
  if (!snapshot?.stats.paragraphCount) {
    warnings.push("尚未获取到文档结构，预览影响范围按规则本身估算。");
  }

  return {
    preset,
    changes,
    warnings,
    unresolvedItems: preset.unresolvedItems,
    estimatedImpact: {
      paragraphs: snapshot?.stats.paragraphCount ?? 0,
      headings: snapshot?.stats.headingCount ?? 0,
      sections: preset.headingRules.length
    }
  };
}
