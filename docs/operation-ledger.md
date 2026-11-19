# 节点操作与权限

Go、控制面和测试按本页登记节点动作。先明确谁对哪个资源有权操作，再固定执行入口、取消时点和结果证据。M1 计划试点 `node.inspect`，通过 GA-10 双租户真机验收后开放。其他动作须完成登记与真机验证，研发可在[研发计划](engineering-roadmap.md#后续工作包与估算)领取工单。

## 操作登记与执行边界

| 操作与许可 | 开始执行前核对什么 | 启动、取消与结果核对 |
|---|---|---|
| `node.inspect` · M1 · Viewer／`node.read` | 核对租户、节点授权和 incarnation。只读适配器调用固定的本机 Dashboard 路由。 | 用原 commandId 关联本机样本，重复投递返回原结果。可取消请求；每项按自己的来源命令和时间回读。[采样契约](go-agent-interface-contract.md#53-逐指标读取与冷启动展示) |
| `container.ensure` · CORE-04 · Operator／`container.manage` | 核对目标容器或 Compose 项、配置摘要、资源版本；同一容器、卷和项目使用同一互斥入口。 | 记录稳定的 localTaskId，按受管标签、配置摘要和运行状态核对。取消仅停止后续步骤。独立重启另行登记。 |
| `file.install` · CORE-02 · Operator／`file.write` | 确认制品 READY、整件 SHA-256、目标目录和容量，核对路径、磁盘与升级锁。 | 以 cloudCommandId 和 artifactId 关联 checkpoint。验证临时文件再原子替换；替换前可取消，替换后核对路径、大小、摘要和 manifest。 |
| `backup.restore` · OPS-02 至 04 · Admin 单独获授 `backup.restore` | 校验归档归属、摘要、目标库或目录、资源版本及恢复窗口，设置回滚点，与本地 Cron 备份互斥。 | 用原 cloudCommandId 和 checkpoint 记录切换位置。切换前可取消，切换后按保护点恢复；数据库须查询已知样本，无法证明结果时转人工核查。 |
| `host.reboot` · FOLLOW-07 · Admin／`host.reboot` | 确认业务影响、任务排空、节点锁与升级互斥。 | 在发起前记录 cloudCommandId 与 operationMarker。发起前可取消；连接断开显示重启中，恢复后核对 boot identity、启动时间及健康。 |
| `disk.format` · CORE-02 · 受限 Admin／`disk.destructive` | 核对稳定设备标识、签名意图、二次确认、节点与设备锁。 | 写入前持久化 cloudCommandId 与 operationMarker。发起前可取消；断电后只读核对真实设备、文件系统及人工证据，禁止自动重放。 |
| `terminal.open` · CORE-06 · Operator／`terminal.open` | 校验会话角色票据、节点能力、每节点配额和维护模式，按本机 PTY、SSH 或容器 exec 接入。 | 用 terminalId、leaseSequence 与 authorizationVersion 关联 PTY。撤权送达即关，通知丢失按绝对租约关闭。核对流序号和关闭时间，未确认的输入不重放。 |
| `service.restart` · 历史模板 · Operator／`service.manage` | 原 OpenResty 例绑定 installId、版本与原实例锁。本轮已移出。 | 历史方案按原命令、实例、进程启动时间及容器状态核对。已发生的重启无法撤回。[历史工单](go-agent-development-plan.md#已移出的历史工单) |

## 工单与操作登记

独立容器重启与备份创建的 operation、权限键和实际持锁入口仍待登记。控制面登记动作和最小权限，Go 固定原资源和执行标识，测试按同一 commandId 对照节点事实。每项记录源码提交、适用版本、引擎及部署形态。

| 当前要接的动作 | 必须取得的业务证据 |
|---|---|
| CORE-04 · Operator 在获准容器执行独立重启 | 固定不可变容器 ID、版本及执行标记。正常请求原容器重启 1 次，重复投递、丢回执后对账均新增 0 次。启动前撤权或同名目标改绑时两个容器都不重启。留 Docker 事件及 Go 入口计数。 |
| OPS-02 · Operator 对获准实例及数据库创建备份 | 记录备份任务、原始库、归档位置及摘要。备份已知样本 A 后，用隔离恢复验证归档。 |
| OPS-02 · Admin 获准在隔离库恢复 MySQL | 固定原归档、目标实例、版本与恢复前样本 B。成功恢复读回 A，中断回滚读回 B。仅持备份创建权的账号请求恢复，B 保持原样。重复回执新增顶层恢复 0 次。 |

写操作共用 GA-11 的启动授权、执行标记和只读对账。Console、原面板和本地定时任务能写同一资源时，须在真实 Go 入口共享互斥机制，或由一方独占写入。回退时先停新写、对账在途任务，再交还原入口。[命令投递与对账](technical-design.md#命令投递执行与对账) · [填写实测记录](spaces/implementation-review.md#实测记录)

## 从迁移基线到当前节点代码

2026-11-19 核对本地 1Panel `dev-v2`，`sourceCommit=aaba86d0ef71a31ee319e74998ffe83c64abf4b6`。全量迁移矩阵冻结于 `cedb8dd`。下表只记录之间 38 个提交对首批工作的影响。[源码快照](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6) · [两次提交的差异](https://github.com/1Panel-dev/1Panel/compare/cedb8ddda9254bdef0fddba96b7fa59c6ab8c633...aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

| 范围 | 本次核实的 Go 行为 | 对适配的影响 |
|---|---|---|
| 启动和通信 | 两个模块各由 `cmd/server/main.go` 的 `main` 执行根命令，再调用本模块的 `server.Start`。core 的 `Proxy` 将本机非 core 业务请求转给 agent。主节点 agent 监听 `/etc/1panel/agent.sock`，其他节点 TLS 监听校验客户端证书。这些入口在此次比较中未变。[agent 启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/cmd/server/cmd/root.go#L8-L13) · [core 启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/core/cmd/server/cmd/root.go#L22-L26) · [core 转发](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/core/init/router/proxy.go#L134-L143) · [agent 监听](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/server/server.go#L128-L177) | 首个真机样本记录节点角色、监听模式和适配器版本。connector 负责向云端注册及建立出站 WSS，本机适配器按登记的操作访问 Go 服务。 |
| 只读采样 | 两条 Dashboard 路由及其服务方法未变。`NodeCurrent` 缺少采集有效性和时间，部分系统调用忽略错误；`DashboardCurrent` 可能携带时间和默认计数。 | GA-07 在 Go 采集点补元数据，兼容既有 Dashboard 客户端。[上游首页请求](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/frontend/src/api/modules/dashboard.ts#L32-L36) |
| 普通 OpenResty 重启 | 期间 `app_install.go` 的变更涉及 `UpdateAppConfig` 写 WebUI，普通 Compose 重启分支未变。 | 原 GA-12 的标记与查询设计归档。[操作请求 DTO](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/request/app.go#L92-L109) |
| 网站备份与恢复 | `aea4de1c7` 修改创建和还原逻辑，两者对本地 PHP 均跳过受管 runtime 子包，上游用例只断言文件存在。[相关提交](https://github.com/1Panel-dev/1Panel/commit/aea4de1c7) · [上游测试](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website_test.go#L69-L76) | 原 GA-15、GA-17 的 PHP/runtime 站点样本移出。[上游备份表单](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/frontend/src/components/backup/index.vue#L339-L356) |

## 源码核验记录

CORE-04 核对独立容器的 [ContainerOperation → Docker ContainerRestart](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/container.go#L777-L804)，OPS-02 核对数据库的 [MysqlBackup / MysqlRecover](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_mysql.go#L26-L69)。将测试容器的不可变 ID、数据库实例/库名及恢复目标作为新的核验对象。实施时核对当前构建支持的引擎、目标、命令授权和恢复回读证据，按适用范围分别登记。后列的网站和 OpenResty 记录属裁剪前源码事实。

- **节点概览 · GA-07。** `GET /api/v2/dashboard/current/node` → `DashboardService.LoadCurrentInfoForNode` → `NodeCurrent`。M1 使用 `cpuUsedPercent` 和 `memoryUsed`。在下游增加 `data.collection`，保留原字段，供 connector 按指标有效性生成命令结果。[概览采样方法](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L146) · [概览字段](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L79-L99) · [GA-01 字段与报文](go-agent-interface-contract.md)
- **扩展仪表盘速率。** `GET /api/v2/dashboard/current/:ioOption/:netOption` → `LoadCurrentInfo` → `DashboardCurrent`。使用带有效性的累计网络、磁盘字节和 `shotTime`，按同节点、同选择器计算差值。[采样路由](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/router/ro_dashboard.go#L25-L26) · [计数和采样时间](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L132-L151)
- **OpenResty 重启 · 原 GA-12。** `POST /api/v2/apps/installed/op` → `AppInstalledOperate` → `AppInstallService.Operate`。普通分支按 `installId` 执行 `compose.Restart`，再调用 `syncAppInstallStatus`。本分支未给 `taskID` 写持久对应关系；适配层需保留原实例、操作标记及启动前后证据。[Go 处理器](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/api/v2/app_install.go#L173-L182) · [执行分支](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L265-L321)
- **备份创建 · 原 GA-14 至 GA-16。** `BackupService.WebsiteBackup` 按别名查站点，在 `agent.db` 创建含 `taskID` 的 Waiting 记录，`handleWebsiteBackup` 启动独立任务，调用 `doWebsiteBackup` 并在任务返回后写回业务记录。适配器须固定 `commandId → localTaskId / backupRecordId`，在归档关闭时记录成员、长度及 SHA-256。[本地受理](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L29-L61) · [任务与业务记录写回](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L222-L246)
- **网站恢复 · 原 GA-17 至 GA-19。** `WebsiteRecover` 找不到目标会返回错误；找到站点后，`handleWebsiteRecover` 的启动错误仅写日志，外层返回 nil。独立任务先备份目标供回滚，再恢复成员并重载。适配器需让启动错误可查询，将已核验的归档、目标、原任务和 checkpoint 持久关联。[恢复入口及回滚前备份](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L64-L95) · [现场写入、回滚与任务启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L159-L219)
