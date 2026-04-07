# WPS 桌面智能排版插件

面向 `WPS 文字` 的本地排版助手，支持：

- 自然语言生成排版方案
- 读取 `DOCX / PDF / Markdown / TXT` 规范文件
- 预览将应用的版式变更
- 本地保存可复用方案
- 接入 OpenAI、DeepSeek、Qwen 和任意 OpenAI-compatible 供应商

## 项目结构

- `panel/`: 任务窗格前端，`React + Vite`
- `service/`: 本地伴随服务，`Fastify + TypeScript`
- `shared/`: 前后端共享类型与规则解析
- `plugin/`: WPS 功能区脚本与图标

## 开发

```bash
npm install
npm run dev
```

- 前端任务窗格：`http://127.0.0.1:5173/panel/index.html`
- 本地服务：`http://127.0.0.1:3210`

## WPS 真机联调

```bash
npm run build:ribbon
npm run wps:install-debug
npm run dev:wps
```

常用命令：

- `npm run wps:doctor`：检查本机 WPS、注册文件和构建产物
- `npm run wps:launch`：直接启动桌面 WPS
- `npm run start:wps`：用构建后的静态页启动可稳定使用的 WPS 运行态
- `npm run wps:remove-debug`：移除本机调试注册

调试注册会把 WPS 在线加载项指向：

- `http://127.0.0.1:3210/plugin/`

其中：

- `ribbon.xml` / `manifest.xml` / `ribbon.js` 由本地服务托管
- 任务窗格页面开发态会重定向到 `Vite 5173`
- 任务窗格接口仍回到本地服务 `3210`

如果只是想稳定使用插件，优先使用 `npm run start:wps`，不要使用 `npm run dev:wps`。

## 构建

```bash
npm run build
```

构建后输出：

- `dist/panel`: 任务窗格前端
- `dist/service`: 本地伴随服务编译结果
- `dist/plugin`: `manifest.xml`、`ribbon.xml`、`ribbon.js`、图标

## WPS 集成建议

1. 启动本地服务，使 `http://127.0.0.1:3210/panel/index.html` 可访问。
2. 将 `dist/plugin` 中的插件清单与脚本接入 WPS 加载项调试链路。
3. 功能区按钮会打开任务窗格，任务窗格再通过本地服务完成规则解析与方案生成。

> 说明：WPS JS API 在不同版本和调试方式下细节会有差异，因此文档应用逻辑采用了保守兼容写法；真机联调时如果某个枚举值与本机不一致，可在 `panel/src/lib/wps.ts` 里微调。

## 测试

```bash
npm run test
```
