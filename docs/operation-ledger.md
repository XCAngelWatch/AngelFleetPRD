# Go 操作改造台账

这是 P0 固化前的实施台账，不把待确认的源码入口写成已完成事实。`sourceCommit` 是实际复用输入的可复现提交；具体文件、符号、工作包和证据必须在 P0 读取目标仓库后补齐。命令类操作使用 commandId、幂等收据和 tombstone；终端是流会话，使用 terminalId、leaseSequence 和撤销版本，不套用命令状态机。

## 命令类操作

| operation | 目标阶段 | Go 复用/改造边界 | taskId / operationMarker | 取消边界 | 结果核验 | 跨入口互斥 | status |
|---|---|---|---|---|---|---|---|
| `node.inspect` | P2 | 复用只读查询；适配 DTO、采样时间和 stale | 不创建副作用任务；记录 commandId | 可安全取消请求，不影响现场 | 重新采样并核对 node incarnation | 节点维护模式只读放行 | PLANNED |
| `service.restart` | P3 | 复用 Go 服务操作；补稳定操作标记和启动后查询 hook | `cloudCommandId` + `operationMarker` | 启动前可取消；已发起只核对 | 进程启动时间、服务状态、版本 | 同一 service 资源锁；证书/升级任务互斥 | PLANNED |
| `container.ensure` | P3 | 复用 Docker/Compose service；补目标摘要和资源锁 | 优先传入稳定 `localTaskId` | 仅停止后续步骤 | 受管标签、目标配置摘要、运行状态 | 同一容器/卷/Compose 项互斥 | PLANNED |
| `file.install` | P3 | 复用文件落盘；新增 R2 artifact 校验与原子替换边界 | `cloudCommandId` + artifactId | 临时文件阶段可取消；替换后按契约核对 | SHA-256、大小、目标路径和 manifest | 目标路径、磁盘和升级锁 | PLANNED |
| `backup.restore` | P5 | 复用恢复内核；补 checkpoint、版本和跨存储对账 | `cloudCommandId` + restore checkpoint | 恢复前可取消；切换后只允许声明的补偿 | manifest、版本、任务水位、现场状态 | volume、服务和 Cron 备份互斥 | PLANNED |
| `host.reboot` | P4 | 复用 Go 重启入口；补 boot identity、恢复健康和 fence 检查 | `cloudCommandId` + `operationMarker` | 发起前可取消；已重启只核对恢复 | boot identity、启动时间、节点健康 | 节点锁；升级与破坏性操作互斥 | PLANNED |
| `disk.format` | P4 | 复用受限磁盘入口；补签名意图、二次确认和效果去重 | `cloudCommandId` + `operationMarker` | 发起前可取消；副作用后禁止自动重放 | 设备稳定标识、文件系统摘要、人工证据 | 节点/设备锁；所有其他写入互斥 | PLANNED |

## 流会话类操作

| operation | 目标阶段 | Go 复用/改造边界 | 会话标识 | 关闭边界 | 结果核验 | 跨入口互斥 | status |
|---|---|---|---|---|---|---|---|
| `terminal.open` | P3 | 复用 PTY/SSH/exec；补 Relay、租约、撤销、背压 | `terminalId` + `leaseSequence` + `authorizationVersion` | 到期或撤销立即关闭；不重放未知 stdin | PTY 身份、租约截止、流序号 | 每节点终端配额和维护模式 | PLANNED |

台账完成条件：每行补齐真实入口文件和符号、`sourceCommit`、允许修改目录、工作包、AC/FI/CAP/NET 证据以及适用 profile；命令类行必须与附录 C.2 registry 一一对应，流会话单独按 lease/stream 契约验收；`GAP_PRIVATE` 和 `UNSUPPORTED` 仍需保留适用性证据，不能被统计脚本当作已完成。
