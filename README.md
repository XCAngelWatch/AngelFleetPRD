# AngelFleet PRD

1Panel v2 Cloudflare 控制面技术方案与静态文档站。

**在线阅读：[AngelFleet PRD](https://xcangelwatch.github.io/AngelFleetPRD/)**

当前公开版本为设计基线 **2.3（审查基线 2026-11-12）**，于 **2026-11-17** 整理发布。内容覆盖主体章节及附录 A–E，包括 XC React 前端复用、原 Go core/agent 功能迁移、Cloudflare 控制面、可靠任务协议、产品与设备生命周期、单租户 1 万节点验收条件，以及独立选入的系统 OTA / Yocto 扩展。2.3 额外补齐验收 ID 注册表、状态转移唯一权威、A.4/C.1 schema 字段闭环、幂等判定统一、取消副作用单一表示和安全对抗性验收。

文档发布不代表平台功能、节点链路或容量验收已完成。源码审查日期与公开发布时间分开标注；协议参数和目标容量仍以文档中的阶段验收条件为准。

## 阅读与维护

- [完整技术方案](docs/technical-plan.md) 是内容源文件。
- [Go 操作改造台账](docs/operation-ledger.md) 是 P0 起始清单，未标记为已完成。
- [命令状态定义](docs/command-state.json) 是状态图与转移检查使用的机器可读基线。
- [验收 ID 注册表](docs/acceptance-ids.json) 是 AC/FI/CAP/NET/DEV/P6 验收编号的唯一登记来源。
- [站点元数据](docs/site-meta.json) 是版本、审查基线和公开日期的唯一来源。
- [在线文档站](https://xcangelwatch.github.io/AngelFleetPRD/) 支持章节导航、全文搜索、流程图、打印和 Markdown 下载。
- 修改内容时编辑 `docs/technical-plan.md`；网站由构建脚本生成，勿直接修改 `dist/`。
- 更新方案结论时，应同步标明新的代码基线、审查日期和验收证据。发布网页与实施验收应分别记录。

## 本地构建

需要 Node.js 22 或更新的兼容版本。

```sh
npm ci
npm run build
npm run check
npm run preview
```

随后访问 `http://localhost:4173`。`npm run check` 检查全部章节、锚点、站内资源、公开引用和关键范围，确保站点与 Markdown 内容一致。

## 部署

仓库使用 GitHub Actions 构建并部署到 GitHub Pages。推送 `main` 后，工作流运行 `npm ci`、构建与检查，再发布 `dist/`。仓库的 **Settings → Pages → Source** 应设为 **GitHub Actions**。

站点是纯静态文件，不使用后端服务、用户登录、第三方统计或运行时 CDN。Mermaid 随站点打包；禁用 JavaScript 时仍能阅读正文、表格和流程源码。

## 文件结构

```text
docs/technical-plan.md   完整方案内容
src/                    文档站样式与交互
scripts/build.mjs       静态页面与图形资源构建
scripts/check.mjs       发布内容检查
scripts/preview.mjs     本地静态预览
.github/workflows/      GitHub Pages 部署
```

## 引用与权利

文档中的 1Panel、Cloudflare 及其他产品名称归其相应权利人所有。引用源码与官方资料均保留原始链接。本仓库未额外授予文档或代码的开源许可；依赖软件遵循其各自许可证。
