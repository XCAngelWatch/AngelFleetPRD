# AngelFleet PRD 文档目录

这是公开 PRD 的结果目录。修改源文件后运行 `npm run build`，生成结果统一写入 `dist/`；不要直接编辑 `dist/`。

向研发或测试同事分享工作包时，直接发送[研发计划阅读页](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html)。页面间可以跳转到对应设计、Go 台账、接口契约和联调验收记录。

| 文件 | 用途 | 权威性 |
|---|---|---|
| [technical-plan.md](technical-plan.md) | 完整 15 章与 A–E 附录；设计决策、迁移范围和验收摘要 | 主文档 |
| [technical-design.md](technical-design.md) | 1Panel 固定提交的源码入口、节点采样、命令执行与结果对账、联调场景 | 源码事实链接到对应提交，目标契约与验收条件沿用主方案 |
| [go-agent-development-plan.md](go-agent-development-plan.md) | 三仓库基线、节点端任务、里程碑、依赖和人日估算 | Go Agent 开发派工与验收计划 |
| [go-agent-interface-contract.md](go-agent-interface-contract.md) | GA-01 的代码仓库与目录、节点注册、建连与首次采样接口 | Go 与控制台联调契约；[JSON 示例](examples/go-agent-first-sample.json)关联完整请求、响应与消息 |
| [spaces/implementation-review.md](spaces/implementation-review.md) | 工程协作页的 GitHub 版本，按工作包整理实施边界与验收证据 | 开发与测试的评审工作页 |
| `platform-constraints.md` | Cloudflare Workers、D1、DO、Queues、R2 的平台约束快照和官方来源 | 平台数字唯一集中来源 |
| `angelfleetprd-threat-model.md` | 当前静态发布链与目标控制面的威胁模型 | 安全设计输入，非运行证明 |
| `command-state.json` | 命令状态集合和 39 条允许转移 | 状态机唯一机器来源 |
| `acceptance-ids.json` | AC/FI/CAP/NET/DEV/P6 验收编号注册表 | 验收编号唯一机器来源 |
| [operation-ledger.md](operation-ledger.md) | Go 操作入口、适配边界和验收证据台账 | P0 起始台账 |
| `site-meta.json` | 版本、发布状态和构建元数据 | 站点元数据唯一来源 |

## 发布结果目录

`dist/` 是 GitHub Pages 的唯一发布目录，由构建脚本生成，包含：

- `index.html`、`technical-design.html`、`go-agent-development-plan.html`、`go-agent-interface-contract.html`、`operation-ledger.html`、`implementation-review.html` 为六份文档的阅读页。
- `technical-plan.md`、`technical-design.md`、`operation-ledger.md`、`platform-constraints.md`、`angelfleetprd-threat-model.md`：可下载的源文档副本。
- `go-agent-development-plan.md` 和 `spaces/implementation-review.md` 保留源目录结构，便于从开发任务跳转到验收记录。
- `go-agent-interface-contract.md` 和 `examples/go-agent-first-sample.json` 可从节点接口契约页下载。
- `command-state.json`、`acceptance-ids.json`：可下载的机器可读契约。
- `build-manifest.json`：源文件哈希、章节、图表、搜索记录和验收编号计数。
- `robots.txt`、`sitemap.xml`：公开站点索引信息。

## 推荐阅读顺序

1. [主方案](technical-plan.md)：先看执行摘要、一页架构总览、§1、§5、§14。
2. [架构图索引](technical-plan.md)：按问题进入部署、数据、命令、终端、迁移和容量图。
3. [平台约束](platform-constraints.md)：确认 Cloudflare 数字的来源、日期和待验证状态。
4. [协议与状态](technical-plan.md)：进入附录 A，实现注册、命令、终端和文件链路。
5. [迁移台账](operation-ledger.md) 与主方案附录 B：逐项处理 Go 入口和真实功能。
6. [威胁模型](angelfleetprd-threat-model.md)：按攻击面和证据缺口安排安全验收。
7. [机器契约](command-state.json) 与 [验收注册表](acceptance-ids.json)：在 CI 和实施工具中消费。

开发人员可从 [Go Agent 研发计划](go-agent-development-plan.md)领取工作包，在[技术详细设计](technical-design.md)核对调用链，联调时将实测结果登记到[工程协作页](spaces/implementation-review.md)。
