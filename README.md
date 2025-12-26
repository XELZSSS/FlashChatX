![FlashChat X](img/1.png) ![FlashChat X](img/2.png)

## FlashChat X

一个基于跨平台的开源桌面聊天应用

### 功能概览

- 多供应商模型与统一参数面板（API Key/模型/流式/兼容地址/温度等）
- 流式回复与思考展示（思考摘要、token 统计）
- 附件与工具调用（文件读取、可配置权限）
- 对话管理（多会话/搜索/导入导出）
- 搜索增强与 MemU 记忆
- 桌面体验与个性化（托盘/窗口控制/主题/语言/换算工具）
- 清晰错误提示

### 运行方式

1. 安装依赖：`npm i`

2. Web 开发（浏览器）：`npm run dev`

3. Electron 开发：`npm run electron:dev`

4. 构建 Web：`npm run build`

5. 打包 Windows 安装包：`npm run electron:build:win`

### 本地代理（重要）

项目包含一个本地代理服务 `server/proxy.js`（默认端口 `8787`），用于把前端请求转发到各供应商并处理流式 SSE。

- 开发环境：`npm run dev` 会同时启动代理（脚本里包含 `proxy`）
- 打包应用：Electron 主进程会自动启动内置代理，无需手动运行

### 配置与存储

- 应用状态：会话/当前会话/聊天配置/侧边栏状态存于 `localStorage`（`ds_sessions`/`ds_current_session`/`ds_chat_config`/`ds_sidebar_open`）
- 供应商配置：存于 `localStorage`（`ds_provider_config`，按供应商分别保存并记录当前 provider）
- MemU 配置：存于 `localStorage`（`ds_memu_config`）
- `.env.local`：仅开发环境可由本地代理写入（如保存 provider/MemU 配置）；打包应用不会依赖/写入项目根目录的 `.env.local`

### 目录结构

- `App.tsx`：应用装配层（状态装配与渲染）
- `app/`：核心逻辑与 hooks（发送/流式/会话/持久化/派生状态等）
- `components/`：界面组件（侧边栏、输入框、设置弹窗等）
- `services/`：供应商适配、请求管线、工具与配置（通过本地代理）
- `server/proxy/`：本地代理（路由/中间件/供应商）
- `electron/`：Electron 主进程/预加载脚本与打包资源
- `contexts/`：多语言与上下文
- `utils/`：文件解析/流解析等工具
- `workers/`：流式解析 worker

---

## FlashChat X (English)

An open-source cross-platform desktop chat application.

### Feature Overview

- Multi-provider models with unified settings (API key/model/streaming/base URL/temperature)
- Streaming replies and thinking display (summary, token usage)
- Attachments and tool calling (file reading, configurable permissions)
- Chat management (multi-session, search, import/export)
- Search augmentation and MemU memory
- Desktop UX and personalization (tray/window controls/theme/language/calculator)
- Clear error messaging

### How to Run

1. Install dependencies: `npm i`

2. Web dev (browser): `npm run dev`

3. Electron dev: `npm run electron:dev`

4. Build web: `npm run build`

5. Build Windows installer: `npm run electron:build:win`

### Local Proxy (Important)

This project includes a local proxy service `server/proxy.js` (default port `8787`) to forward frontend requests to providers and handle streaming SSE.

- Development: `npm run dev` starts the proxy (script includes `proxy`)
- Packaged app: Electron main process auto-starts the bundled proxy, no manual run needed

### Configuration & Storage

- App state: sessions/current session/chat config/sidebar stored in `localStorage` (`ds_sessions`/`ds_current_session`/`ds_chat_config`/`ds_sidebar_open`)
- Provider config: stored in `localStorage` (`ds_provider_config`, per provider and remembers current provider)
- MemU config: stored in `localStorage` (`ds_memu_config`)
- `.env.local`: dev-only persistence via local proxy (provider/MemU config); packaged app does not rely on or write to project-root `.env.local`

### Project Structure

- `App.tsx`: app assembly layer (state wiring and render)
- `app/`: core logic and hooks (send/stream/sessions/persistence/derived state)
- `components/`: UI components (sidebar, input, settings modal, etc.)
- `services/`: provider adapters, request pipeline, tools, and config (via proxy)
- `server/proxy/`: local proxy (routes/middleware/providers)
- `electron/`: Electron main/preload scripts and build resources
- `contexts/`: i18n and shared contexts
- `utils/`: file/stream parsing utilities
- `workers/`: streaming parser worker
