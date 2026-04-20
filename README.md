![Language](https://img.shields.io/badge/language-TypeScript-3178c6) ![License](https://img.shields.io/badge/license-MIT-green)

# proj-TypeScript-WPS-Plugin

**WPS Office 工具插件，提供自定义 Ribbon 面板与 AI 辅助文档处理功能。**

## 功能特性

- 自定义 WPS Ribbon 工具栏（ribbon.xml）
- React + TypeScript 侧边栏面板
- AI 文档辅助接口（api.ts）
- 自动化构建脚本（打包、注册、启动）
- wps-doctor 一键配置调试环境

## 快速开始

### 环境要求

- Node.js >= 18
- WPS Office（已安装）

### 安装步骤

```bash
git clone https://github.com/joeeei11/proj-TypeScript-WPS-Plugin.git
cd proj-TypeScript-WPS-Plugin
npm install
npm run register   # 注册到 WPS
npm run dev        # 启动开发模式
```

### 基础用法

```bash
npm run build      # 构建生产版本
```
