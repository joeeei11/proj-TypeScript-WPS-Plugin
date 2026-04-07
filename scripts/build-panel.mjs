import { build } from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const panelOutdir = resolve(root, "dist/panel");
const pluginOutdir = resolve(root, "dist/plugin");
const pluginV2Outdir = resolve(root, "dist/plugin-v2");

await mkdir(panelOutdir, { recursive: true });
await mkdir(pluginOutdir, { recursive: true });
await mkdir(pluginV2Outdir, { recursive: true });

await build({
  entryPoints: [resolve(root, "panel/src/main.tsx")],
  bundle: true,
  outfile: resolve(panelOutdir, "index.js"),
  platform: "browser",
  format: "iife",
  target: ["chrome58"],
  jsx: "automatic",
  loader: {
    ".css": "css"
  },
  define: {
    "process.env.NODE_ENV": "\"production\""
  }
});

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WPS Formatter</title>
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="./index.css" />
    <style>
      #boot-status {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: linear-gradient(180deg, #f7f1e7, #efe4d3);
        color: #4a3920;
        font-family: "Microsoft YaHei UI", sans-serif;
        text-align: center;
        z-index: 9999;
      }

      #boot-status .card {
        max-width: 320px;
        padding: 18px 20px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(111, 82, 48, 0.14);
        box-shadow: 0 12px 30px rgba(73, 54, 26, 0.12);
      }

      #boot-status.hidden {
        display: none;
      }

      #boot-status strong {
        display: block;
        margin-bottom: 8px;
        font-size: 16px;
      }

      #boot-status p {
        margin: 0;
        line-height: 1.6;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div id="boot-status">
      <div class="card">
        <strong>Loading formatter panel</strong>
        <p id="boot-message">Loading panel assets, please wait.</p>
      </div>
    </div>
    <div id="root"></div>
    <script>
      (function () {
        var statusEl = document.getElementById("boot-status");
        var messageEl = document.getElementById("boot-message");

        window.__WPS_PANEL_BOOTED__ = false;
        window.__hideBootStatus = function () {
          window.__WPS_PANEL_BOOTED__ = true;
          if (statusEl) {
            statusEl.className = "hidden";
          }
        };

        window.onerror = function (message) {
          if (messageEl) {
            messageEl.innerText = "Panel bootstrap failed: " + String(message || "unknown error");
          }
          return false;
        };

        setTimeout(function () {
          if (!window.__WPS_PANEL_BOOTED__ && messageEl) {
            messageEl.innerText = "Loading is taking longer than expected. Reopen the task pane after restarting WPS.";
          }
        }, 4000);
      })();
    </script>
    <script src="./index.js"></script>
  </body>
</html>
`;

await writeFile(resolve(panelOutdir, "index.html"), html, "utf8");
await copyFile(resolve(panelOutdir, "index.js"), resolve(pluginOutdir, "panel.js"));
await copyFile(resolve(panelOutdir, "index.css"), resolve(pluginOutdir, "panel.css"));
await copyFile(resolve(panelOutdir, "index.js"), resolve(pluginV2Outdir, "panel.js"));
await copyFile(resolve(panelOutdir, "index.css"), resolve(pluginV2Outdir, "panel.css"));

const pluginTaskpaneHtml = html
  .replace(/href="\.\/index\.css"/g, 'href="./panel.css"')
  .replace(/src="\.\/index\.js"/g, 'src="./panel.js"');

await writeFile(resolve(pluginOutdir, "taskpane.html"), pluginTaskpaneHtml, "utf8");
await writeFile(resolve(pluginV2Outdir, "taskpane.html"), pluginTaskpaneHtml, "utf8");
await writeFile(resolve(pluginV2Outdir, "index.html"), pluginTaskpaneHtml, "utf8");
