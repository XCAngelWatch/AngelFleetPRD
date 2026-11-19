# AngelFleet 文档目录

| 工作中要回答的问题 | 主文档 |
|---|---|
| 哪些用户能操作哪些节点？本批选什么功能，满足什么条件才能开放？ | [产品 PRD](product-prd.md) |
| 状态由哪个组件保存？谁授权、谁执行，失败时如何恢复？ | [技术方案](technical-design.md) |
| Go、控制面和前端发送什么请求或帧？样例响应和错误如何核对？ | [节点接入与接口契约](go-agent-interface-contract.md) |
| 哪个角色可以在哪个资源执行动作？Go 入口、互斥和结果证据是什么？ | [节点操作与权限](operation-ledger.md) |
| 谁先开工、工期多少、交付给谁？哪些测试决定能否放行？ | [研发计划](engineering-roadmap.md) |

## 参考资料与原始记录

- [规格附录](technical-plan.md)保存 SQL、状态图、路由矩阵、参数测算与需求映射。[平台快照](platform-constraints.md)保存限额和官方出处，[风险记录](angelfleetprd-threat-model.md)保存评估依据及证据缺口。
- [历史工单](go-agent-development-plan.md)保留已移出的 GA-12 至 GA-19 及源码基线。[联调记录](spaces/implementation-review.md)填写运行编号、实际环境、观察值及脱敏证据。[线上核查记录](reviews/2026-11-19-online-audit.md)保留当日核查范围与发现。
- [命令状态定义](command-state.json)、[验收编号](acceptance-ids.json)、[注册到首采样例](examples/go-agent-first-sample.json)和[逐指标读取样例](examples/node-metric-read.v1.json)供实现与自动校验使用。

按[本地构建说明](../README.md#本地构建)生成网页、搜索索引和 Markdown 下载。
