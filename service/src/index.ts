import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { FastifyReply } from "fastify";
import type { InterpretRequest, PlanRequest, ProviderPayload } from "../../shared/contracts.js";
import { buildFormattingPlan } from "./lib/plan-generator.js";
import { getProvider, getProviderSecret, listProviders, saveProvider } from "./lib/provider-store.js";
import { interpretWithOptionalLlm, pingProvider } from "./lib/llm-gateway.js";
import { listPresets, savePreset } from "./lib/preset-store.js";
import { writeRuntimeLog } from "./lib/runtime-log.js";
import { parseSpecFile } from "./lib/spec-parser.js";
import { ensureDataLayout } from "./lib/storage.js";

const projectRoot = resolve(process.cwd());
const panelDist = join(projectRoot, "dist", "panel");
const pluginDist = join(projectRoot, "dist", "plugin");
const pluginV2Dist = join(projectRoot, "dist", "plugin-v2");
const panelDevServer = process.env.PANEL_DEV_SERVER;

const assetContentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

const app = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024
});

function applyNoCache(reply: FastifyReply): void {
  reply
    .header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    .header("Pragma", "no-cache")
    .header("Expires", "0");
}

function normalizeAssetPath(rawAsset: string | undefined, defaultFile: string): string | null {
  const decoded = decodeURIComponent(rawAsset ?? "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

  const candidate = decoded || defaultFile;
  if (candidate.split("/").some((segment) => segment === "..")) {
    return null;
  }

  return candidate;
}

async function sendAsset(reply: FastifyReply, rootDir: string, assetPath: string): Promise<boolean> {
  const absoluteRoot = resolve(rootDir);
  const absoluteAsset = resolve(rootDir, assetPath);
  const rootPrefix = absoluteRoot.endsWith(sep) ? absoluteRoot : `${absoluteRoot}${sep}`;

  if (absoluteAsset !== absoluteRoot && !absoluteAsset.startsWith(rootPrefix)) {
    reply.code(403).send({ message: "禁止访问该资源。" });
    return true;
  }

  try {
    const content = await readFile(absoluteAsset);
    applyNoCache(reply);
    reply.type(assetContentTypes[extname(absoluteAsset).toLowerCase()] ?? "application/octet-stream").send(content);
    return true;
  } catch {
    return false;
  }
}

async function servePluginAsset(
  reply: FastifyReply,
  rootDir: string,
  rawAsset: string | undefined,
  defaultFile: string
): Promise<void> {
  if (!existsSync(rootDir)) {
    reply.code(503).send({ message: "插件静态资源尚未构建，请先执行 npm run build。" });
    return;
  }

  const normalizedAsset = normalizeAssetPath(rawAsset, defaultFile);
  if (!normalizedAsset) {
    reply.code(400).send({ message: "资源路径不合法。" });
    return;
  }

  const fallbackAsset =
    normalizedAsset === "index.html" && !existsSync(join(rootDir, "index.html")) ? defaultFile : normalizedAsset;

  if (await sendAsset(reply, rootDir, fallbackAsset)) {
    return;
  }

  reply.code(404).send({
    message: `Route GET:/${fallbackAsset} not found`,
    error: "Not Found",
    statusCode: 404
  });
}

await ensureDataLayout();
await mkdir(pluginDist, { recursive: true });
await mkdir(pluginV2Dist, { recursive: true });

await app.register(cors, {
  origin: [/^http:\/\/127\.0\.0\.1(:\d+)?$/, /^http:\/\/localhost(:\d+)?$/]
});

await app.register(multipart);

app.addHook("onRequest", async (request) => {
  const userAgent = request.headers["user-agent"] ?? "-";
  await writeRuntimeLog(`${request.method} ${request.url} UA=${userAgent}`);
});

if (panelDevServer) {
  app.get("/panel", async (_, reply) => {
    reply.redirect(`${panelDevServer}/`);
  });

  app.get("/panel/*", async (request, reply) => {
    const path = String(request.url).replace(/^\/panel/, "");
    reply.redirect(`${panelDevServer}${path || "/"}`);
  });
} else if (existsSync(panelDist)) {
  await app.register(fastifyStatic, {
    root: panelDist,
    prefix: "/panel/",
    setHeaders: (response) => {
      response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Expires", "0");
    }
  });
}

app.get("/api/health", async () => ({
  ok: true,
  panelBuilt: existsSync(panelDist),
  pluginBuilt: existsSync(pluginDist),
  pluginV2Built: existsSync(pluginV2Dist)
}));

app.get("/api/providers", async () => listProviders());

app.post("/api/providers", async (request) => {
  const payload = request.body as ProviderPayload;
  return saveProvider(payload);
});

app.post("/api/providers/test", async (request, reply) => {
  const payload = request.body as ProviderPayload & { providerId?: string };
  const provider = payload.providerId
    ? await getProvider(payload.providerId)
    : {
        providerId: payload.providerId ?? "ad-hoc",
        name: payload.name,
        providerType: payload.providerType,
        baseUrl: payload.baseUrl,
        model: payload.model,
        enabled: payload.enabled,
        apiKeyRef: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

  const apiKey = payload.apiKey ?? (provider?.providerId ? await getProviderSecret(provider.providerId) : undefined);
  if (!provider || !apiKey) {
    reply.code(400);
    return { ok: false, message: "缺少供应商配置或 API Key。" };
  }

  await pingProvider(provider, apiKey);
  return { ok: true };
});

app.post("/api/specs/parse", async (request, reply) => {
  const file = await request.file();
  if (!file) {
    reply.code(400);
    return { message: "未收到规范文件。" };
  }

  const buffer = await file.toBuffer();
  return parseSpecFile(file.filename, file.mimetype, buffer);
});

app.post("/api/format/interpret", async (request, reply) => {
  const body = request.body as InterpretRequest;
  const input = [body.prompt, body.specText].filter(Boolean).join("\n");
  if (!input.trim()) {
    reply.code(400);
    return { message: "请提供自然语言要求或规范文本。" };
  }

  const provider = body.providerId ? await getProvider(body.providerId) : undefined;
  const apiKey = body.providerId ? await getProviderSecret(body.providerId) : undefined;
  return interpretWithOptionalLlm(input, provider, apiKey);
});

app.post("/api/format/plan", async (request) => {
  const body = request.body as PlanRequest;
  return buildFormattingPlan(body.preset, body.documentSnapshot);
});

app.get("/api/presets", async () => listPresets());

app.post("/api/presets", async (request) => {
  return savePreset(request.body as PlanRequest["preset"]);
});

app.put("/api/presets/:id", async (request, reply) => {
  const incoming = request.body as PlanRequest["preset"];
  const params = request.params as { id: string };
  if (incoming.id !== params.id) {
    reply.code(400);
    return { message: "方案 ID 不匹配。" };
  }

  return savePreset(incoming);
});

app.get("/publish.xml", async (_, reply) => {
  reply.type("application/xml").send("");
});

app.get("/plugin", async (_, reply) => {
  reply.redirect("/plugin/");
});

app.get("/plugin/", async (_, reply) => {
  await servePluginAsset(reply, pluginDist, undefined, "taskpane.html");
});

app.get("/plugin/*", async (request, reply) => {
  const asset = (request.params as { "*": string })["*"];
  if (asset === "publish.xml") {
    reply.type("application/xml").send("");
    return;
  }

  await servePluginAsset(reply, pluginDist, asset, "taskpane.html");
});

app.get("/plugin-v2", async (_, reply) => {
  reply.redirect("/plugin-v2/");
});

app.get("/plugin-v2/", async (_, reply) => {
  await servePluginAsset(reply, pluginV2Dist, undefined, "index.html");
});

app.get("/plugin-v2/*", async (request, reply) => {
  const asset = (request.params as { "*": string })["*"];
  if (asset === "publish.xml") {
    reply.type("application/xml").send("");
    return;
  }

  await servePluginAsset(reply, pluginV2Dist, asset, "index.html");
});

app.get("/plugin-v3", async (_, reply) => {
  reply.redirect("/plugin-v3/");
});

app.get("/plugin-v3/", async (_, reply) => {
  await servePluginAsset(reply, pluginV2Dist, undefined, "index.html");
});

app.get("/plugin-v3/*", async (request, reply) => {
  const asset = (request.params as { "*": string })["*"];
  if (asset === "publish.xml") {
    reply.type("application/xml").send("");
    return;
  }

  await servePluginAsset(reply, pluginV2Dist, asset, "index.html");
});

app.get("/plugin-v4", async (_, reply) => {
  reply.redirect("/plugin-v4/");
});

app.get("/plugin-v4/", async (_, reply) => {
  await servePluginAsset(reply, pluginV2Dist, undefined, "index.html");
});

app.get("/plugin-v4/*", async (request, reply) => {
  const asset = (request.params as { "*": string })["*"];
  if (asset === "publish.xml") {
    reply.type("application/xml").send("");
    return;
  }

  await servePluginAsset(reply, pluginV2Dist, asset, "index.html");
});

app.get("/plugin-v5", async (_, reply) => {
  reply.redirect("/plugin-v5/");
});

app.get("/plugin-v5/", async (_, reply) => {
  await servePluginAsset(reply, pluginV2Dist, undefined, "index.html");
});

app.get("/plugin-v5/*", async (request, reply) => {
  const asset = (request.params as { "*": string })["*"];
  if (asset === "publish.xml") {
    reply.type("application/xml").send("");
    return;
  }

  await servePluginAsset(reply, pluginV2Dist, asset, "index.html");
});

app.get("/", async (_, reply) => {
  reply.redirect("/panel/index.html");
});

app.setNotFoundHandler(async (request, reply) => {
  reply.code(404).send({
    message: `Route ${request.method}:${request.url} not found`,
    error: "Not Found",
    statusCode: 404
  });
});

const port = Number(process.env.PORT || 3210);
await app.listen({ port, host: "127.0.0.1" });
