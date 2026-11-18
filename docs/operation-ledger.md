# Go 操作改造台账

本轮在 1Panel `dev-v2` 提交 `aaba86d0ef71a31ee319e74998ffe83c64abf4b6` 上核对节点采样和 OpenResty 安装实例重启。下表的 `PLANNED` 表示目标适配和联调尚待完成。其余操作在 P0 继续登记各自的 `sourceCommit`、文件、符号、实现工作包与验收证据。命令类操作使用 commandId、幂等收据和 tombstone。终端流会话按 terminalId、leaseSequence 和撤销版本核验。[本轮源码快照](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

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

- **节点采样。** `DashboardRouter` 注册 `GET /api/v2/dashboard/current/node`，`LoadCurrentInfoForNode` 读取 CPU、负载、内存和交换空间并返回 `NodeCurrent`。适配层需补节点身份、采样时间及数据缺失标记，断线时保留最后一次采样和时间。AC-HOST 使用真实节点的采样结果核对云端读数，FI-HOST 记录采样失败时的客户端展示。[Dashboard 路由](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/router/ro_dashboard.go#L24-L26) · [Go 采样方法](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L146)
- **OpenResty 安装实例重启。** `POST /api/v2/apps/installed/op` 绑定 `AppInstalledOperate` 并调用 `AppInstallService.Operate`。普通 OpenResty 分支按安装 ID 查记录，执行 Compose 重启并同步状态。此分支不会将 `taskID` 持久关联到这次重启，适配层须记录原目标、执行标记和启动证据。AC-CMD、FI-CMD、NET-CMD 按详情页的重启、回执丢失与实例改绑用例验收。[Go 处理器](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/api/v2/app_install.go#L173-L182) · [执行分支](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L265-L321) · [技术详细设计](technical-design.md)
- **备份与恢复。** 备份创建样本只能证明创建任务、产生制品和写入相应记录。`backup.restore` 的 P5 验收另需目标卷或服务的恢复前快照、恢复 checkpoint、操作结束后的数据核对及中断恢复记录。

台账完成条件：每行补齐真实入口文件和符号、`sourceCommit`、允许修改目录、工作包、AC/FI/CAP/NET 证据以及适用 profile；命令类行必须与附录 C.2 registry 一一对应，流会话单独按 lease/stream 契约验收；`GAP_PRIVATE` 和 `UNSUPPORTED` 仍需保留适用性证据，不能被统计脚本当作已完成。
