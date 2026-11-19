# AngelFleet PRD 文档目录

开发或测试接单先打开[在线研发计划](https://xcangelwatch.github.io/AngelFleetPRD/go-agent-development-plan.html)，按 GA 编号找到主责、前置和完成判据。维护文档时按下表修改对应正文，其他页面引用该处。

| 目录 | 问题 | 维护位置 |
|---|---|---|
| 范围与排期 | 首版交付什么，哪些能力另立版本？ | [主方案](technical-plan.md)维护产品与架构决策、P0–P6 整版路线、协议通则和发布门禁。附录 B 记录全量迁移范围，C.2 登记已确定的操作。 |
| 范围与排期 | 谁接单，能否并行，完成如何判断？ | [Go Agent 研发计划](go-agent-development-plan.md)维护 M1–M4、GA-01 至 GA-19、依赖与人日估算。 |
| 实现设计 | 控制台、云端和本机如何调用，在哪一步落盘？ | [技术详细设计](technical-design.md)维护跨组件调用顺序和故障恢复边界。 |
| 实现设计 | Go 与控制面交换什么，代码放在哪里？ | [GA-01 节点契约](go-agent-interface-contract.md)维护下游仓、模块、注册到首次采样的线协议；完整报文维护在[联调样例 JSON](examples/go-agent-first-sample.json)。 |
| 操作与验收 | 某一操作复用哪段 1Panel 源码，要补哪些本地能力？ | [Go 操作台账](operation-ledger.md)维护登记操作的适配和核验入口，以及带版本的源码证据。 |
| 操作与验收 | 哪些场景已在真机执行，证据在哪里？ | [联调验收记录](spaces/implementation-review.md)维护用例、实际观察值、运行编号及证据链接。 |

## 规则、编号与发布

- 新增或修改命令状态时，更新[命令状态定义](command-state.json)与主方案 A.5 的状态图；构建检查逐条对照转移。
- 验收编号在[验收注册表](acceptance-ids.json)登记；主方案附录 D 把需求关联到验收包，派工单引用相应编号。
- 平台限制、取证日期和官方出处集中在[平台约束快照](platform-constraints.md)。安全边界与待验证项见[威胁模型](angelfleetprd-threat-model.md)。
- [站点元数据](site-meta.json)记录设计版本与发布状态。按[仓库构建说明](../README.md#本地构建)生成 `dist/`，其中 `build-manifest.json` 可核对六个阅读页、源文件哈希与搜索索引。
