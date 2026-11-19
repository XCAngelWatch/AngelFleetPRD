# Go Agent 接入研发计划

**首个里程碑（M1）**交付节点概览。用户在控制台选择一台 Linux 节点，就能看到它刚采集的 CPU 和内存。节点断线后，仍能查到每项最近一次有效采样的时间。首版沿用 1Panel core/agent，由新增的 Go connector 主动连云。

**截至 2026-11-19**，GA-01 的仓库布局和接口样例已验证，GA-08 至 GA-10 的[逐指标读取契约](go-agent-interface-contract.md#53-逐指标读取与冷启动展示)已定稿。GA-02 至 GA-10 待实施，GA-11 保留通用写命令设计；GA-12 至 GA-19 原业务场景已移出本轮。现在可分别派给测试 GA-02（环境）、控制面 GA-03（注册）、Go GA-04（节点服务）、前端 GA-09（按样例开发）。[首批派工单](#m1-派工单) · [GA-01 接口与样例](go-agent-interface-contract.md) · [实测记录](spaces/implementation-review.md#实测记录)

## 分阶段里程碑

P0–P6 是整版产品阶段。GA 编号保留历史派工与验收入口。按本轮范围，M1 继续执行，原 M2–M4 的网站和应用商店场景停止派工；候选替代须单独拆工、估时、验收。[本轮非 AI 功能迁移清单](technical-plan.md#137-本轮非-ai-功能迁移清单) · [验收注册表](acceptance-ids.json) · [整版路线](technical-plan.md#14-迁移路线与任务级工作包)

| 交付 / 对应阶段 | 任务 | 通过条件与验收入口 |
|---|---|---|
| M1 首次可信采样 · P0–P2 | GA-01 至 GA-10 | 注册和授权、主动建连、只读命令落盘。以同一 commandId 核对 Linux 原始采样与页面读数，断线保留最后成功时间。[采样场景](spaces/implementation-review.md#注册连接与首次采样) |
| M2 原场景：OpenResty 重启 · P3 | GA-11 保留通用能力；GA-12、GA-13 原场景移出 | 候选为独立测试容器重启。按容器不可变 ID 和版本固定目标；丢失结果后按原命令对账，新增重启次数为零。 |
| M3 原场景：创建网站备份 · P4 | GA-14 至 GA-16 原场景移出 | 候选为独立测试数据库逻辑备份。先核验实例身份、备份权限、原始样本和归档摘要，再登记操作。 |
| M4 原场景：恢复隔离站点 · P5 | GA-17 至 GA-19 原场景移出 | 候选为用已校验的数据库备份恢复隔离测试库。验收须回读业务样本，并验证中断后的继续或回退。 |

34 个公开路由组是上游核对基线。产品按本轮范围内的端点验收，单租户 1 万节点容量单独取证。P6 的 core 退役另立版本。

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
| GA-08 只读命令与结果查询 · 控制面 · 4–7 | GA-01，联调需 GA-03、GA-05、GA-06、GA-07 | 实现租户节点列表、详情及[逐指标 GET](go-agent-interface-contract.md#53-逐指标读取与冷启动展示)。在 D1 受理事务分配绑定内的 sampleOrder，与命令意图、收据、初始审计和 outbox 一起提交后返回 202。沿用 dispatchKick/beginDispatch；结果事务同时更新命令与每项最后有效值、采样时间、来源 | 按 S1→S2 受理命令，顺序或逆序合并结果，CPU 均来自 S2，内存均来自 S1；旧结果重报不改变读数或版本。只有 D1 已合并或确认同一结果才回 result.committed。授权、代次与离线读通过，快路径失败保留待投递记录。AC-CMD、AC-AUTH、AC-HOST |
| GA-09 节点概览页面 · 前端 · 2–3 | GA-01，联调需 GA-08 | 在 Console 的 `src/lib/api/`、节点页、权限目录及导航接入 GET。首次进入、硬刷新或新标签页，先读授权节点详情取得 incarnation，再一次读取两项的值、时间、状态与命令来源；单独展示连接状态 | 用[两次采样样例](examples/node-metric-read.v1.json)开发。清缓存后 CPU 显示 0%，内存显示上次有效的 1 GiB、原时间与来源，并提示本次失败。首次无值、节点切换时的迟到响应、撤权及其深链接均有独立用例。AC-UI、AC-AUTH、FI-HOST |
| GA-10 M1 端到端验收 · 测试 · 2–3 | GA-02 至 GA-09 全部就绪 | 在隔离 Console、Worker/D1/DO 和两租户各自的 Linux 节点取证。先核对注册、连接及首次采样，再按[两次采样后的无缓存验收](spaces/implementation-review.md#两次采样后的无缓存验收)验证第二次仅 CPU 成功 | 新会话只读，不产生第三条命令。CPU 和内存各自匹配正确的 Go 原值、采样时间、来源命令；断线、重连、跨租户、重装后身份隔离均有证据。附两次 Go 原样本、D1 记录、授权 GET 和页面观察值。DEV01、DEV02、DEV03、AC-HOST、FI-HOST、AC-UI |

## M1 之后的派工单

GA-11 保留跨业务写命令的共用能力。GA-12 至 GA-19 保留原任务名称、编号和前置，便于查阅历史依赖；原场景已移出，旧工时不计入本轮预算。候选工单的操作名、权限、节点适配及人日均待核定。

| 任务与状态 / 主责 | 前置（历史任务列原依赖） | 现行交付或处置 | 可复用的核验方法与编号 |
|---|---|---|---|
| GA-11 可靠写命令 · 控制面 · 工时待复估 | GA-08，真机联调需 GA-10 | 复用命令收据与 outbox，增加写权限准入、目标绑定与版本、取消、到期、队列补偿。以新载荷与执行器确定后的协议完成联调 | 丢失受理响应或重复通知时均关联同一命令和原目标；撤权、目标改绑时拒绝后续未启动操作。证据含审计、事件和原始投递记录。AC-CMD、FI-CMD、NET-CMD |
| GA-12 Go 重启与对账 · 历史任务 · Go | GA-06、GA-07，接口按 GA-11 契约 | 旧版使用 OpenResty 安装实例锁和 AppInstallService.Operate；独立容器的锁、标记和读取入口需另核。 | 目标改绑后启动次数为零，结果丢失后只读对账。AC-CMD、FI-CMD。 |
| GA-13 发布重启工作流 · 历史任务 · 前端 / 测试 | GA-10、GA-11、GA-12 | 旧版服务页与 OpenResty 回归不再排期。可复用离页追踪、迟到结果与撤权测试方法。 | 控制台关联原命令，证据不足显示未知。AC-UI、AC-CMD。 |
| GA-14 登记网站备份创建 · 历史任务 · 控制面 | GA-01 后可设计，实现需 GA-11 | 停止登记网站备份创建操作。数据库备份创建的操作名、权限与受理边界另定。 | 分别核对创建、恢复权限及目标版本。AC-AUTH、AC-CMD。 |
| GA-15 Go 备份与归档核验 · 历史任务 · Go | GA-06，云端联调依赖 GA-11、GA-14 | 原 WebsiteBackup 和 PHP/runtime 归档成员仅属网站实现。数据库样本、归档与完整性检查重新设计。 | 比对原任务、归档完整性与最终记录。AC-FILE、FI-CMD。 |
| GA-16 备份创建端到端 · 历史任务 · 测试 / 前端 | GA-10、GA-14、GA-15 | 旧版两类网站样本及其权限测试移出。候选独立数据库备份需重新确定本地制品或云端交付范围。 | 以已确认的制品交付范围核对摘要及授权读取。AC-FILE、FI-FILE。 |
| GA-17 隔离目标恢复适配 · 历史任务 · Go | GA-12、GA-15 的 journal 与已校验归档 | 原 WebsiteRecover 的目录、证书及 runtime 检查移出。数据库恢复按引擎、实例身份、目标库和可恢复边界另拆。 | 识别原恢复任务，核对中断时已写入的边界。AC-RECOVERY、FI-RECOVERY。 |
| GA-18 接入恢复权限与页面 · 历史任务 · 控制面 / 前端 | GA-11，联调需 GA-17 | 原站点恢复页面移出；恢复权限、归档归属和目标版本核验方法可用于候选数据库恢复的设计。 | 越权、跨租户、版本过期均拒绝。AC-AUTH、FI-AUTH。 |
| GA-19 恢复联调与交接 · 历史任务 · 测试 | GA-16、GA-17、GA-18 | 原站点 A/B 测试移出。数据库候选需记录备份前样本、隔离库恢复前状态、恢复后查询结果与失败回退。 | 以业务读取核验恢复与回退，对账新增执行次数为零。AC-RECOVERY、FI-RESTORE。 |

## 代码归属与接口

| 谁改哪里 | 本轮职责 |
|---|---|
| Go · 产品下游仓 `XCAngelWatch/AngelFleetAgent` | GA-04 落实仓库和独立 `connector/` 模块。服务入口、身份、协议、连接、journal、adapter 及 systemd 的目录划分见 [GA-01 契约](go-agent-interface-contract.md)。 |
| Go · 同一下游仓的 1Panel 执行器 | 沿用 `agent/app/service/` 与原业务库，按任务补采集有效性、执行标记和只读核验入口。具体函数、支持范围和本地权限查 [Go 操作台账](operation-ledger.md)。 |
| 控制面 / 前端 · `XCAngelWatch/AngelFleetConsole` | 云端从 `cloudflare/api/src/` 扩展注册、授权和命令路由；前端从 `src/lib/api/`、权限目录、导航和 `src/app/` 接入。云端、connector 与原 agent 各自在何时落盘见[技术详细设计](technical-design.md#2-按持久化边界推进任务)。 |

Go 和控制面联调使用同一份[请求、响应与双向帧 JSON](examples/go-agent-first-sample.json)；状态转移以[机器定义](command-state.json)为准。

## 验收证据与排期决策

运行 `npm run check:ga01` 复核注册到首次采样的链路，运行 `npm run check:metric-read` 从两条命令结果核对[逐指标读取样例](examples/node-metric-read.v1.json)。当前与历史用例均保存在[联调验收记录](spaces/implementation-review.md#实测记录)，其中区分 Mock、本地 API 与真实节点证据。评审时记录 runId、实际构建与三端观察值。

| 接单前仍要落实的事项 | 主责与截止点 | 解锁条件 |
|---|---|---|
| 测试租户、镜像、域名和资源绑定 | 测试 / 控制面 · GA-02，GA-10 真机验收前 | 两个租户各有一台可采集的 Ubuntu 24.04 LTS/amd64 测试节点，记录 socket 权限、TenantData / AgentConn 绑定。GA-03 实现同源 Cookie / CSRF 与节点授权。 |
| 下游仓与发行配置 | Go · GA-04 | 在 GA-01 指定的产品仓建立模块，验证服务以约定 UID 连接本机 socket，登记构建版本。 |
| 独立容器重启的目标绑定与执行标记 | Go / 控制面 · 候选写操作拆工前 | 与原生容器操作核对 ID、版本、互斥和结果来源；确定权限、operation 和工时。 |
| 独立数据库的备份与隔离恢复 | 数据库 / Go / 测试 · 候选备份、恢复拆工前 | 确认支持的数据库引擎和目标、分开授权、备份制品范围、恢复前保护及回读样本。按实际入口单独估时。 |

## 源码基线与本次修订

本次复核的本地代码为下表所列 1Panel 和 Console 提交。PRD 一行记录首次拆工所依据的原稿，此前派工基线见提交 `2a8ad07`。接单人登记实际构建与下游补丁，再核对所用入口。

| 仓库 | 分支与完整提交 | 本轮核对范围 |
|---|---|---|
| AngelFleetPRD | `main@f3394afeb37c89145c5b58017ed49d815902ce61` | 主方案 §13–15、附录 A/C/D，详细设计、操作台账及验收注册表 |
| 1Panel | `dev-v2@aaba86d0ef71a31ee319e74998ffe83c64abf4b6` | 原全量矩阵固定在 `cedb8dd`。两版本相差 38 个提交，本次按启动、采样、普通 OpenResty 重启和网站备份/恢复重新核对 |
| AngelFleetConsole | `main@df715b38d174b2bdad7a5ab58150c05ead6c5d36` | 管理页面、API 主路由、环境绑定、[现有权限检查](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/cloudflare/api/src/lib/permissions.ts)、审计及测试入口 |

本次排期沿用 Console 的账号、权限与审计入口，节点路由、AgentConn 和命令存储仍需开发。替代场景应从实际容器与数据库入口重新验证执行标记和恢复路径。基线与源码定位见[技术详细设计](technical-design.md)和[Go 操作台账](operation-ledger.md#源码核验记录)。
