# Go Agent 接入研发计划

**首个里程碑（M1）**是在 AngelFleetConsole 选中已注册的 Linux 节点，看到来自这台机器、这次 Go 采集的 CPU 和内存读数。断开连接后，页面仍应显示最后一次成功采样的时间。首版沿用 1Panel core/agent，随后依次验收 OpenResty 重启、网站备份和隔离恢复。

**当前可开工。** 截至 2026-11-19，GA-01 接口契约与样例已验证，GA-02 至 GA-19 待实施。测试准备双租户和两台 Linux 节点（GA-02），控制面开发注册与授权（GA-03），Go 团队开发节点身份与服务启动（GA-04），前端按契约样例开发节点概览（GA-09）。M1 剩余估算为 **22–38 人日**，每项任务的依赖和完成条件见派工单。[M1 派工单](#m1-派工单) · [后续派工单](#m1-之后的派工单) · [接口契约](go-agent-interface-contract.md) · [联调样例 JSON](examples/go-agent-first-sample.json)

| 工作时要回答的问题 | 对应文档 |
|---|---|
| 为什么首版保留 Go core/agent，各阶段怎样交付？ | [主方案 · 迁移路线与任务级工作包](technical-plan.md#14-迁移路线与任务级工作包) |
| 控制台受理命令、节点执行、云端确认结果，各自在何时落盘？ | [技术详细设计 · 按持久化边界推进任务](technical-design.md#2-按持久化边界推进任务) |
| 哪个 Go 入口可以复用，哪些地方要增加执行标记或有效性字段？ | [Go 操作台账 · 源码核验记录](operation-ledger.md#源码核验记录) |
| 真实 Linux 节点需要测哪些故障，测试人员应记录什么证据？ | [联调验收记录 · 实测记录表](spaces/implementation-review.md#实测记录) |

## 分阶段里程碑

| 阶段 | 结果与阶段依赖 | 退出证据 |
|---|---|---|
| P0 基线与契约 | 固定实施仓、受支持部署、接口和观察点，准备两个隔离租户及其 Linux 节点。契约和环境可并行 | 可复现的版本、契约样例、用例与环境记录 |
| P1 Console 与权限 | 在 P0 契约上开发节点上下文、查看权限与页面，可与 P2 并行 | 页面深链接、跨租户及切换节点的回归结果 |
| P2 注册与只读 | **M1 首份可信采样**。汇合 P1、租户数据、WSS、节点 journal 和 Go 采集 | 同一次 `node.inspect` 在控制台、云端和 Linux 三端可追溯。断线保留最后一次有效样本 |
| P3 有副作用的命令 | **M2 单次 OpenResty 重启**。依赖 M1 的身份和连接，增加意图持久化、补偿、节点互斥和对账。终端、文件按各自契约并行 | 原命令命中同一实例，丢失回执后对账新增重启为 0 |
| P4 业务迁移 | **M3 网站备份创建**。基于 P3 的可靠执行登记云端创建权限，并将能力按 §13 迁移 | 两类 PHP 站点归档成员、两库记录与摘要可核验；其他业务逐项附证 |
| P5 恢复与交付 | **M4 隔离目标恢复**。使用已校验归档，汇合升级回滚、快照与容量工作 | 恢复前快照、切换后的内容与服务、失败回退和真实任务证据。整版另过独立容量门禁 |
| P6 后续 core 退役 | 另立版本，逐项替换 core 配置、凭据、升级和快照依赖 | 按主方案附录 B.8 在移除 core 后重新完成生命周期验证和回退 |

## M1 派工单

工作量为**人日**，含该任务的开发、自测和评审修订。估算假设有 1 名 Go、1 名控制面、1 名前端和 1 名测试/环境负责人，可共享技术负责人进行契约评审。假设已有可分配的 Linux 测试机和隔离云环境，首次真机联调按下表另计。等待环境、仓库权限或采购的时间单列。

| 任务 / 主责 / 人日 | 前置 | 实施位置、接口与交付物 | 接单后的完成判据 |
|---|---|---|---|
| GA-01 冻结首个纵切契约 · 技术负责人 · 2–3 | 已完成契约验证 | [ga01.v1 契约](go-agent-interface-contract.md)固定下游仓、模块、域路径、签名、握手、采样及错误约定。[公开样例](examples/go-agent-first-sample.json)供 Go、控制面与前端共用 | `npm run check:ga01` 校验签名、摘要、三端标识、回执和异常预期。Go 与本地 workerd 交叉验签通过。DEV01–DEV03、AC-HOST 的真机验收在 GA-10 进行 |
| GA-02 准备双租户真机 · 测试/环境 · 1–2 | 可立即开始 | 两台隔离 Linux 节点分别运行原 core/agent，各归一个测试租户。登记发行版、架构、构建、socket 与采集权限，准备隔离的 Worker、D1、DO 测试资源，建立 runId 记录 | 两节点能分别读取本机原始概览并出示各自的构建和数据来源；记录环境可用性、权限及故障注入方式。AC-HOST、NET-REG |
| GA-03 注册、授权与审计 · 控制面 · 3–5 | GA-01 | Console API `router.ts`、`lib/permissions.ts`、`lib/audit.ts` 扩展至新租户数据服务。实现预登记、一次性票据、挑战与公钥绑定；写入消费、节点和审计共用同一事务胜者 | 并发消费只产生一个绑定/成功审计；丢响应后原 requestId、原密钥签新挑战取回同一身份；过期、改公钥、跨租户拒绝。DEV01、DEV02、FI-AUTH、NET-REG |
| GA-04 节点身份与服务启动 · Go · 3–5 | GA-01 | 新 `connector/cmd/connector`、`internal/identity` 与 Linux 服务定义。探测原 agent socket，本机生成并保存密钥、注册请求标识与绑定，调用 enroll/connect-ticket | 首次启动后可取得可信身份；重启沿用同一绑定，注册响应丢失按 GA-03 恢复；测试日志不含票据或私钥。DEV02、NET-REG |
| GA-05 主动 WSS 的云端接收 · 控制面 · 3–5 | GA-01，联调需 GA-03 | Console 云端入口新增 connect-ticket 发放、Upgrade 分流、AgentConn DO 及 namespace 绑定。鉴权后按节点选 DO，持久化待确认和激活代次 | 用真实测试 Worker/DO 验证 Upgrade、重连及新 epoch 的 ready；旧连接迟到的 ready 不获投递，未就绪时不标记业务可用。DEV03、NET-AGENT |
| GA-06 节点连接与只读 journal · Go · 2–4 | GA-04，联调需 GA-05 | 新 `internal/connection`、`internal/journal`。握手协商能力，将最高 epoch 落盘再发 ready；持久记录 `node.inspect` 的 commandId、意图与待确认结果 | 进程在持久化前后退出均能重连。拒绝旧代次，重发同一命令能返回既有结果；journal 丢失进入可信恢复。DEV03、FI-CMD |
| GA-07 节点采集适配 · Go · 2–4 | GA-01 | 1Panel `agent/app/service/dashboard.go` 的 `LoadCurrentInfoForNode` 与 `LoadCurrentInfo`、相应 DTO，加上 connector 的 `node.inspect` 白名单适配。采集点产生各指标的有效性、时间、单位和错误原因 | CPU、内存与同次原样本一致。让单项采集失败，区分无有效样本、最后有效值和真实零值；既有 Dashboard 消费者可继续读取原字段。AC-HOST、FI-HOST |
| GA-08 只读命令与结果查询 · 控制面 · 4–7 | GA-01，联调需 GA-03、05、06、07 | 租户内实现 `GET /nodes`、`GET /nodes/{nodeId}` 及最近样本引用，按 `node.read` 限制结果。受理 `node.inspect` 时，同一 D1 事务写意图、收据、初始审计和 outbox，提交后返回 202。实现 `dispatchKick/beginDispatch`、按命令合并结果及 `result.committed` | 相同请求返回同一命令。D1、DO、journal 与详情页指向同次采样；只有 D1 已合并或确认同一结果才向节点确认。断线保留样本时间，快路径失败保留待投递记录，自动队列补偿在 GA-11 验收。AC-CMD、AC-AUTH、AC-HOST |
| GA-09 节点概览页面 · 前端 · 2–3 | GA-01，联调需 GA-08 | Console `src/lib/api/`、`dashboard-pages.ts`、权限目录与新节点页。展示连接、采样时间、CPU/内存和 stale；按租户、节点、incarnation 隔离查询，支持刷新 | Mock 覆盖首次等待、合法 0、单项失败、切换后旧响应晚到；本地 API 层验证无权深链接与撤权后的读取。AC-UI、AC-AUTH、FI-HOST |
| GA-10 M1 端到端验收 · 测试 · 2–3 | GA-02 至 GA-09 全部就绪 | 使用部署后的 Console、Worker/D1/DO、两台 Linux 节点及真实 Go。按[联调记录](spaces/implementation-review.md)串起注册审计、epoch、commandId、Go 原始样本和页面读数 | 两节点均有可配对样本，本租户只能看自己的节点。断线保留最后成功时间并置 stale，重连后新样本更新；留脱敏三端记录及故障前后值。DEV01、DEV02、DEV03、AC-HOST、FI-HOST、AC-UI |

**当前可派工。** GA-01 已验证。测试准备 GA-02 的双租户真机，控制面开始 GA-03 注册，Go 实现 GA-04 节点服务，前端按冻结样例开展 GA-09。首个联调顺序为注册、有效连接、带回执的 Go 样本、页面核对、GA-10 验收。GA-07 可独立开发，同一 Go 工程师需在 GA-04、06、07 间排队。M1 原总估算 **24–41 人日**，GA-02 至 GA-10 的剩余计划量为 **22–38 人日**。控制面三项合计 10–17 人日、Go 三项合计 7–13 人日，整体约 3–5 个工作周，实际真机联调日期取决于 GA-02 的资源。

## M1 之后的派工单

同样按单人有效工作日估算。各行是三个代表场景的直接后续工作，全量 34 个路由组、终端/文件流和单租户容量分别按主方案 §13–15 审核与估算。

| 任务 / 主责 / 人日 | 前置 | 实施位置与交付物 | 完成判据与验收编号 |
|---|---|---|---|
| GA-11 可靠写命令 · 控制面 · 4–7 | GA-08，真机联调在 M1 后 | Console 租户命令 API、TenantData、AgentConn。为服务别名维护节点内的 installId 与 resourceVersion，变更绑定即升版；受理时按版本固定到命令。沿用 GA-08 原子提交，新增 `service.manage`、写入准入与取消检查、到期处理、Queues 补偿及重试去重 | 丢受理响应、重复通知、快路径失败均指向同一 commandId 和原安装实例；撤权后原 key 无法继续操作。留审计、D1 事件和实际投递路径。AC-CMD、FI-CMD、NET-CMD |
| GA-12 Go 重启与对账 · Go · 4–7 | GA-06、07，接口按 GA-11 契约 | connector journal/adapter 和 1Panel `AppInstallService.Operate`。持安装实例锁复核绑定、版本和容器身份，执行前持久化 operationMarker；让可写该实例的本地入口遵循同一把锁，提供只读标记查询和入口计数 | 启动前改绑则原命令 `REJECTED`，原/新实例均执行 0 次。已启动且结果丢失后只读对账，原实例累计 1 次、新实例 0 次。只有当前健康证据时保留 `UNCERTAIN`。AC-CMD、FI-CMD、FI-APP |
| GA-13 发布重启工作流 · 前端主责，测试协作 · 3–5 | GA-10、11、12 | Console 服务页、任务查询、审计关联。提交后可离页、按原命令查看；测试分别丢 HTTP 受理响应和节点结果，再让 Compose 成功后刷新状态失败 | 目标与原收据一致，有可归因证据时成功，证据不足时保持未知。附容器前后快照、操作标记、业务入口计数和任务显示。AC-UI、AC-CMD、FI-APP、NET-CMD |
| GA-14 登记网站备份创建 · 控制面 · 2–3 | GA-01，可提前设计；实现依赖 GA-11 | 明确操作名称、创建权限、目标别名/版本和去重策略；同步主方案 C.2、操作台账、Console 权限目录与命令入口，提供正反例 | 使用创建权限的测试用户可提交已登记操作，越权或目标改绑时拒绝；创建、恢复分别鉴权。登记完成后开放创建端到端联调。AC-AUTH、AC-CMD |
| GA-15 Go 备份与归档核验 · Go · 4–6 | GA-06，云端联调依赖 GA-11、14 | 复用 `BackupService.WebsiteBackup`、`handleWebsiteBackup`、`Task.Execute`。固定原站点，将 commandId、localTaskId、backupRecordId 与归档关闭凭据关联，留成员清单、字节数和 SHA-256，增加只读对账 | 本地 PHP/受管 runtime 两类样本与预期成员匹配；任务成功与备份记录写回间中断，复算摘要后补记原结果。移除关闭凭据则为 `UNCERTAIN`，两种情况对账新增备份调用均为 0。AC-APP、AC-FILE、FI-CMD |
| GA-16 备份创建端到端 · 测试主责，前端协作 · 2–4 | GA-10、14、15 | Console 命令页接入已登记的创建操作，走授权→投递→Go 归档→结果回传。若纳入 R2，按制品协议另核验对象版本、大小及整件摘要 | 两类站点各核对命令、任务库、业务库、原始归档与控制台结果。仅做完本地归档时交付范围标为本地；云端制品须另附 READY 及下载复核。AC-APP、AC-FILE、FI-FILE |
| GA-17 隔离目标恢复适配 · Go · 4–7 | GA-12、15 的 journal 与已校验归档 | 复用 `WebsiteRecover`、`handleWebsiteRecover`，使启动错误可观察。在目标业务数据写入前按别名、类型和归档引用的安装项、runtime、证书及数据库核验归属。绑定原任务、归档摘要、目标版本、锁、恢复前快照和持久 checkpoint | 启动失败可归因；异步受理后追踪原任务。关联无法核验则拒绝写入。目标修改前后中断分别核对 checkpoint，通过目标文件、数据库样本、服务响应确认完成或回滚。AC-RECOVERY、FI-RECOVERY |
| GA-18 接入恢复权限与页面 · 控制面主责，前端协作 · 3–5 | GA-11，联调需 GA-17 | 将已登记的 `backup.restore` 接入 Console 权限目录、租户命令 API 和恢复页。校验 Admin 恢复权限、归档归属、目标版本和恢复窗口，节点复核资源锁。页面确认归档、目标和版本，提交后保留原任务链接 | 授权 Admin 可追踪原任务；仅有创建权限、跨租户、版本过期或不在恢复窗口时拒绝，Go 恢复入口调用均为 0。AC-AUTH、FI-AUTH、AC-RECOVERY |
| GA-19 恢复联调与交接 · 测试 · 3–5 | GA-16、17、18 | 在同一隔离测试站点写入样本 A 并备份，再将站点文件和数据库样本改为 B。保持相关资源 ID 和类型，保存恢复前快照。经 Console 发起恢复，关联原任务、快照和 checkpoint | 正常恢复后文件、数据库及服务读取均为 A。中断后按水位核对已完成步骤，执行回滚的分支应恢复为 B。证据缺失保留原命令待核对，对账新增顶层恢复调用为 0。AC-RECOVERY、FI-RESTORE、FI-RECOVERY |

## 代码归属与接口

| 实施位置 | 开发边界与交接内容 |
|---|---|
| **节点 connector，GA-01 已定址** | 产品下游仓 `XCAngelWatch/AngelFleetAgent` 基于 1Panel，`connector/` 为独立 Go 模块，`cmd/connector`、`internal/{identity,protocol,connection,journal,adapter}` 和 `packaging/systemd` 的职责见[仓库与联调契约](go-agent-interface-contract.md)。GA-04 落实产品仓和首个服务代码。 |
| **1Panel 节点执行器，沿用原进程** | 保留 Go 服务初始化、数据库和业务规则。仅在 `agent/app/service/`、关联 DTO 或本地处理器内补采集有效性、命令与任务关联、业务执行标记以及现场核验入口。以可选字段或独立受控本机调用兼容原面板。connector 不直接写业务库。 |
| **Console 管理面与云端控制协议** | 复用 `cloudflare/api/src/` 的认证、权限、审计与路由入口。GA-01 固定同源 `/v1/tenants/{tenantId}`、`/v1/agents/` 及既有管理路由 `/api/v1/`。GA-02 配置 TenantData、AgentConn 和隔离存储，GA-03 起对接实际服务。前端扩展 `src/lib/api/`、`src/lib/auth/permission-policy.ts`、`src/lib/navigation/dashboard-pages.ts` 和 `src/app/`。 |

登记顺序为租户内 `POST /nodes`、`POST /enrollments`，设备再完成 `POST /v1/agents/enroll`、`POST /v1/agents/connect-ticket`、`GET /v1/agents/connect`。首个只读命令 `node.inspect` 沿租户内 `POST /nodes/{nodeId}/commands` 受理，凭 `commandId` 查结果。云端确认租户、节点、权限，connector 持久化代次和接收记录，适配器调用 Go，节点回传带身份和采样时间的结果，页面按原租户及节点读取。消息、状态、幂等和错误码以[主方案附录 A、C](technical-plan.md)及[机器状态定义](command-state.json)为准。

## 验收证据与排期决策

| 验证层 | 运行入口与所能证明的结果 |
|---|---|
| Console Mock | 在 Console 运行 `pnpm test:e2e`。新增用例验证等待、过期、拒绝等状态的展示和页面切换。 |
| 本地 API + SQLite | 使用 Console 的 `pnpm dev:local` 与 `pnpm test:e2e:local`。新增用例验证真实路由、权限、事务与持久化结果。 |
| Go 单元与本机适配 | Linux 构建环境按 1Panel Makefile 准备 agent 依赖，可在 `agent/` 运行 `go test ./app/service -run '^TestWebsiteBackupWithLocalPHPRuntime$'` 检查上游创建回归。新增 connector 模块分别测试 journal 重启、采集失败和回执恢复。 |
| 真机端到端 | 使用隔离的控制面和实际 Linux 节点。每次记录 runId、版本、租户/nodeId/incarnation、epoch、采样时间或 commandId 与结果；有副作用时附操作前后快照、可归因标记和入口调用增量。在[实施联调页](spaces/implementation-review.md)填写预期、实测与证据链接后，按主方案 §14 更新任务状态。 |

| 待决事项 | 负责人、截止点及影响 |
|---|---|
| 节点产品仓供给、测试镜像与 socket 权限核验 | GA-01 已指定 `XCAngelWatch/AngelFleetAgent`、Ubuntu 24.04 LTS/amd64 主节点及与 agent 相同的有效 UID。GA-02 记录实际镜像与本机权限，GA-04 落实建仓权限和发行配置。 |
| 隔离环境域名、TenantData/AgentConn 资源绑定与测试租户 | 同源 `/v1/tenants/*`、`/v1/agents/*` 及既有 `/api/v1/*` 的分工已冻结，GA-02 将实际域名及 bindings 写入环境配置。GA-03 接入同源 Cookie/CSRF 与节点权限。 |
| 支持的网站备份创建名称、权限、目标类型及是否包含云端对象 | 产品与控制面负责人在 GA-14 决定。节点归档和两库对账可先行；云端端到端与 R2 工时按所选范围复核。 |
| 下游 Go 补丁的维护边界及恢复测试目标 | Go 与测试负责人在 GA-12、17 开始前确认修改点和可还原的隔离站点。真实执行分支若无法保留可查询标记，须重新估算，相关操作保持待验证。 |

## 源码基线与本次修订

核对对象为三个本地仓库在开始编写本文时的 HEAD，三者的 Git 工作树当时均干净。PRD 提交列用于还原修订前的文档。执行团队接单时记录实际构建版本与本地补丁，并复核涉及的入口。

| 仓库 | 分支与完整提交 | 本轮核对范围 |
|---|---|---|
| AngelFleetPRD | `main@f3394afeb37c89145c5b58017ed49d815902ce61` | 主方案 §13–15、附录 A/C/D，详细设计、操作台账及验收注册表 |
| 1Panel | `dev-v2@aaba86d0ef71a31ee319e74998ffe83c64abf4b6` | 原全量矩阵固定在 `cedb8dd`。两版本相差 38 个提交，本次按启动、采样、普通 OpenResty 重启和网站备份/恢复重新核对 |
| AngelFleetConsole | `main@df715b38d174b2bdad7a5ab58150c05ead6c5d36` | 管理页面、API 主路由、环境绑定、权限/审计及本地和 Mock 测试入口 |

| 原文或已有认识 | 当前源码事实与证据 | 对计划的影响 |
|---|---|---|
| Console 可复用账号、权限和审计 | **AngelFleet 已有**。`routeRequest` 分派身份、机构、租户、用户、角色、权限和审计等路由。权限目录和服务端检查已有实现。[路由](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/cloudflare/api/src/router.ts) · [权限检查](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/cloudflare/api/src/lib/permissions.ts) | 在现有授权链上增加节点归属、操作权限和证据关联，保留原管理路由 |
| 早期按 XCtechResource 估算了控制面、导出队列与存储复用 | **待开发**。现有 API 的 `Env` 声明 DB 和可选登录限流 KV，普通 `withCors` 会重建 Response。主路由尚无节点注册、WSS、命令或制品接口。[环境](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/cloudflare/api/src/env.ts) · [HTTP 包装](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/cloudflare/api/src/lib/http.ts) | 为租户数据服务、AgentConn、命令补偿和后续 R2 实施分别留出工时 |
| 1Panel 已有 Go agent，可作为执行器 | **上游已有**。core、agent 各自通过 `cmd/server/main.go` 启动。主节点模式下 agent 监听本地 Unix socket，其他部署模式使用入站双向 TLS。[监听实现](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/server/server.go#L128-L177) | 新增独立 connector 主动建链。首批适配只映射登记的本机操作，先验证社区版主节点部署 |
| 读取 dashboard 即可显示在线指标 | **上游已有采集，待补有效性**。两个 Dashboard 入口在上述区间无变更。部分采集错误会被忽略，时间戳或零值不足以判断采集成功。[DashboardService](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L196) | Go 采集点提供每项的有效性与采样时刻，断线与有效零值分别验收 |
| Go 能重启 OpenResty | **上游已有重启动作，待补任务关联**。区间内改动的是 `UpdateAppConfig`。普通实例的 `AppInstallService.Operate` 仍按安装 ID 调 Compose 后刷新状态，该分支未持久绑定云端命令。[Operate](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L265-L321) | 给实际执行分支补标记和只读核验。回执丢失、状态刷新失败、同时改绑是三个测试输入 |
| 网站归档与恢复可复用 | **上游已有分支，端到端待验证**。`aea4de1c7` 让本地 PHP 在创建及恢复时均跳过 runtime 子包，有关联的数据库仍按站点配置处理。`WebsiteRecover` 找到站点后对内部启动错误只记日志，正常路径异步执行。[变更](https://github.com/1Panel-dev/1Panel/commit/aea4de1c7) · [恢复与创建](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L64-L249) | 创建、恢复分开派工。创建需核对归档，恢复需核对目标数据和服务。上游创建回归仅作为单元证据 |

上述三个场景的 AngelFleet 真机验收均待执行。[Go 操作与源码台账](operation-ledger.md) · [实测记录表](spaces/implementation-review.md)
