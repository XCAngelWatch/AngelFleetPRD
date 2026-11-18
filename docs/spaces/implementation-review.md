# 1Panel 适配实施与联调

主方案的迁移矩阵依据 `cedb8dd`。本轮逐项复核 `dev-v2@aaba86d` 的三个入口，下面的通过条件均待真机验证。准备两个隔离租户及其测试节点，记录节点身份代次、版本和操作者权限。每次运行分配一个 `runId`。[主方案基线](https://github.com/1Panel-dev/1Panel/commit/cedb8ddda9254bdef0fddba96b7fa59c6ab8c633) · [本轮源码基线](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

## 工作包一 · 节点只读取样

接通已注册节点的查询通道，用 `node.inspect` 读取 CPU、内存样本。节点侧复用 Dashboard 的只读采集方法，适配层补入采样时间和节点身份代次。先读节点 A，切到 B 后再交付 A 的延迟响应；随后断开 B 的连接。通过条件是 B 的详情只展示 B 的样本，缓存保留原采样时间并标记过期，有效的数值零和采集失败可以区分。保存两次请求、采样值和页面状态供 AC-HOST、AC-UI 核对。[采集入口](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112)

## 工作包二 · OpenResty 实例重启

准备受 1Panel 管理的测试实例，将 `website-proxy` 绑定到节点及安装 ID，记录容器身份和原启动时间。普通安装实例同步调用 Compose 重启。实施时须由适配器校验资源版本，先持久关联 `commandId` 与操作标记，再提交一次重启。分别在响应丢失、执行开始后 connector 重启两处测试。重连后只读核对原命令、操作标记、容器启动时间及健康检查，同一意图只触发一次重启。若只能确认实例当前健康，保留 `UNCERTAIN`。附上命令记录和前后两次观测，按 AC-CMD、FI-CMD 判定。[安装实例重启分支](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/app_install.go#L316)

## 工作包三 · 网站备份与归档核验

准备本地 PHP 与受管运行环境各一站点。记录站点别名及关联数据库，提交备份并保存本地任务 ID。相对旧基线，本版跳过本地 PHP 运行环境目录；按站点类型核对站点文件、配置、关联数据库和适用的运行环境子包。归档完成、备份状态写回之前中断一次，在原命令下比对 `agent.db` 的备份记录、`task.db` 的任务、归档长度及整文件 SHA-256。三方证据一致再确认成功，冲突时保留现场。此项验收覆盖备份产物；恢复能力须在隔离目标另行还原并验证业务。将清单、摘要和对账结论归入 AC-APP、FI-APP，恢复演练单列 AC-RECOVERY。[运行环境分支](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/backup_website.go#L282) · [分库位置](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/init/db/db.go#L11)

每个工作包提交脱敏证据，注明源码版本、触发时点、预期、实际结果和未决项。评审按同一 `runId` 回查事件与现场观测。[源码适配详设](https://xcangelwatch.github.io/AngelFleetPRD/technical-design.html#section-7)
