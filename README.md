# AngelFleet 项目文档

AngelFleet 面向使用 1Panel 的 Linux 运维团队。首批计划在 AngelFleetConsole 中交付节点接入、CPU 与内存概览和访问审计。当前已验证 GA-01 契约与样例，双租户真机联调和单租户万节点容量测试待执行。

| 文档 | 阅读目的 |
|---|---|
| [产品 PRD](docs/product-prd.md) | 按用户流程确认试点体验，按 11 个功能域选择范围，逐项核对验收与开放条件。 |
| [技术方案](docs/technical-design.md) | 按组件确定数据归属、命令交付、故障恢复、安全与容量验证。 |
| [节点接入与接口契约](docs/go-agent-interface-contract.md) | 按实际报文实现设备注册、WSS 握手、首次采样与逐指标读回。 |
| [节点操作与权限](docs/operation-ledger.md) | 按操作核对角色、目标、Go 入口、取消边界和真实资源验收。 |
| [研发计划](docs/engineering-roadmap.md) | 查 M1 甘特图，按 35 项工单的角色、依赖、估算与交付证据派工，按阶段决定放行。 |

[文档站首页](https://xcangelwatch.github.io/AngelFleetPRD/) · [原始资料与维护位置](docs/README.md)

## 本地构建

需要 Node.js 22 或更新的兼容版本。

```sh
npm ci
npm run build
npm run check
npm run preview
```

随后访问 `http://localhost:4173`。`npm run check` 检查全部章节、锚点、站内资源、公开引用和关键范围，确保站点与 Markdown 内容一致。

在装有 Python 3 的 macOS 或 Linux 上运行 `npm run offline` 会重新构建、校验并输出 `dist/AngelFleet-docs-v版本-日期.zip`。解压后双击 `index.html` 即可离线阅读、搜索及查看流程图。

## 部署

仓库使用 GitHub Actions 构建并部署到 GitHub Pages。推送 `main` 后，工作流运行 `npm ci`、构建与检查，再发布 `dist/`。仓库的 **Settings → Pages → Source** 应设为 **GitHub Actions**。

站点是纯静态文件，不使用后端服务、用户登录、第三方统计或运行时 CDN。Mermaid 随站点打包；禁用 JavaScript 时仍能阅读正文、表格和流程源码。

## 引用与权利

文档中的 1Panel、Cloudflare 及其他产品名称归其相应权利人所有。引用源码与官方资料均保留原始链接。本仓库未额外授予文档或代码的开源许可；依赖软件遵循其各自许可证。
