# AngelFleet PRD

1Panel v2 Cloudflare 控制面的实施设计。首版保留节点上的 Go core/agent，由新增的 connector 主动连云。

**给 Go、控制台和测试同事分享[三批派工总览](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html#三批派工总览)。** 首批节点接入、后续核心与运维保障覆盖 11 个功能域。每个工作包列出三方任务、前置依赖、权限、人日及验收证据。可直接分享 [GA-04 节点身份](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html#ga-04)、[CORE-04 容器写入](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html#core-04)或 [OPS-02 单库备份恢复](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html#ops-02)。虚拟机另按条件选入。[本轮范围](https://xcangelwatch.github.io/AngelFleetPRD/index.html#section-13-7)

| 阅读目的 | 入口 |
|---|---|
| 确认产品范围、架构、里程碑和当前可领任务 | [主方案](https://xcangelwatch.github.io/AngelFleetPRD/) · [研发计划](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html) |
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
