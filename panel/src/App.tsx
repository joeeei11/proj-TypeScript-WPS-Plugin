import { useEffect, useState } from "react";
import type {
  DocumentSnapshot,
  FormattingPlan,
  FormattingPreset,
  ModelProviderConfig,
  ProviderPayload,
  SpecParseResult
} from "../../shared/contracts";
import { createEmptyPreset, mergePresets, summarizeDocument } from "../../shared/heuristics";
import { api } from "./lib/api";
import { analyzeCurrentDocument, applyFormattingPlan, getWpsDiagnostics, hasWpsHost, isWpsRuntime } from "./lib/wps";

type TabKey = "task" | "presets" | "providers";

const providerTemplates: Array<Pick<ProviderPayload, "name" | "providerType" | "baseUrl" | "model" | "enabled">> = [
  {
    name: "OpenAI GPT",
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    enabled: true
  },
  {
    name: "DeepSeek",
    providerType: "custom-openai-compatible",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    enabled: true
  },
  {
    name: "Qwen",
    providerType: "custom-openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    enabled: true
  }
];

function emptyProvider(): ProviderPayload {
  return {
    name: "",
    providerType: "custom-openai-compatible",
    baseUrl: "",
    model: "",
    apiKey: "",
    enabled: true
  };
}

export function App() {
  const [tab, setTab] = useState<TabKey>("task");
  const [providers, setProviders] = useState<ModelProviderConfig[]>([]);
  const [providerDraft, setProviderDraft] = useState<ProviderPayload>(emptyProvider());
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [presets, setPresets] = useState<FormattingPreset[]>([]);
  const [documentSnapshot, setDocumentSnapshot] = useState<DocumentSnapshot | undefined>();
  const [prompt, setPrompt] = useState("正文小四宋体，1.5倍行距，首行缩进2字符；一级标题三号黑体居中；二级标题小三黑体左对齐；页边距上下左右各2.54厘米。");
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [specResult, setSpecResult] = useState<SpecParseResult | null>(null);
  const [workingPreset, setWorkingPreset] = useState<FormattingPreset | null>(null);
  const [plan, setPlan] = useState<FormattingPlan | null>(null);
  const [status, setStatus] = useState("正在连接本地服务…");
  const [busy, setBusy] = useState(false);

  const runtimeLabel = (() => {
    if (isWpsRuntime()) return "WPS 实机环境";
    if (hasWpsHost()) return "WPS 宿主已连接";
    return "浏览器模拟环境";
  })();

  async function refreshMeta() {
    const [providerList, presetList] = await Promise.all([api.listProviders(), api.listPresets()]);
    setProviders(providerList);
    setPresets(presetList);
    if (!selectedProviderId && providerList[0]) setSelectedProviderId(providerList[0].providerId);
  }

  useEffect(() => {
    api.health()
      .then((health) => {
        if (!health.ok) {
          setStatus("本地服务未就绪。");
          return refreshMeta();
        }

        const diagnostics = getWpsDiagnostics();
        setStatus(
          isWpsRuntime()
            ? "本地服务在线，已连接 WPS 文档。"
            : hasWpsHost()
              ? `本地服务在线，已连接 WPS 宿主。${diagnostics}`
              : `本地服务在线，但未检测到 WPS 宿主。${diagnostics}`
        );
        return refreshMeta();
      })
      .catch((error: Error) => {
        setStatus(`无法连接本地服务：${error.message}`);
      });
  }, []);

  async function handleAnalyzeDocument() {
    setBusy(true);
    try {
      const snapshot = await analyzeCurrentDocument();
      setDocumentSnapshot(snapshot);
      setStatus(`已读取文档：${summarizeDocument(snapshot)}`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleParseSpec() {
    if (!specFile) return;
    setBusy(true);
    try {
      const result = await api.parseSpec(specFile);
      setSpecResult(result);
      setWorkingPreset((current) => (current ? mergePresets(result.preset, current) : result.preset));
      setStatus(`已解析规范文件：${result.fileName}`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneratePlan() {
    setBusy(true);
    try {
      let snapshot = documentSnapshot;
      if (!snapshot && isWpsRuntime()) {
        snapshot = await analyzeCurrentDocument();
        setDocumentSnapshot(snapshot);
      }

      const hasSource = Boolean(prompt.trim() || specResult?.extractedText);
      const interpreted = hasSource
        ? await api.interpret({
            prompt: prompt.trim(),
            specText: specResult?.extractedText,
            providerId: selectedProviderId || undefined
          })
        : createEmptyPreset("空方案");

      const combined = specResult ? mergePresets(specResult.preset, interpreted) : interpreted;
      setWorkingPreset(combined);
      const nextPlan = await api.plan({ preset: combined, documentSnapshot: snapshot });
      setPlan(nextPlan);
      setStatus(
        snapshot
          ? "排版方案已生成，可以先预览再应用。"
          : `排版方案已生成，但当前未连接真实文档。${getWpsDiagnostics()}`
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePreset() {
    if (!workingPreset) return;
    setBusy(true);
    try {
      const saved = await api.savePreset(workingPreset);
      setWorkingPreset(saved);
      await refreshMeta();
      setStatus(`方案“${saved.name}”已保存。`);
      setTab("presets");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyPlan() {
    if (!plan) return;
    setBusy(true);
    try {
      const result = await applyFormattingPlan(plan);
      setStatus(result.message);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProvider() {
    setBusy(true);
    try {
      const saved = await api.saveProvider(providerDraft);
      setProviderDraft(emptyProvider());
      await refreshMeta();
      setSelectedProviderId(saved.providerId);
      setStatus(`模型供应商“${saved.name}”已保存。`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTestProvider() {
    setBusy(true);
    try {
      await api.testProvider(providerDraft);
      setStatus("模型供应商连通性验证通过。");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">WPS 文字智能排版助手</p>
          <h1>让规范变成可预览、可复用的排版方案</h1>
        </div>
        <div className="runtime">
          <span>{runtimeLabel}</span>
          <strong>{busy ? "处理中…" : "就绪"}</strong>
        </div>
      </header>

      <section className="status-bar">
        <div>
          <span className="status-dot" />
          {status}
        </div>
        <button className="ghost-button" onClick={handleAnalyzeDocument} disabled={busy}>
          读取当前文档
        </button>
      </section>

      <nav className="tabs">
        {[
          ["task", "排版任务"],
          ["presets", "方案库"],
          ["providers", "模型配置"]
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "tab active" : "tab"}
            onClick={() => setTab(key as TabKey)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "task" && (
        <main className="panel-grid">
          <section className="panel-card command-card">
            <div className="section-head">
              <h2>输入要求</h2>
              <span>自然语言或规范文件</span>
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：正文小四宋体，1.5倍行距，一级标题三号黑体居中。"
            />
            <div className="inline-row">
              <select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}>
                <option value="">只用本地规则解析</option>
                {providers.map((provider) => (
                  <option key={provider.providerId} value={provider.providerId}>
                    {provider.name} / {provider.model}
                  </option>
                ))}
              </select>
              <label className="file-pill">
                上传规范
                <input
                  type="file"
                  accept=".docx,.pdf,.md,.markdown,.txt"
                  onChange={(event) => setSpecFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="action-row">
              <button onClick={handleParseSpec} disabled={!specFile || busy}>
                解析规范文件
              </button>
              <button className="primary-button" onClick={handleGeneratePlan} disabled={busy}>
                生成排版方案
              </button>
            </div>
          </section>

          <section className="panel-card preview-card">
            <div className="section-head">
              <h2>预览与风险</h2>
              <span>应用前建议先保存文档</span>
            </div>
            {documentSnapshot ? (
              <div className="stat-strip">
                <div><strong>{documentSnapshot.stats.paragraphCount}</strong><span>段落</span></div>
                <div><strong>{documentSnapshot.stats.headingCount}</strong><span>标题</span></div>
                <div><strong>{documentSnapshot.stats.wordCount}</strong><span>字数</span></div>
              </div>
            ) : (
              <p className="muted">还没有读取当前文档，影响范围将以估算方式展示。</p>
            )}

            {specResult && (
              <div className="soft-block">
                <strong>{specResult.fileName}</strong>
                <p>{specResult.extractedText.slice(0, 120) || "规范文件未提取到文本。"}</p>
              </div>
            )}

            {plan ? (
              <>
                <div className="change-list">
                  {plan.changes.map((change) => (
                    <article key={change.id} className="change-item">
                      <span>{change.target}</span>
                      <strong>{change.action}</strong>
                      <p>{change.after}</p>
                      <em>预计影响 {change.count} 段/项</em>
                    </article>
                  ))}
                </div>
                {plan.warnings.length > 0 && (
                  <div className="warning-list">
                    {plan.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}
                <div className="action-row">
                  <button onClick={handleSavePreset} disabled={busy || !workingPreset}>
                    保存为方案
                  </button>
                  <button className="primary-button" onClick={handleApplyPlan} disabled={busy}>
                    确认应用
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">输入要求后点击“生成排版方案”，这里会显示规则清单、影响范围和风险提示。</p>
            )}
          </section>
        </main>
      )}

      {tab === "presets" && (
        <section className="panel-card tall-card">
          <div className="section-head">
            <h2>本地方案库</h2>
            <span>解析后的规则可重复使用</span>
          </div>
          {presets.length === 0 ? (
            <p className="muted">还没有保存的排版方案。先在“排版任务”里生成一次方案吧。</p>
          ) : (
            <div className="preset-list">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-item"
                  onClick={async () => {
                    setWorkingPreset(preset);
                    const snapshot = documentSnapshot ?? (await analyzeCurrentDocument());
                    setDocumentSnapshot(snapshot);
                    const nextPlan = await api.plan({ preset, documentSnapshot: snapshot });
                    setPlan(nextPlan);
                    setTab("task");
                    setStatus(`已载入方案：${preset.name}`);
                  }}
                >
                  <div>
                    <strong>{preset.name}</strong>
                    <p>{preset.description || preset.rawRequirements[0] || "已保存的结构化排版方案"}</p>
                  </div>
                  <span>{Math.round(preset.confidence * 100)}%</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "providers" && (
        <section className="panel-card tall-card">
          <div className="section-head">
            <h2>模型供应商</h2>
            <span>支持 OpenAI、DeepSeek、Qwen 与兼容接口</span>
          </div>
          <div className="provider-templates">
            {providerTemplates.map((template) => (
              <button key={template.name} className="ghost-button" onClick={() => setProviderDraft({ ...template, apiKey: "" })}>
                使用 {template.name} 模板
              </button>
            ))}
          </div>
          <div className="form-grid">
            <input
              placeholder="供应商名称"
              value={providerDraft.name}
              onChange={(event) => setProviderDraft({ ...providerDraft, name: event.target.value })}
            />
            <select
              value={providerDraft.providerType}
              onChange={(event) => setProviderDraft({ ...providerDraft, providerType: event.target.value as ProviderPayload["providerType"] })}
            >
              <option value="openai">OpenAI</option>
              <option value="custom-openai-compatible">OpenAI Compatible</option>
            </select>
            <input
              placeholder="Base URL"
              value={providerDraft.baseUrl}
              onChange={(event) => setProviderDraft({ ...providerDraft, baseUrl: event.target.value })}
            />
            <input
              placeholder="模型名"
              value={providerDraft.model}
              onChange={(event) => setProviderDraft({ ...providerDraft, model: event.target.value })}
            />
            <input
              placeholder="API Key"
              type="password"
              value={providerDraft.apiKey}
              onChange={(event) => setProviderDraft({ ...providerDraft, apiKey: event.target.value })}
            />
          </div>
          <div className="action-row">
            <button onClick={handleTestProvider} disabled={busy || !providerDraft.apiKey}>
              测试连接
            </button>
            <button className="primary-button" onClick={handleSaveProvider} disabled={busy || !providerDraft.name || !providerDraft.baseUrl || !providerDraft.model}>
              保存供应商
            </button>
          </div>
          <div className="provider-list">
            {providers.map((provider) => (
              <article key={provider.providerId} className="provider-item">
                <div>
                  <strong>{provider.name}</strong>
                  <p>{provider.baseUrl}</p>
                </div>
                <span>{provider.hasApiKey ? "已配置 Key" : "未配置 Key"}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
