function getApplication() {
  var hostWindow = window;
  var candidates = [
    hostWindow.Application,
    hostWindow.wps,
    hostWindow.wps && hostWindow.wps.Application,
    hostWindow.wps && hostWindow.wps.WpsApplication,
    hostWindow.parent && hostWindow.parent.Application,
    hostWindow.top && hostWindow.top.Application
  ];
  var i;
  for (i = 0; i < candidates.length; i += 1) {
    if (
      candidates[i] &&
      typeof candidates[i] === "object" &&
      (candidates[i].CreateTaskPane || candidates[i].PluginStorage || candidates[i].ActiveDocument)
    ) {
      return candidates[i];
    }
  }
  return void 0;
}

function ensureRibbonUi(app, ribbonUI) {
  if (typeof app.ribbonUI !== "object") {
    app.ribbonUI = ribbonUI;
  }
}

function resolvePanelUrl() {
  var explicit = window.WPS_FORMATTER_PANEL_URL;
  var origin;
  if (typeof explicit === "string" && explicit) {
    return explicit;
  }
  origin = window.location && window.location.origin ? window.location.origin : "http://127.0.0.1:3210";
  return origin + "/plugin-v5/taskpane.html?v=20260407i";
}

function showFormatterTaskpane() {
  var app = getApplication();
  var taskpaneKey = "wps_formatter_taskpane_id_v5";
  var storage;
  var currentId;
  var existing;
  var taskpane;

  if (!app) {
    alert("未检测到 WPS Application 对象，请在 WPS 加载项环境中运行。");
    return false;
  }

  storage = app.PluginStorage;
  currentId = storage && storage.getItem ? storage.getItem(taskpaneKey) : "";
  if (currentId) {
    existing = app.GetTaskPane ? app.GetTaskPane(currentId) : null;
    if (existing) {
      existing.Visible = true;
      existing.DockPosition = 2;
      existing.Width = 420;
      return true;
    }
  }

  if (!app.CreateTaskPane) {
    alert("当前 WPS 环境不支持 CreateTaskPane。");
    return false;
  }

  taskpane = app.CreateTaskPane(resolvePanelUrl(), "智能排版助手");
  if (!taskpane) {
    alert("任务窗格创建失败，请确认当前 WPS 版本支持 JS 加载项任务窗格。");
    return false;
  }

  if (storage && storage.setItem) {
    storage.setItem(taskpaneKey, String(taskpane.ID));
  }

  taskpane.Visible = true;
  taskpane.Width = 420;
  taskpane.DockPosition = 2;
  return true;
}

function OnAddinLoad(ribbonUI) {
  var app = getApplication();
  if (app) {
    ensureRibbonUi(app, ribbonUI);
  }
  window.ribbonUI = ribbonUI;
  return true;
}

function OnAction(control) {
  if (control.Id === "btnOpenFormatter" || control.Id === "btnAnalyzeFormatter") {
    return showFormatterTaskpane();
  }
  return true;
}

function GetImage(control) {
  if (control.Id === "btnAnalyzeFormatter") {
    return "images/2.svg";
  }
  return "images/3.svg";
}

window.OnAddinLoad = OnAddinLoad;
window.OnAction = OnAction;
window.GetImage = GetImage;
window.ribbon = {
  OnAddinLoad: OnAddinLoad,
  OnAction: OnAction,
  GetImage: GetImage
};
