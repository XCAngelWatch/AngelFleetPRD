# 1Panel 适配实施与联调

三个工作包均待真机验证。2026-11-19 复核了 1Panel `aaba86d` 的节点执行入口和 AngelFleetConsole `df715b3` 的 API 路由与测试脚本。主方案迁移矩阵基线为 `cedb8dd`。准备两个隔离租户及各自的 Linux 测试节点 A、B，为每个租户配置仅能访问本租户节点的测试账户。执行前填入本次部署的版本；每条结果附实测值与脱敏证据。[主方案基线](https://github.com/1Panel-dev/1Panel/commit/cedb8ddda9254bdef0fddba96b7fa59c6ab8c633) · [本轮 1Panel 源码基线](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6) · [任务与依赖](../go-agent-development-plan.md)

受限账户用于跨租户拒绝用例。切换节点和迟到响应的正向用例另用同时获准访问 A、B 两个上下文的测试身份，并记录当次选择的租户和节点。撤权用例先授予、再撤掉该身份对单一节点的访问权限。

| 验证层级 | 入口和可采信的证据 |
|---|---|
| Console Mock | `pnpm test:e2e` 用设定的响应验证界面、状态切换与显示。节点页面开发后，在这一层覆盖读数过期和切换节点。 |
| 本地 API + SQLite | `pnpm dev:local` 配合 `pnpm test:e2e:local` 验证浏览器、真实 API 和持久化结果。当前 `cloudflare/api/src/router.ts` 的 `routeRequest` 已接入认证、租户、权限和审计。节点接口落地后再追加节点权限和收据用例。 |
| 真实 Linux 节点 | 使用实际控制面、WSS、connector 和 Go 服务，关联浏览器、云端和节点三端记录。只运行节点适配器的试验注明“节点适配器”；端到端结果须覆盖全链路。 |

## 工作包一 · 节点注册与首次可信采样

P1 的节点页面和权限、P2 的注册、连接及 `node.inspect` 完成后，按同一条链路验收。先在 A 完成下列步骤，再用 B 的独立身份核对节点隔离。

1. **绑定节点。** 在授权上下文预登记 A，由节点本地产生密钥并完成挑战。核对登记、一次性凭据消费、节点身份和注册审计归属同一租户。另一次在消费提交后丢弃响应，使用原请求标识及原密钥对新挑战签名恢复。结论要求只保留一个绑定和一份成功消费审计。证据仅保留标识、指纹和时间。[注册契约](../technical-plan.md#a2-一次性注册与节点身份)
2. **核对首个连接。** 用该身份申请短期连接凭证，由 connector 主动连接 AgentConn。核对 Linux 节点 journal 已持久保存本次 `epoch`，再核对云端接受同代次的 `ready` 和首次投递顺序。保留实际连接时间、`nodeId`、`nodeIncarnation`、`epoch` 及协商结果。重连时检查代次单调递增和旧连接失效。[控制协议](../technical-plan.md#a3-控制协议与-agent-本地连接代次隔离)
3. **证明读数来自 A。** 将一次 `node.inspect` 的云端命令、节点 journal、Go 原始样本、适配器记录的采样成功时刻及 Console 显示值按租户、节点、incarnation 和命令标识配对。CPU 和内存读数按页面单位及舍入规则与这一次原样本核对。B 的账户不得读取 A 的样本。仅首次握手或心跳成功时，采样状态仍需等待有效样本。

两个 GET 入口的路径前缀均为 `/api/v2/dashboard`。先按要验证的页面字段选择入口，再把响应与同一节点、同次采样的 XC 显示值配对。[agent 路由](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/router/ro_dashboard.go#L24-L26)

| 验证对象 | 路由与返回类型 | 取样字段与用途 |
|---|---|---|
| 节点概览 | `/current/node` → `NodeCurrent` | 用 `cpuUsedPercent`、`load1`、`memoryUsed` 等核对 CPU、负载和内存。采样时间、有效性由适配器补记。[概览字段](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L79-L99) |
| 网卡与磁盘速率 | `/current/:ioOption/:netOption` → `DashboardCurrent` | 记录磁盘和网卡选择器，用 `ioReadBytes`、`netBytesSent` 的累计差和两次有效 `shotTime` 换算速率。[累计字段与采样时刻](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L132-L150) |

1. **回放有效样本。** 从 `LoadCurrentInfo` 取得同一节点、网卡和磁盘的样本。令两次有效采样相隔 2 秒，发送增加 4096 B、磁盘读取增加 4 MiB，再回放一次计数不变的有效样本。分别记录增长时的换算值和空闲时的零速率。[采集入口](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L188-L196) · [速率计算](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/frontend/src/views/home/index.vue#L1082-L1126)
2. **切换目标并观察失败。** 暂缓 A 的响应，待 B 返回后再交付 A；另在 B 上更换网卡。分别触发指标采集错误和连接中断，保存原始计数、有效性、最后成功的 `sampledAt` 和页面值。[采样与缓存判据](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-7-2)

## 工作包二 · OpenResty 实例重启

1. **记录原目标。** 将 `website-proxy` 绑定到测试节点的 OpenResty 安装实例，记录 `installId`、`resourceVersion`、目标容器身份和 `StartedAt`。在测试适配器上保留操作标记，并对实际进入 Compose 重启分支的次数计数。[重启及状态刷新](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L316-L321)
2. **分别中断受理和刷新。** 在控制面持久受理后丢弃 HTTP 响应，以原 key 和原请求重发。另取一条命令，使 Compose 完成重启后安装状态刷新报错，保留原始错误。分别用能归因的容器快照和只可证明当前健康的样本复测，恢复时只读核对。[详设故障场景](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-6)
3. **丢失节点结果。** 让实际重启完成、节点 journal 持久保存结果后，中断本次结果投递。恢复连接后按原命令核对节点记录，补送结果，核对最终状态、相同事件的合并记录及实际重启次数。分别记录执行结果投递和云端 HTTP 受理的故障时点。

## 工作包三 · 网站备份与归档核验

备份**创建**的云端 operation 名和授权权限待确定。当前可用测试适配器和测试命令标识验证 Go 创建入口、两库记录、本地归档及对账逻辑，报告中注明「节点适配器」。云端端到端验收待创建操作与权限确定后再执行。`backup.restore` 是另行登记的还原操作，须在隔离目标上按 AC-RECOVERY 验收。[Go 操作台账](https://xcangelwatch.github.io/AngelFleetPRD/operation-ledger.md) · [源码适配详设](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-7-4)

1. **冻结预期清单。** 各选一个本地 PHP 和受管 runtime 站点，记录站点别名、runtime 来源、数据库关联及预期归档成员。均核对网站配置、站点数据以及已关联数据库，按各自的 runtime 来源判定子包。[归档组成](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L261-L316)
2. **卡在两库写回之间。** 在归档关闭时登记 `commandId`、`localTaskId`、`backupRecordId`、文件位置、长度、整文件 SHA-256、采集方及时间。在 `Task.Execute` 成功后、业务记录写回前中断。恢复后快照应显示任务 Success、备份记录 Waiting。用原关联核对成员，独立复算长度和摘要，再用一组故意移除关闭凭据的样本复测。两组分别保留对账前后 Go 备份入口计数。原任务子步骤的重试单列。[异步写回及内部重试配置](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L222-L246) · [本地任务写回](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/task/task.go#L317-L362)
3. **单独验收 P5 恢复。** 使用隔离目标和已验证归档，令目标站点文件及关联数据库的测试数据与归档版本有可辨认差异。记录恢复前快照、归档摘要、目标版本、恢复 `commandId`、Go 任务 ID 及 checkpoint。成功用例核对配置、站点文件、关联数据及实际服务读取。中断用例在目标已变更后重启测试 connector，核对原任务、现场水位及补偿记录，对账期间新增顶层恢复调用为 0；现场无法归因时保留待裁决状态。Go `WebsiteRecover` 经 `handleWebsiteRecover` 异步执行，入口返回和原归档生成各自只证明对应步骤。回滚结果另查恢复任务中的回滚子步骤并与恢复前快照核对。[Go 恢复入口与任务](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L64-L95) · [恢复与回滚执行](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L180-L219)

## 实测记录

**每次运行填一次。** `runId`〔待填〕，租户／节点／incarnation〔待填〕，Go／适配器／XC 版本〔待填〕，验证层级〔待填〕。有请求链路时填 `traceId`，有命令时填 `commandId`，发生云端投递时填实际路径（直连或 outbox 补偿）。只读或本地试验可将不适用的字段标为「不适用」。复制本次运行对应的行，记下触发时刻和实测值，并附脱敏证据。[详设验收与证据](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-6)

**如何判定。** 预期 `UNCERTAIN` 的一行须同时看到原 `commandId`、实测命令状态 `UNCERTAIN` 和对账前后业务入口新增调用为 0。实测仍为 `RUNNING` 时，该次观察未达到预期。故意移除的关闭凭据应记录为故障输入。若测试人员漏采状态或入口计数，结论填「待核对」并列出缺项。调用次数按同一命令进入 Compose 重启或 Go 备份入口计数，容器数和归档数只作佐证。

| 场景与验收项 | 触发时点与预期 | 应附的脱敏证据 | 实测值／证据链接 | 评审结论 |
|---|---|---|---|---|
| 预登记与注册响应丢失 · DEV01、DEV02、NET-REG | 用原身份恢复，返回同一节点及 incarnation，成功消费一次 | 原请求标识、公钥指纹、恢复响应标识、绑定及审计行数 | 待测／待附 | 待执行 |
| 注册凭据过期 · DEV01、NET-REG | 过期请求被拒绝，节点身份未绑定，成功消费审计为 0 条 | 有效期与服务器判定时间、拒绝原因、绑定及成功审计计数 | 待测／待附 | 待执行 |
| 首次连接与重连 · DEV03、NET-AGENT | 节点持久化 epoch 后 ready 生效；新代次接管后旧连接无新增投递 | 两端 epoch、ready 与投递时间线、journal 水位 | 待测／待附 | 待执行 |
| 跨租户查看 · AC-AUTH、FI-AUTH | B 的账户读取 A 的节点时被服务端拒绝，响应及页面均无 A 的样本 | 测试角色、目标节点别名、服务端结果和页面 | 待测／待附 | 待执行 |
| 撤销节点查看权限 · AC-AUTH、AC-UI | 撤权后刷新原节点深链接、样本和原命令详情时均被拒绝，旧缓存清除 | 权限变更记录、三次查询结果与页面 | 待测／待附 | 待执行 |
| 首次可信概览 · AC-HOST、AC-UI | 真实节点 A 建链后读取概览，页面 CPU、内存与同一次有效采样一致 | 登记节点标识及 incarnation、命令标识、journal、原始字段、采样时刻与页面读数 | 待测／待附 | 待执行 |
| 速率换算 · AC-HOST | 两次有效样本间隔 2 秒，发送显示 2 KiB/s，磁盘读取显示 2 MiB/s | 两次累计值、时刻、选择器及页面值 | 待测／待附 | 待执行 |
| 有效零速率 · AC-HOST | 同一基线下累计计数保持不变，收发或读写的对应速率为 0 | 有效样本对与页面值 | 待测／待附 | 待执行 |
| 旧节点响应晚到 · AC-UI | 先展示 B 再交付 A 的旧响应，页面仍显示 B | 两次请求的租户、节点、交付顺序与页面值 | 待测／待附 | 待执行 |
| 更换网卡 · AC-HOST、AC-UI | 新网卡首样本显示等待，以第二个有效样本计算速率 | 选择器、两次计数与时刻 | 待测／待附 | 待执行 |
| 采集失败 · FI-HOST、AC-HOST | 有效采样后令该指标采集报错，保留原值和成功时刻并标记 `stale` | 采集错误、前后 `sampledAt` 与页面值 | 待测／待附 | 待执行 |
| 节点断线 · FI-HOST、AC-UI | 有成功样本后断线，页面标记 `stale`，最后成功时刻保持原值 | 连接事件、前后 `sampledAt` 与页面值 | 待测／待附 | 待执行 |
| 重启受理响应丢失 · AC-CMD、FI-CMD | 原请求重试回放同一命令，全程一次实际重启 | 原收据、重试响应、重启入口计数 | 待测／待附 | 待执行 |
| 重启前实例改绑 · FI-CMD、FI-APP | 受理后、启动前改绑服务别名，持锁复核后原命令为 `REJECTED`，新旧两实例重启次数均为 0 | 原收据、改绑时刻和版本、两实例标识与入口计数 | 待测／待附 | 待执行 |
| 节点重启结果投递中断 · AC-CMD、FI-CMD、NET-CMD | 重连补报原命令最终状态 `SUCCEEDED`，该命令一次实际重启，对账新增 0 次 | journal 原结果、事件序号和摘要、云端合并状态、原实例启动证据及入口计数 | 待测／待附 | 待执行 |
| 重启成功后刷新失败 · FI-APP、FI-CMD | 可归因的启动证据齐全，原命令为 `SUCCEEDED`，对账新增调用 0 | 原错误、操作标记、容器前后快照、入口计数 | 待测／待附 | 待执行 |
| 刷新失败且只能证明当前健康 · FI-APP、FI-CMD | 原命令为 `UNCERTAIN`，对账新增调用 0 | 原错误、命令状态、已有快照及入口计数 | 待测／待附 | 待执行 |
| 本地 PHP 站点组成 · AC-APP | 预期成员齐全，本地 PHP 样本跳过受管 runtime 子包 | 执行前清单、数据库关联、归档成员 | 待测／待附 | 待执行 |
| 受管 runtime 站点组成 · AC-APP | 预期成员齐全，含受管 runtime 子包 | 执行前清单、数据库关联、归档成员 | 待测／待附 | 待执行 |
| 备份两库写回间中断 · AC-FILE、FI-CMD | 原归档成员、长度与摘要核对通过，补记本地完成，对账新增调用 0 | 两库快照、原绑定、关闭凭据、复算值、入口计数 | 待测／待附 | 待执行 |
| 中断后缺失关闭凭据 · FI-CMD | 故意移除凭据，原测试命令为 `UNCERTAIN`，对账新增调用 0 | 注入记录、命令状态、两库快照及入口计数 | 待测／待附 | 待执行 |
| 网站恢复 · AC-RECOVERY | 核对目标数据已变更为指定归档版本，服务正常读取 | 恢复前样本、归档版本与摘要、任务及 checkpoint、恢复后的配置与数据样本 | 待测／待附 | 待执行 |
| 恢复受理前拒绝 · AC-AUTH、FI-AUTH、AC-RECOVERY | 分别使用仅有创建权限的账户、其他租户归档及已过期恢复窗口提交，Go 恢复入口新增调用均为 0 | 授权和窗口版本、拒绝记录、目标与入口计数 | 待测／待附 | 待执行 |
| 网站恢复中断 · FI-RECOVERY、FI-RESTORE | 按原命令核对目标、恢复或回滚水位；对账新增顶层恢复调用 0 次 | 中断时刻、任务和现场前后快照、入口计数、最终状态及依据 | 待测／待附 | 待执行 |
