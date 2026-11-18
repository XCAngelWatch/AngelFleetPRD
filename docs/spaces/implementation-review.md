# 1Panel 适配实施与联调

准备两个隔离租户和各自的 Linux 测试节点 A、B，为操作者授予测试所需的节点权限。每次试验分配一个 `runId`，记录节点身份代次、Go 与适配器版本、故障触发时点。主方案的迁移矩阵固定在 `cedb8dd`，本页三个入口已复核到 `aaba86d`。以下场景均待真机验证。[主方案基线](https://github.com/1Panel-dev/1Panel/commit/cedb8ddda9254bdef0fddba96b7fa59c6ab8c633) · [本轮源码基线](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

## 工作包一 · 节点只读取样

1. **准备样本。** 按详设 §7.2，从 `LoadCurrentInfo` 采集同一节点、网卡和磁盘的累计字节数及 `shotTime`。向测试客户端回放两份相隔 2 秒的有效样本，发送字节增加 4096 B，磁盘读取增加 4 MiB。预期分别为 2 KiB/s、2 MiB/s。计数保持不变的下一份有效样本应显示零速率。[采集入口](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L188-L196) · [速率计算](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/frontend/src/views/home/index.vue#L1082-L1126)
2. **切换与断线。** 暂缓 A 的响应，切到 B 并取得 B 的有效样本后再交付 A 的响应。B 页面应仅显示 B 的数据。更换 B 的网卡后，首样本仅建立基线；再触发采集失败或断线，保留最后成功的 `sampledAt` 并显示 `stale`。保存选择器、原始计数、采样时刻和页面值，按 AC-HOST、AC-UI 核对。

## 工作包二 · OpenResty 实例重启

1. **记录原目标。** 将 `website-proxy` 绑定到测试节点的 OpenResty 安装实例，记录 `installId`、`resourceVersion`、各目标容器身份和 `StartedAt`。在测试适配器上记录操作标记与实际进入 Compose 重启分支的次数。[重启及状态刷新](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L316-L321)
2. **分别触发两个断点。** 云端已受理而 HTTP 响应丢失时，用原 key、原请求重试，应返回同一 `commandId`。另一次试验让 Compose 成功后安装状态刷新失败，恢复时只读核对原标记、容器集合、启动时间与现场状态。同一命令应只有一次实际重启调用。若只能证明实例当前健康，保留 `UNCERTAIN`。附命令、分支计数与前后快照，按 AC-CMD、FI-CMD 核对。

## 工作包三 · 网站备份与归档核验

1. **冻结预期清单。** 为本地 PHP 和受管 runtime 各准备一个站点。记录别名、runtime 来源、数据库关联及预期归档成员。两类站点都核对网站配置、站点数据和已关联数据库；本地 PHP 跳过受管 runtime 目录，受管样本须包含对应子包。以 AC-APP 判定站点组成。[归档组成](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L261-L316)
2. **卡在两库写回之间。** 测试适配器在归档关闭时登记命令、任务、备份记录、文件位置、长度与整文件 SHA-256。在 `Task.Execute` 已成功、业务记录尚未更新时中断，预期可见任务 Success、备份记录 Waiting。恢复后按原 `commandId`、`localTaskId` 和 `backupRecordId` 查到该归档，对照步骤 1 的成员清单，按 AC-FILE 独立复算长度与摘要。另做一轮缺失关闭凭据的试验，预期保留原命令并进入 `UNCERTAIN`。按 FI-CMD 记录对账前后的 Go 备份入口调用次数，两轮均应无新增。原任务的子步骤重试另记。恢复能力另取隔离目标还原并按 AC-RECOVERY 验收。[异步写回与原任务重试配置](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L222-L246) · [本地任务终态](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/task/task.go#L317-L362)

## 实测记录

每个断点填写一行，用 `runId` 关联版本、命令和证据。重复副作用按同一命令首次发起后新增的 Compose 重启或 Go 备份入口调用计数。各容器的启动时间、归档文件数和任务内部重试分别留作佐证。只读场景填「不适用」。备份摘要注明采集方、时刻及文件。预期进入 `UNCERTAIN` 的场景，若实测保留原命令且新增调用为零，可以判通过。如缺少入口计数等验收证据，结论填「待核对」并列出缺项。[源码适配详设](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-7)

| runId／场景／验收项 | 触发时点与预期 | 实测值／业务状态 | 重复副作用次数 | 脱敏证据链接 | 评审结论 |
|---|---|---|---|---|---|
| 待填写 | 待填写 | 待测 | 待测 | 待附 | 待执行 |
