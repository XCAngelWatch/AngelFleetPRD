# Go 操作改造台账

2026-11-19 核对本地 1Panel `dev-v2`，工作区干净，`sourceCommit=aaba86d0ef71a31ee319e74998ffe83c64abf4b6`。本轮覆盖节点启动与采样、普通 OpenResty 安装实例重启、网站备份创建与恢复。下表的 `PLANNED` 指 AngelFleet 仍需完成适配与联调。其余操作的源码和证据在各自工作包补录。命令类操作使用 commandId、幂等收据和 tombstone。终端流会话按 terminalId、leaseSequence 和撤销版本核验。[源码快照](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6) · [Go Agent 研发计划](go-agent-development-plan.md)

## 从迁移基线到当前节点代码

主方案的完整功能矩阵仍以 `cedb8dd` 为基线。对照其后 38 个提交，首批工作包的变化如下。[两次提交的差异](https://github.com/1Panel-dev/1Panel/compare/cedb8ddda9254bdef0fddba96b7fa59c6ab8c633...aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

| 范围 | 本次核实的 Go 行为 | 对适配的影响 |
|---|---|---|
| 启动和通信 | 两个模块各由 `cmd/server/main.go` 的 `main` 执行根命令，再调用本模块的 `server.Start`。core 的 `Proxy` 将本机非 core 业务请求转给 agent。主节点 agent 监听 `/etc/1panel/agent.sock`，其他节点 TLS 监听校验客户端证书。这些入口在此次比较中未变。[agent 启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/cmd/server/cmd/root.go#L8-L13) · [core 启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/core/cmd/server/cmd/root.go#L22-L26) · [core 转发](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/core/init/router/proxy.go#L134-L143) · [agent 监听](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/server/server.go#L128-L177) | 首个真机样本记录节点角色、监听模式和适配器版本。connector 负责向云端注册及建立出站 WSS，本机适配器按登记的操作访问 Go 服务。 |
| 只读采样 | 两条 Dashboard 路由及服务方法未变。`LoadCurrentInfoForNode` 忽略负载、内存采集的错误，DTO 不带采样时间。`LoadCurrentInfo` 在主机信息读取失败时仍可返回带 `shotTime` 的空计数。[概览读取](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L146) · [速率读取](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L188-L196) | 在 Go 采样点补充各指标有效性和采样时刻，按节点身份回传。失败时保留该指标上次有效读数与时间。 |
| 普通 OpenResty 重启 | 两版本间 `app_install.go` 仅改变 `UpdateAppConfig` 的 WebUI 写入实现，`AppInstallService.Operate` 的普通 Compose 重启分支未变。[当前执行分支](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L294-L321) | 在实际进入 Compose 的位置留下可归因的执行标记。丢回执后按原命令查现场并记录新增重启调用数。 |
| 网站备份与恢复 | `aea4de1c7` 使 `doWebsiteBackup` 与 `handleWebsiteRecover` 均跳过本地 PHP 的 runtime 子包，有关联数据库时仍处理数据库。新增上游用例只断言本地 PHP 归档文件存在。[相关提交](https://github.com/1Panel-dev/1Panel/commit/aea4de1c7) · [上游测试](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website_test.go#L69-L76) | 创建分别取本地 PHP 和受管 runtime 的站点样本，核对成员及归档摘要。恢复用隔离目标另验数据、配置、服务及中断后的结果。 |

## 命令类操作

| operation | 目标阶段 | Go 复用/改造边界 | taskId / operationMarker | 取消边界 | 结果核验 | 跨入口互斥 | status |
|---|---|---|---|---|---|---|---|
| `node.inspect` | P2 | 复用 Dashboard 节点采样，适配 DTO、采样时间和 stale | 记录 commandId 和采样来源 | 可安全取消请求 | 重新采样并核对 node incarnation | 节点维护模式只读放行 | PLANNED |
| `service.restart` | P3 | 已核实普通 OpenResty 安装实例的 Compose 重启分支，需增设持久执行标记和现场查询 | `cloudCommandId` + `operationMarker`，记录 installId 和版本 | 启动前可取消，已发起只核对 | 原安装实例、容器身份与启动时间、状态和版本 | 按本节点 installId 加锁，同实例的证书操作和升级共用 | PLANNED |
| `container.ensure` | P3 | 复用 Docker/Compose service；补目标摘要和资源锁 | 优先传入稳定 `localTaskId` | 仅停止后续步骤 | 受管标签、目标配置摘要、运行状态 | 同一容器/卷/Compose 项互斥 | PLANNED |
| `file.install` | P3 | 复用文件落盘；新增 R2 artifact 校验与原子替换边界 | `cloudCommandId` + artifactId | 临时文件阶段可取消；替换后按契约核对 | SHA-256、大小、目标路径和 manifest | 目标路径、磁盘和升级锁 | PLANNED |
| `backup.restore` | P5 | 复用恢复内核；补 checkpoint、版本和跨存储对账 | `cloudCommandId` + restore checkpoint | 恢复前可取消；切换后只允许声明的补偿 | manifest、版本、任务水位、现场状态 | volume、服务和 Cron 备份互斥 | PLANNED |
| `host.reboot` | P4 | 复用 Go 重启入口；补 boot identity、恢复健康和 fence 检查 | `cloudCommandId` + `operationMarker` | 发起前可取消；已重启只核对恢复 | boot identity、启动时间、节点健康 | 节点锁；升级与破坏性操作互斥 | PLANNED |
| `disk.format` | P4 | 复用受限磁盘入口；补签名意图、二次确认和效果去重 | `cloudCommandId` + `operationMarker` | 发起前可取消；副作用后禁止自动重放 | 设备稳定标识、文件系统摘要、人工证据 | 节点/设备锁；所有其他写入互斥 | PLANNED |

## 流会话类操作

| operation | 目标阶段 | Go 复用/改造边界 | 会话标识 | 关闭边界 | 结果核验 | 跨入口互斥 | status |
|---|---|---|---|---|---|---|---|
| `terminal.open` | P3 | 复用 PTY/SSH/exec；补 Relay、租约、撤销、背压 | `terminalId` + `leaseSequence` + `authorizationVersion` | 到期或撤销立即关闭；不重放未知 stdin | PTY 身份、租约截止、流序号 | 每节点终端配额和维护模式 | PLANNED |

## 源码核验记录

- **节点概览。** `GET /api/v2/dashboard/current/node` 调用 `LoadCurrentInfoForNode`，返回 `NodeCurrent` 中的 CPU、负载、内存和交换空间。适配层在采样点补节点身份、采样时刻及各指标有效性。AC-HOST 用真实节点样本核对读数。[概览采样方法](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L146) · [概览字段](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L79-L99)
- **仪表盘速率。** `GET /api/v2/dashboard/current/:ioOption/:netOption` 调用 `LoadCurrentInfo`。对同一节点及选择器，用两份有效 `DashboardCurrent` 的网络、磁盘累计字节数及 `shotTime` 计算速率。AC-HOST 核对换算值，AC-UI 检查切换节点后的迟到响应，FI-HOST 检查采集失败后保留的最后有效值与时刻。[采样路由](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/router/ro_dashboard.go#L25-L26) · [计数和采样时间](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/dto/dashboard.go#L132-L151)
- **OpenResty 安装实例重启。** `POST /api/v2/apps/installed/op` 绑定 `AppInstalledOperate` 并调用 `AppInstallService.Operate`。普通 OpenResty 分支按安装 ID 查记录，执行 Compose 重启并同步状态。此分支不会将 `taskID` 持久关联到这次重启，适配层须记录原目标、执行标记和启动证据。AC-CMD、FI-CMD、NET-CMD 按详情页的重启、回执丢失与实例改绑用例验收。Compose 成功后刷新状态报错的用例对应 FI-APP 和 FI-CMD。[Go 处理器](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/api/v2/app_install.go#L173-L182) · [执行分支](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L265-L321) · [技术详细设计](technical-design.md)
- **网站备份创建。** `BackupService.WebsiteBackup` 按别名定位站点，保存带 `taskID` 的 Waiting 业务记录，随后由独立任务执行 `doWebsiteBackup` 并更新业务记录。测试适配器先固定命令与站点，用同一命令关联 `localTaskId`、`backupRecordId` 及归档关闭时的成员清单、长度和 SHA-256。在任务成功与业务记录写回之间中断，恢复后核对原任务和归档，要求原命令的创建入口新增调用为 0。证据缺失时保留 `UNCERTAIN`。云端操作名称、权限及注册项确定后再验收云端提交。对应 AC-APP、AC-FILE、FI-CMD。[本地受理](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L29-L61) · [任务与业务记录写回](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L222-L246) · [云端操作注册表](technical-plan.md#c2-operation-registry-初始示例)
- **网站恢复。** `BackupService.WebsiteRecover` 在找到站点后，遇到 `handleWebsiteRecover` 的启动错误仅记录日志并返回 nil。正常分支异步执行恢复任务，先备份目标用于回滚，再恢复归档成员、重载 OpenResty 并写回站点。P5 适配需使启动错误可查询，把原命令绑定到已核验的源归档、目标站点、任务与持久 checkpoint。AC-RECOVERY 在隔离目标核对恢复前快照、恢复后的站点内容、关联数据库样本及服务响应。FI-RECOVERY 在目标修改过程中中断，按 checkpoint 核对继续或回滚的结果，保留证据不足的原命令供复核。[恢复入口及回滚前备份](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L64-L95) · [现场写入、回滚与任务启动](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L159-L219)

台账完成条件：每行补齐真实入口文件和符号、`sourceCommit`、允许修改目录、工作包、AC/FI/CAP/NET 证据以及适用 profile；命令类行必须与附录 C.2 registry 一一对应，流会话单独按 lease/stream 契约验收；`GAP_PRIVATE` 和 `UNSUPPORTED` 仍需保留适用性证据，不能被统计脚本当作已完成。
