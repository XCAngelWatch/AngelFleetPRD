# AngelFleet PRD

AngelFleet 在云端控制台集中管理选定的 1Panel 运维能力。首批验收节点接入、CPU 与内存概览及审计。Linux 节点继续复用现有 Go core/agent。

**[产品 PRD](https://xcangelwatch.github.io/AngelFleetPRD/product-prd.html) · [本期功能导图](https://xcangelwatch.github.io/AngelFleetPRD/1panel-feature-map.html) · [首批排期与甘特图](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html#m1-排期与甘特图) · [三批派工总览](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html#三批派工总览)**

| 阅读目的 | 入口 |
|---|---|
| 确认首批交付与延期范围 | [产品 PRD](docs/product-prd.md) |
| 确认架构、里程碑和当前可领任务 | [主方案](https://xcangelwatch.github.io/AngelFleetPRD/) · [研发计划](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html) |
| 实现调用链、核对注册、建连与采样报文 | [技术详细设计](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html) · [节点契约](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-interface-contract.html) |
| 查 Go 入口、核对操作范围、登记真机证据 | [Go 操作台账](https://xcangelwatch.github.io/AngelFleetPRD/operation-ledger.html) · [联调验收记录](https://xcangelwatch.github.io/AngelFleetPRD/implementation-review.html) |

维护者按[文档目录](docs/README.md)定位要修改的源文件。网页、全文搜索、Markdown 下载和打印视图共用同一份正文。

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

## 引用与权利

文档中的 1Panel、Cloudflare 及其他产品名称归其相应权利人所有。引用源码与官方资料均保留原始链接。本仓库未额外授予文档或代码的开源许可；依赖软件遵循其各自许可证。
