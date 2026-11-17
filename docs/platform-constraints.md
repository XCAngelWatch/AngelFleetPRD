# Cloudflare 平台约束快照

本文档集中保存控制面设计引用的 Cloudflare 平台边界，避免同一个数字散落在容量、终端和故障章节后各自漂移。快照日期为 **2026-11-17**；它们是平台限制或当前默认行为的设计输入，不是 AngelFleet 已通过的容量结果。P0 发布前必须重新打开官方页面、确认套餐和兼容日期，并把实际配置与压测证据写回参数冻结表。

| 产品 | 当前官方边界 | 在本方案中的用途 | 状态 | 官方来源 |
|---|---|---|---|---|
| Workers Paid | 128 MiB 内存；默认 CPU 30s、可配置到 5min；每请求 6 个同时出站连接；Worker 未压缩大小 64 MiB | 入口认证、TenantData、Queue consumer 和内部 RPC 的预算；不把 6 个连接误当成 D1 并发 | 待 P0 复核 | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| D1 Paid | 单库 10 GB；每次 Worker 调用 1,000 次查询；每个调用最多 6 个同时 D1 连接；单行/字符串/BLOB 2,000,000 bytes；SQL 语句 100 KB；单次查询最多 100 个绑定参数；查询最长 30s；结果最多 50 MB；Time Travel 30 天 | 单租户热库、授权复核、命令、事件和审计的上限；333 次逻辑授权检查/秒必须通过缓存、批处理和真实 SQL 计量证明 | 待 P0 复核 | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| Durable Objects SQLite | 每对象 10 GB；键和值合计 8 MB；收到的单条 WebSocket 消息 32 MiB；每请求 6 个同时出站连接；SQLite 语句 100 KB、绑定参数 100 | AgentConn/Relay 的串行状态、连接代次、租约和有限结果缓冲；应用层 64 MiB 结果预算不等于平台上限 | 待 P0 复核 | [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Queues | 消息 128 KB；单次 consumer batch 最多 100 条；`sendBatch` 最多 100 条或 256 KB；单队列 5,000 msg/s；积压 25 GB；push consumer 并发 250；保留最长 14 天；batch 等待上限 60s | 只做 outbox 持久补偿和结果通知，不承担在线命令的低延迟保证；P0 仍冻结逐条消费和独立延迟指标 | 待 P0 复核 | [Queues limits](https://developers.cloudflare.com/queues/platform/limits/) |
| R2 | 预签名 URL 必须按对象、动作和有效期授权；multipart ETag 不替代整文件摘要 | 备份、安装包、导出和归档；上传完成后以 SHA-256 验证并原子推进 READY | 待 P0 复核 | [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)、[R2 multipart](https://developers.cloudflare.com/r2/objects/multipart-objects/) |

## 解释规则

1. **平台限制不等于产品目标。** 例如 5,000 msg/s 是单队列平台边界，不能直接转化为命令吞吐承诺；2 秒持久接收目标只绑定 `dispatchKick` 直连快路径。
2. **逻辑检查不等于 SQL 次数。** 1 万节点每 30 秒复核约 333 次逻辑检查，必须单独记录缓存命中、RPC、真实 SQL、D1 `rows_read/rows_written` 和延迟。
3. **套餐和日期必须入证据。** 任何 P0 结论都记录套餐、兼容日期、Wrangler 配置、运行区域、原始指标和失败样本；未复核的数字保持 `待 PoC` 或 `待 P0 复核`。
