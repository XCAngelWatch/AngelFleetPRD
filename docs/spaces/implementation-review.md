# 1Panel 适配实施与联调

三个工作包均待真机验证。准备两个隔离租户及各自的 Linux 测试节点 A、B，使用有权访问相应节点的测试账户。主方案迁移矩阵固定在 `cedb8dd`，下列三个入口已按 `aaba86d` 核对。执行时按页末记录表选取场景，先保存输入和预期，再填实测值与脱敏证据。[主方案基线](https://github.com/1Panel-dev/1Panel/commit/cedb8ddda9254bdef0fddba96b7fa59c6ab8c633) · [本轮源码基线](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

## 工作包一 · 节点只读取样

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

## 工作包三 · 网站备份与归档核验

备份**创建**的云端 operation 名和授权权限待确定。当前可用测试适配器和测试命令标识验证 Go 创建入口、两库记录、本地归档及对账逻辑，报告中注明「节点适配器」。云端端到端验收待创建操作与权限确定后再执行。`backup.restore` 是另行登记的还原操作，须在隔离目标上按 AC-RECOVERY 验收。[Go 操作台账](https://xcangelwatch.github.io/AngelFleetPRD/operation-ledger.md) · [源码适配详设](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-7-4)

1. **冻结预期清单。** 各选一个本地 PHP 和受管 runtime 站点，记录站点别名、runtime 来源、数据库关联及预期归档成员。均核对网站配置、站点数据以及已关联数据库，按各自的 runtime 来源判定子包。[归档组成](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L261-L316)
2. **卡在两库写回之间。** 在归档关闭时登记 `commandId`、`localTaskId`、`backupRecordId`、文件位置、长度、整文件 SHA-256、采集方及时间。在 `Task.Execute` 成功后、业务记录写回前中断。恢复后快照应显示任务 Success、备份记录 Waiting。用原关联核对成员，独立复算长度和摘要，再用一组故意移除关闭凭据的样本复测。两组分别保留对账前后 Go 备份入口计数。原任务子步骤的重试单列。[异步写回及内部重试配置](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L222-L246) · [本地任务写回](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/task/task.go#L317-L362)

## 实测记录

**每次运行填一次。** `runId`〔待填〕，租户／节点／incarnation〔待填〕，Go／适配器／XC 版本〔待填〕，验证层级〔待填〕。有请求链路时填 `traceId`，有命令时填 `commandId`，发生云端投递时填实际路径（直连或 outbox 补偿）。只读或本地试验可将不适用的字段标为「不适用」。复制本次运行对应的行，记下触发时刻和实测值，并附脱敏证据。[详设验收与证据](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-6)

**如何判定。** 预期 `UNCERTAIN` 的一行须同时看到原 `commandId`、实测命令状态 `UNCERTAIN` 和对账前后业务入口新增调用为 0。实测仍为 `RUNNING` 时，该次观察未达到预期。故意移除的关闭凭据应记录为故障输入。若测试人员漏采状态或入口计数，结论填「待核对」并列出缺项。调用次数按同一命令进入 Compose 重启或 Go 备份入口计数，容器数和归档数只作佐证。

| 场景与验收项 | 触发时点与预期 | 应附的脱敏证据 | 实测值／证据链接 | 评审结论 |
|---|---|---|---|---|
| 节点概览 · AC-HOST | 读取节点 A 的概览，页面指标与本次有效采样一致 | 节点标识、原始字段与页面读数 | 待测／待附 | 待执行 |
| 速率换算 · AC-HOST | 两次有效样本间隔 2 秒，发送显示 2 KiB/s，磁盘读取显示 2 MiB/s | 两次累计值、时刻、选择器及页面值 | 待测／待附 | 待执行 |
| 有效零速率 · AC-HOST | 同一基线下累计计数保持不变，收发或读写的对应速率为 0 | 有效样本对与页面值 | 待测／待附 | 待执行 |
| 旧节点响应晚到 · AC-UI | 先展示 B 再交付 A 的旧响应，页面仍显示 B | 两次请求的租户、节点、交付顺序与页面值 | 待测／待附 | 待执行 |
| 更换网卡 · AC-HOST、AC-UI | 新网卡首样本显示等待，以第二个有效样本计算速率 | 选择器、两次计数与时刻 | 待测／待附 | 待执行 |
| 采集失败 · FI-HOST、AC-HOST | 有效采样后令该指标采集报错，保留原值和成功时刻并标记 `stale` | 采集错误、前后 `sampledAt` 与页面值 | 待测／待附 | 待执行 |
| 节点断线 · FI-HOST、AC-UI | 有成功样本后断线，页面标记 `stale`，最后成功时刻保持原值 | 连接事件、前后 `sampledAt` 与页面值 | 待测／待附 | 待执行 |
| 重启受理响应丢失 · AC-CMD、FI-CMD | 原请求重试回放同一命令，全程一次实际重启 | 原收据、重试响应、重启入口计数 | 待测／待附 | 待执行 |
| 重启成功后刷新失败 · FI-APP、FI-CMD | 可归因的启动证据齐全，原命令为 `SUCCEEDED`，对账新增调用 0 | 原错误、操作标记、容器前后快照、入口计数 | 待测／待附 | 待执行 |
| 刷新失败且只能证明当前健康 · FI-APP、FI-CMD | 原命令为 `UNCERTAIN`，对账新增调用 0 | 原错误、命令状态、已有快照及入口计数 | 待测／待附 | 待执行 |
| 本地 PHP 站点组成 · AC-APP | 预期成员齐全，本地 PHP 样本跳过受管 runtime 子包 | 执行前清单、数据库关联、归档成员 | 待测／待附 | 待执行 |
| 受管 runtime 站点组成 · AC-APP | 预期成员齐全，含受管 runtime 子包 | 执行前清单、数据库关联、归档成员 | 待测／待附 | 待执行 |
| 备份两库写回间中断 · AC-FILE、FI-CMD | 原归档成员、长度与摘要核对通过，补记本地完成，对账新增调用 0 | 两库快照、原绑定、关闭凭据、复算值、入口计数 | 待测／待附 | 待执行 |
| 中断后缺失关闭凭据 · FI-CMD | 故意移除凭据，原测试命令为 `UNCERTAIN`，对账新增调用 0 | 注入记录、命令状态、两库快照及入口计数 | 待测／待附 | 待执行 |
