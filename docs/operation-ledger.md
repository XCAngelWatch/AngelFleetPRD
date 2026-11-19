# Go 操作改造台账

按 operation 查找 Go 入口、需要补的适配、执行标识、互斥范围和结果核验方法。表内 `PLANNED` 表示节点适配与真机验收待完成。状态机、调用顺序和验收数据各有对应入口。[操作注册表](technical-plan.md#c2-operation-registry-初始示例) · [执行顺序](technical-design.md#2-按持久化边界推进任务) · [联调记录](spaces/implementation-review.md#实测记录) 本轮适用性见[本轮非 AI 功能迁移清单](technical-plan.md#137-本轮非-ai-功能迁移清单)；旧网站/商店入口仅供历史设计追踪。

## 从迁移基线到当前节点代码

2026-11-19 核对本地 1Panel `dev-v2`，`sourceCommit=aaba86d0ef71a31ee319e74998ffe83c64abf4b6`。全量迁移矩阵冻结于 `cedb8dd`。下表只记录之间 38 个提交对首批工作的影响。[源码快照](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6) · [两次提交的差异](https://github.com/1Panel-dev/1Panel/compare/cedb8ddda9254bdef0fddba96b7fa59c6ab8c633...aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

| 范围 | 本次核实的 Go 行为 | 对适配的影响 |
|---|---|---|
| 启动和通信 | 两个模块各由 `cmd/server/main.go` 的 `main` 执行根命令，再调用本模块的 `server.Start`。core 的 `Proxy` 将本机非 core 业务请求转给 agent。主节点 agent 监听 `/etc/1panel/agent.sock`，其他节点 TLS 监听校验客户端证书。这些入口在此次比较中未变。[agent 启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/cmd/server/cmd/root.go#L8-L13) · [core 启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/core/cmd/server/cmd/root.go#L22-L26) · [core 转发](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/core/init/router/proxy.go#L134-L143) · [agent 监听](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/server/server.go#L128-L177) | 首个真机样本记录节点角色、监听模式和适配器版本。connector 负责向云端注册及建立出站 WSS，本机适配器按登记的操作访问 Go 服务。 |
| 只读采样 | 两条 Dashboard 路由及其服务方法未变。`NodeCurrent` 缺少采集有效性和时间，部分系统调用忽略错误；`DashboardCurrent` 可能携带时间和默认计数。 | GA-07 在 Go 采集点补元数据，兼容既有 Dashboard 客户端。[上游首页请求](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/frontend/src/api/modules/dashboard.ts#L32-L36) |
| 普通 OpenResty 重启 | 期间 `app_install.go` 的变更涉及 `UpdateAppConfig` 写 WebUI，普通 Compose 重启分支未变。 | 原 GA-12 的标记与查询设计归档。[操作请求 DTO](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/request/app.go#L92-L109) |
| 网站备份与恢复 | `aea4de1c7` 修改创建和还原逻辑，两者对本地 PHP 均跳过受管 runtime 子包，上游用例只断言文件存在。[相关提交](https://github.com/1Panel-dev/1Panel/commit/aea4de1c7) · [上游测试](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website_test.go#L69-L76) | 原 GA-15、GA-17 的 PHP/runtime 站点样本移出。[上游备份表单](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/frontend/src/components/backup/index.vue#L339-L356) |

## 命令类操作

命令使用 `commandId`、幂等收据和去重保留记录（tombstone）。网站备份创建已经移出，不登记云端操作。独立容器重启已纳入 CORE-04，数据库备份与隔离恢复纳入 OPS-02、OPS-03。各包估算见[研发派工单](go-agent-development-plan.md)，目标类型与权限按下表和 C.2 核定。

| operation | 目标阶段 | Go 复用/改造边界 | taskId / operationMarker | 取消边界 | 结果核验 | 跨入口互斥 | status |
|---|---|---|---|---|---|---|---|
| `node.inspect` | P2 | GA-07 补本机采集有效性和时间。GA-08 分别保存当次命令结果与[逐指标读模型](technical-design.md#72-节点采样怎样进入-xc-仪表盘)，两种读取均需 `node.read` 与目标节点授权 | 原始 `commandId`、incarnation、Go 样本及指标来源命令 | 可安全取消请求 | 对照各项来源命令的原始值和采样时刻；部分失败后清缓存仍能追溯两次采集 | 节点维护模式只读放行 | PLANNED |
| `service.restart` | 原 P3 场景 | 原 OpenResty 安装实例的 Compose 分支，仅保留源码映射 | 原示例关联 commandId、installId 和版本 | 启动前可取消 | 原实例、容器身份与启动时间 | 原实例锁 | OpenResty 适配移出 |
| `container.ensure` | P3 | 复用 Docker/Compose service；补目标摘要和资源锁 | 优先传入稳定 `localTaskId` | 仅停止后续步骤 | 受管标签、目标配置摘要、运行状态 | 同一容器/卷/Compose 项互斥 | PLANNED |
| `file.install` | P3 | 复用文件落盘；新增 R2 artifact 校验与原子替换边界 | `cloudCommandId` + artifactId | 临时文件阶段可取消；替换后按契约核对 | SHA-256、大小、目标路径和 manifest | 目标路径、磁盘和升级锁 | PLANNED |
| `backup.restore` | P5 | C.2 登记通用恢复；OPS-02 至 OPS-04 核定各引擎/目录目标、恢复窗和范围，网站适配已移出 | `cloudCommandId` + restore checkpoint | 恢复前可取消；切换后仅执行已定义补偿 | 原归档、目标版本、任务水位与目标实测 | 目标资源和 Cron 备份互斥 | 数据库适配待核 |
| `host.reboot` | P4 | 复用 Go 重启入口；补 boot identity、恢复健康和 fence 检查 | `cloudCommandId` + `operationMarker` | 发起前可取消；已重启只核对恢复 | boot identity、启动时间、节点健康 | 节点锁；升级与破坏性操作互斥 | PLANNED |
| `disk.format` | P4 | 复用受限磁盘入口；补签名意图、二次确认和效果去重 | `cloudCommandId` + `operationMarker` | 发起前可取消；副作用后禁止自动重放 | 设备稳定标识、文件系统摘要、人工证据 | 节点/设备锁；所有其他写入互斥 | PLANNED |

### 工单与操作登记

Go 入口由下游适配人员按工单核对。GA、FOLLOW、CORE、OPS 是派工编号；C.2 登记的 operation 与权限标识表示协议设计。候选操作先登记名称、资源范围、最小权限和受支持目标，再绑定执行器。读接口、独立终端会话和纯控制台设置分别按其接口类别记录，纯控制台设置的 Go 入口填「不适用」。

| 工单 / 动作 / 登记状态 | Go 适配与前置 | 控制台准入 | 测试与状态 |
|---|---|---|---|
| 〔工单 ID、具体动作、C.2 项或待登记项〕 | 〔源码提交/入口、支持目标、命令/会话/查询类型、落盘与对账依据〕 | 〔权限或待定项、租户/节点/资源范围、授权版本、准入拒绝条件〕 | 〔用例、实际状态、runId 与脱敏证据；未执行填 PLANNED〕 |

CORE-04 在 Docker 容器入口验证重启；原 `service.restart` 的 OpenResty 示例和 `container.ensure` 各有既定语义，容器重启需核定独立映射。OPS-02 的备份创建与恢复分别鉴权。`backup.restore` 已登记 Admin 能力，数据库目标及其适配须另有测试结果。逐项取证见[工单验收模板](spaces/implementation-review.md#按工单提交验收)。

## 流会话类操作

| operation | 目标阶段 | Go 复用/改造边界 | 会话标识 | 关闭边界 | 结果核验 | 跨入口互斥 | status |
|---|---|---|---|---|---|---|---|
| `terminal.open` | P3 | 复用 PTY/SSH/exec；补 Relay、租约、撤销、背压 | `terminalId` + `leaseSequence` + `authorizationVersion` | 到期或撤销立即关闭；不重放未知 stdin | PTY 身份、租约截止、流序号 | 每节点终端配额和维护模式 | PLANNED |

## 源码核验记录

CORE-04 核对独立容器的 [ContainerOperation → Docker ContainerRestart](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/container.go#L777-L804)，OPS-02 核对数据库的 [MysqlBackup / MysqlRecover](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_mysql.go#L26-L69)。将测试容器的不可变 ID、数据库实例/库名及恢复目标作为新的核验对象。实施时核对当前构建支持的引擎、目标、命令授权和恢复回读证据，按适用范围分别登记。后列的网站和 OpenResty 记录属裁剪前源码事实。

- **节点概览 · GA-07。** `GET /api/v2/dashboard/current/node` → `DashboardService.LoadCurrentInfoForNode` → `NodeCurrent`。M1 使用 `cpuUsedPercent` 和 `memoryUsed`。在下游增加 `data.collection`，保留原字段，供 connector 按指标有效性生成命令结果。[概览采样方法](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L146) · [概览字段](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L79-L99) · [GA-01 字段与报文](go-agent-interface-contract.md)
- **扩展仪表盘速率。** `GET /api/v2/dashboard/current/:ioOption/:netOption` → `LoadCurrentInfo` → `DashboardCurrent`。使用带有效性的累计网络、磁盘字节和 `shotTime`，按同节点、同选择器计算差值。[采样路由](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/router/ro_dashboard.go#L25-L26) · [计数和采样时间](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L132-L151)
- **OpenResty 重启 · 原 GA-12。** `POST /api/v2/apps/installed/op` → `AppInstalledOperate` → `AppInstallService.Operate`。普通分支按 `installId` 执行 `compose.Restart`，再调用 `syncAppInstallStatus`。本分支未给 `taskID` 写持久对应关系；适配层需保留原实例、操作标记及启动前后证据。[Go 处理器](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/api/v2/app_install.go#L173-L182) · [执行分支](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L265-L321)
- **备份创建 · 原 GA-14 至 GA-16。** `BackupService.WebsiteBackup` 按别名查站点，在 `agent.db` 创建含 `taskID` 的 Waiting 记录，`handleWebsiteBackup` 启动独立任务，调用 `doWebsiteBackup` 并在任务返回后写回业务记录。适配器须固定 `commandId → localTaskId / backupRecordId`，在归档关闭时记录成员、长度及 SHA-256。[本地受理](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L29-L61) · [任务与业务记录写回](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L222-L246)
- **网站恢复 · 原 GA-17 至 GA-19。** `WebsiteRecover` 找不到目标会返回错误；找到站点后，`handleWebsiteRecover` 的启动错误仅写日志，外层返回 nil。独立任务先备份目标供回滚，再恢复成员并重载。适配器需让启动错误可查询，将已核验的归档、目标、原任务和 checkpoint 持久关联。[恢复入口及回滚前备份](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L64-L95) · [现场写入、回滚与任务启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L159-L219)

每项操作交付时补齐入口文件与符号、`sourceCommit`、允许修改的目录、工作包、适用 profile 和 AC/FI/CAP/NET 证据。C.2 注册表与本页操作逐项对应。流会话单独按租约验收。`GAP_PRIVATE` 和 `UNSUPPORTED` 记录适用性依据。[Go Agent 研发计划](go-agent-development-plan.md) · [联调记录](spaces/implementation-review.md#实测记录)
