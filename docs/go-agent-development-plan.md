# Go Agent 接入研发计划

**首个里程碑（M1）**交付节点概览。用户在控制台选择一台 Linux 节点，就能看到它刚采集的 CPU 和内存。节点断线后，仍能查到每项最近一次有效采样的时间。首版沿用 1Panel core/agent，由新增的 Go connector 主动连云。

**截至 2026-11-19**，GA-01 的仓库布局和接口样例已验证，GA-02 至 GA-19 待实施。现在可分别派给测试 GA-02（环境）、控制面 GA-03（注册）、Go GA-04（节点服务）、前端 GA-09（按样例开发）。[首批派工单](#m1-派工单) · [GA-01 接口与样例](go-agent-interface-contract.md) · [实测记录](spaces/implementation-review.md#实测记录)

## 分阶段里程碑

P0–P6 是整版产品阶段，M1–M4 是本计划的四次交付，GA 编号对应下方可派工任务。各项完成判据引用的 DEV、AC、FI、NET 等编号可在[验收注册表](acceptance-ids.json)查到。[整版迁移路线](technical-plan.md#14-迁移路线与任务级工作包)

| 交付 / 对应阶段 | 任务 | 通过条件与验收入口 |
|---|---|---|
| M1 首次可信采样 · P0–P2 | GA-01 至 GA-10 | 注册和授权、主动建连、只读命令落盘。以同一 commandId 核对 Linux 原始采样与页面读数，断线保留最后成功时间。[采样场景](spaces/implementation-review.md#注册连接与首次采样) |
| M2 OpenResty 重启 · P3 | GA-11 至 GA-13 | 在 M1 的命令收据和 outbox 上增加写权限、队列补偿、节点互斥与对账。结果丢失后仍能按原实例核验，额外重启次数为零。[重启场景](spaces/implementation-review.md#重启撤权与取消) |
| M3 创建网站备份 · P4 | GA-14 至 GA-16 | 先登记创建操作及权限。分别核验本地 PHP 和受管 runtime 两类站点的归档成员、摘要及两库记录。[备份创建实测](spaces/implementation-review.md#网站备份创建) |
| M4 恢复隔离站点 · P5 | GA-17 至 GA-19 | 从已核验归档恢复至隔离目标，通过目标文件、数据库样本和服务响应确认恢复结果，留存失败回退证据。[隔离恢复实测](spaces/implementation-review.md#隔离站点恢复) |

整版交付还需验收 34 个路由组与单租户 1 万节点容量。P6 的 core 退役另立版本，按主方案附录 B.8 验收。

## M1 派工单

按 1 名 Go、1 名控制面、1 名前端、1 名测试估算，技术负责人参与评审。**M1 共 24–41 人日，剩余 22–38 人日**，其中控制面 10–17 人日、Go 7–13 人日。预计 3–5 个工作周，前提是能取得隔离云资源、仓库权限和 Linux 测试机。人日含开发、自测、评审和表内联调，环境等待单列。

“前置”区分开发和联调。GA-01 冻结后，GA-05、GA-07、GA-08 可按样例开发；按上述人手，控制面与 Go 优先完成 GA-03、GA-04，再做注册 → 建连 → 采样 → 页面核对。

| 任务 / 主责 / 人日 | 前置 | 实施位置、接口与交付物 | 接单后的完成判据 |
|---|---|---|---|
| GA-01 冻结首个纵切契约 · 技术负责人 · 2–3 | 无（已完成） | [ga01.v1 契约](go-agent-interface-contract.md)固定下游仓、模块、域路径、签名、握手、采样及错误约定。[公开样例](examples/go-agent-first-sample.json)供 Go、控制面与前端共用 | `npm run check:ga01` 校验签名、摘要、三端标识、回执和异常预期。Go 与本地 workerd 交叉验签通过。DEV01–DEV03、AC-HOST 的真机验收在 GA-10 进行 |
| GA-02 准备双租户真机 · 测试/环境 · 1–2 | 可立即开始 | 两台隔离 Linux 节点分别运行原 core/agent，各归一个测试租户。登记发行版、架构、构建、socket 与采集权限，准备隔离的 Worker、D1、DO 测试资源，建立 runId 记录 | 两节点能分别读取本机原始概览并出示各自的构建和数据来源；记录环境可用性、权限及故障注入方式。AC-HOST、NET-REG |
| GA-03 注册、授权与审计 · 控制面 · 3–5 | GA-01 | Console API `router.ts`、`lib/permissions.ts`、`lib/audit.ts` 扩展至新租户数据服务。实现预登记、一次性票据、挑战与公钥绑定；写入消费、节点和审计共用同一事务胜者 | 并发消费只产生一个绑定/成功审计；丢响应后原 requestId、原密钥签新挑战取回同一身份；过期、改公钥、跨租户拒绝。DEV01、DEV02、FI-AUTH、NET-REG |
| GA-04 节点身份与服务启动 · Go · 3–5 | GA-01 | 新 `connector/cmd/connector`、`internal/identity` 与 Linux 服务定义。探测原 agent socket，本机生成并保存密钥、注册请求标识与绑定，调用 enroll/connect-ticket | 首次启动后可取得可信身份；重启沿用同一绑定，注册响应丢失按 GA-03 恢复；测试日志不含票据或私钥。DEV02、NET-REG |
| GA-05 主动 WSS 的云端接收 · 控制面 · 3–5 | GA-01，联调需 GA-03 | Console 云端入口新增 connect-ticket 发放、Upgrade 分流、AgentConn DO 及 namespace 绑定。鉴权后按节点选 DO，持久化待确认和激活代次 | 用真实测试 Worker/DO 验证 Upgrade、重连及新 epoch 的 ready；旧连接迟到的 ready 不获投递，未就绪时不标记业务可用。DEV03、NET-AGENT |
| GA-06 节点连接与只读 journal · Go · 2–4 | GA-04，联调需 GA-05 | 新 `internal/connection`、`internal/journal`。握手协商能力，将最高 epoch 落盘再发 ready；持久记录 `node.inspect` 的 commandId、意图与待确认结果 | 进程在持久化前后退出均能重连。拒绝旧代次，重发同一命令能返回既有结果；journal 丢失进入可信恢复。DEV03、FI-CMD |
| GA-07 节点采集适配 · Go · 2–4 | GA-01 | 1Panel `agent/app/service/dashboard.go` 的 `LoadCurrentInfoForNode` 与 `LoadCurrentInfo`、相应 DTO，加上 connector 的 `node.inspect` 白名单适配。采集点产生各指标的有效性、时间、单位和错误原因 | CPU、内存与同次原样本一致。让单项采集失败，区分无有效样本、最后有效值和真实零值；既有 Dashboard 消费者可继续读取原字段。AC-HOST、FI-HOST |
| GA-08 只读命令与结果查询 · 控制面 · 4–7 | GA-01，联调需 GA-03、GA-05、GA-06、GA-07 | 租户内实现 `GET /nodes`、`GET /nodes/{nodeId}` 及最近样本引用。为每项指标持久化最后有效值、时间和来源命令，确定按 `node.read` 授权的读取方式。如扩展报文，另行版本化。受理 `node.inspect` 时，同一 D1 事务写意图、收据、初始审计和 outbox，提交后返回 202。实现 `dispatchKick/beginDispatch`、按命令合并结果及 `result.committed` | 相同请求返回同一命令。D1、DO、journal 与详情页指向同次采样；只有 D1 已合并或确认同一结果才向节点确认。断线保留样本时间，快路径失败保留待投递记录，自动队列补偿在 GA-11 验收。AC-CMD、AC-AUTH、AC-HOST |
| GA-09 节点概览页面 · 前端 · 2–3 | GA-01，联调需 GA-08 | Console `src/lib/api/`、`dashboard-pages.ts`、权限目录与新节点页。展示连接、采样时间、CPU/内存和 stale；按租户、节点、incarnation 隔离查询，新会话按 GA-08 授权结果恢复每项读数 | Mock 覆盖首次等待、合法 0、单项失败、切换后旧响应晚到；本地 API 层验证无权深链接与撤权后的读取。AC-UI、AC-AUTH、FI-HOST |
| GA-10 M1 端到端验收 · 测试 · 2–3 | GA-02 至 GA-09 全部就绪 | 使用部署后的 Console、Worker/D1/DO、两台 Linux 节点及真实 Go。按[联调记录](spaces/implementation-review.md)串起注册审计、epoch、commandId、Go 原始样本和页面读数 | 两节点均有可配对样本，本租户只能看自己的节点。断线标 stale，重连更新。第二次仅 CPU 有效后清缓存，CPU 与内存分别匹配各自最近有效的来源命令和时间，附三端记录。DEV01、DEV02、DEV03、AC-HOST、FI-HOST、AC-UI |

## M1 之后的派工单

设计、实现与端到端联调可有不同前置。M2、M3、M4 分别由 GA-13、GA-16、GA-19 汇总交付证据。

| 任务 / 主责 / 人日 | 前置 | 实施位置与交付物 | 完成判据与验收编号 |
|---|---|---|---|
| GA-11 可靠写命令 · 控制面 · 4–7 | GA-08，真机联调需 GA-10 | Console 租户命令 API、TenantData、AgentConn。为服务别名维护节点内的 installId 与 resourceVersion，变更绑定即升版；受理时按版本固定到命令。沿用 GA-08 原子提交，新增 `service.manage`、写入准入与取消检查、到期处理、Queues 补偿及重试去重 | 丢受理响应、重复通知、快路径失败均指向同一 commandId 和原安装实例；撤权后原 key 无法继续操作。留审计、D1 事件和实际投递路径。AC-CMD、FI-CMD、NET-CMD |
| GA-12 Go 重启与对账 · Go · 4–7 | GA-06、GA-07，接口按 GA-11 契约 | connector journal/adapter 和 1Panel `AppInstallService.Operate`。持安装实例锁复核绑定、版本和容器身份，执行前持久化 operationMarker；让可写该实例的本地入口遵循同一把锁，提供只读标记查询和入口计数 | 启动前改绑则原命令 `REJECTED`，原/新实例均执行 0 次。已启动且结果丢失后只读对账，原实例累计 1 次、新实例 0 次。只有当前健康证据时保留 `UNCERTAIN`。AC-CMD、FI-CMD、FI-APP |
| GA-13 发布重启工作流 · 前端主责，测试协作 · 3–5 | GA-10、GA-11、GA-12 | Console 服务页、任务查询、审计关联。提交后可离页、按原命令查看；测试分别丢 HTTP 受理响应和节点结果，再让 Compose 成功后刷新状态失败 | 目标与原收据一致，有可归因证据时成功，证据不足时保持未知。附容器前后快照、操作标记、业务入口计数和任务显示。AC-UI、AC-CMD、FI-APP、NET-CMD |
| GA-14 登记网站备份创建 · 控制面 · 2–3 | GA-01 后可设计，实现需 GA-11 | 明确操作名称、创建权限、目标别名/版本和去重策略；同步主方案 C.2、操作台账、Console 权限目录与命令入口，提供正反例 | 使用创建权限的测试用户可提交已登记操作，越权或目标改绑时拒绝；创建、恢复分别鉴权。登记完成后开放创建端到端联调。AC-AUTH、AC-CMD |
| GA-15 Go 备份与归档核验 · Go · 4–6 | GA-06，云端联调依赖 GA-11、GA-14 | 复用 `BackupService.WebsiteBackup`、`handleWebsiteBackup`、`Task.Execute`。固定原站点，将 commandId、localTaskId、backupRecordId 与归档关闭凭据关联，留成员清单、字节数和 SHA-256，增加只读对账 | 本地 PHP/受管 runtime 两类样本与预期成员匹配；任务成功与备份记录写回间中断，复算摘要后补记原结果。移除关闭凭据则为 `UNCERTAIN`，两种情况对账新增备份调用均为 0。AC-APP、AC-FILE、FI-CMD |
| GA-16 备份创建端到端 · 测试主责，前端协作 · 2–4 | GA-10、GA-14、GA-15 | Console 命令页接入已登记的创建操作，走授权→投递→Go 归档→结果回传。若纳入 R2，按制品协议另核验对象版本、大小及整件摘要 | 两类站点各核对命令、任务库、业务库、原始归档与控制台结果。仅做完本地归档时交付范围标为本地；云端制品须另附 READY 及下载复核。AC-APP、AC-FILE、FI-FILE |
| GA-17 隔离目标恢复适配 · Go · 4–7 | GA-12、GA-15 的 journal 与已校验归档 | 复用 `WebsiteRecover`、`handleWebsiteRecover`，使启动错误可观察。在目标业务数据写入前按别名、类型和归档引用的安装项、runtime、证书及数据库核验归属。绑定原任务、归档摘要、目标版本、锁、恢复前快照和持久 checkpoint | 启动失败可归因；异步受理后追踪原任务。关联无法核验则拒绝写入。目标修改前后中断分别核对 checkpoint，通过目标文件、数据库样本、服务响应确认完成或回滚。AC-RECOVERY、FI-RECOVERY |
| GA-18 接入恢复权限与页面 · 控制面主责，前端协作 · 3–5 | GA-11，联调需 GA-17 | 将已登记的 `backup.restore` 接入 Console 权限目录、租户命令 API 和恢复页。校验 Admin 恢复权限、归档归属、目标版本和恢复窗口，节点复核资源锁。页面确认归档、目标和版本，提交后保留原任务链接 | 授权 Admin 可追踪原任务；仅有创建权限、跨租户、版本过期或不在恢复窗口时拒绝，Go 恢复入口调用均为 0。AC-AUTH、FI-AUTH、AC-RECOVERY |
| GA-19 恢复联调与交接 · 测试 · 3–5 | GA-16、GA-17、GA-18 | 在同一隔离测试站点写入样本 A 并备份，再将站点文件和数据库样本改为 B。保持相关资源 ID 和类型，保存恢复前快照。经 Console 发起恢复，关联原任务、快照和 checkpoint | 正常恢复后文件、数据库及服务读取均为 A。中断后按水位核对已完成步骤，执行回滚的分支应恢复为 B。证据缺失保留原命令待核对，对账新增顶层恢复调用为 0。AC-RECOVERY、FI-RESTORE、FI-RECOVERY |

## 代码归属与接口

| 谁改哪里 | 本轮职责 |
|---|---|
| Go · 产品下游仓 `XCAngelWatch/AngelFleetAgent` | GA-04 落实仓库和独立 `connector/` 模块。服务入口、身份、协议、连接、journal、adapter 及 systemd 的目录划分见 [GA-01 契约](go-agent-interface-contract.md)。 |
| Go · 同一下游仓的 1Panel 执行器 | 沿用 `agent/app/service/` 与原业务库，按任务补采集有效性、执行标记和只读核验入口。具体函数、支持范围和本地权限查 [Go 操作台账](operation-ledger.md)。 |
| 控制面 / 前端 · `XCAngelWatch/AngelFleetConsole` | 云端从 `cloudflare/api/src/` 扩展注册、授权和命令路由；前端从 `src/lib/api/`、权限目录、导航和 `src/app/` 接入。云端、connector 与原 agent 各自在何时落盘见[技术详细设计](technical-design.md#2-按持久化边界推进任务)。 |

Go 和控制面联调使用同一份[请求、响应与双向帧 JSON](examples/go-agent-first-sample.json)；状态转移以[机器定义](command-state.json)为准。

## 验收证据与排期决策

GA-01 的样例可在本仓运行 `npm run check:ga01` 复核。四个里程碑共用一份[联调验收记录](spaces/implementation-review.md#实测记录)，其中区分 Mock、本地 API 与真实节点证据。评审时记录 runId、实际构建与三端观察值。

| 接单前仍要落实的事项 | 主责与截止点 | 解锁条件 |
|---|---|---|
| 测试租户、镜像、域名和资源绑定 | 测试 / 控制面 · GA-02，GA-10 真机验收前 | 两个租户各有一台可采集的 Ubuntu 24.04 LTS/amd64 测试节点，记录 socket 权限、TenantData / AgentConn 绑定。GA-03 实现同源 Cookie / CSRF 与节点授权。 |
| 跨会话保留每项最后有效值 | 控制面 / 前端 · GA-08、GA-09 联调前 | `ga01.v1` 只给出最新样本命令。确定读取投影的接口和权限，再以 GA-10 空缓存场景核对。 |
| 下游仓与发行配置 | Go · GA-04 | 在 GA-01 指定的产品仓建立模块，验证服务以约定 UID 连接本机 socket，登记构建版本。 |
| 网站备份创建名称、权限、目标与 R2 范围 | 产品 / 控制面 · GA-14，实现创建入口前 | 在主方案 C.2、操作台账和权限目录登记创建操作。若纳入云端制品，GA-16 另验对象版本、大小与摘要，按范围复估。 |
| 执行标记补丁与隔离恢复目标 | Go / 测试 · GA-12、GA-17 开始前 | 确认实际执行分支可保留标记，并准备能反复还原的测试站点；按实测结果决定重启、恢复是否可交付。 |

## 源码基线与本次修订

本次复核的本地代码为下表所列 1Panel 和 Console 提交。PRD 一行记录首次拆工所依据的原稿，本轮以已发布的 `3274c36` 为修订起点。接单人登记实际构建与下游补丁，再核对所用入口。

| 仓库 | 分支与完整提交 | 本轮核对范围 |
|---|---|---|
| AngelFleetPRD | `main@f3394afeb37c89145c5b58017ed49d815902ce61` | 主方案 §13–15、附录 A/C/D，详细设计、操作台账及验收注册表 |
| 1Panel | `dev-v2@aaba86d0ef71a31ee319e74998ffe83c64abf4b6` | 原全量矩阵固定在 `cedb8dd`。两版本相差 38 个提交，本次按启动、采样、普通 OpenResty 重启和网站备份/恢复重新核对 |
| AngelFleetConsole | `main@df715b38d174b2bdad7a5ab58150c05ead6c5d36` | 管理页面、API 主路由、环境绑定、[现有权限检查](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/cloudflare/api/src/lib/permissions.ts)、审计及测试入口 |

本次排期沿用 Console 的账号、权限与审计入口，节点路由、AgentConn 和命令存储仍需开发。1Panel 已有采集、重启、备份和恢复入口，仍需补采集有效性、任务关联与结果核验。基线差异及逐操作源码见[技术详细设计](technical-design.md)和[Go 操作台账](operation-ledger.md#源码核验记录)。
