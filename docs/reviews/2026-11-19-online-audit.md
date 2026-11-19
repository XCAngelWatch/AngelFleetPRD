# 2026-11-19 线上文档核查记录

核查对象为当日 GitHub Pages 发布的 v2.5，仓库提交为 `a3082a6`。下表记录该版本当时可观察到的差异，右列指向维护现行要求的主文。[核查版本](https://github.com/XCAngelWatch/AngelFleetPRD/tree/a3082a69717af7bcae16f1044601008157f7e9e5/docs)

## 影响首批交付的遗漏

| 当时的观察 | 现行章节 |
|---|---|
| PRD 只写“两台 Linux”。首验系统、架构及节点角色散见于接口契约。功能导图未说明怎样区分组件缺失、探测失败和缺少证据。 | [首批场景](../product-prd.md#首批做什么) · [节点能力选择](../product-prd.md#如何选择节点能力) |
| 预登记接口能返回待绑定节点，SQL 却要求创建时已有身份代次。票据丢失、注册响应丢失与票据到期后的组合缺少一致约定。 | [注册接口与恢复](../go-agent-interface-contract.md#32-设备证明私钥持有权) |
| 旧连接的关闭通知与同一代连接关闭后迟到的激活通知，均缺少页面判据。 | [重连与连接状态](../go-agent-interface-contract.md#4-连接票据与-wss-握手) |
| GA-02 派工文字允许立即准备环境，但依赖图要求先完成 GA-01。GA-10 实测表缺少读取返回 503 后的恢复和审计可见范围。 | [M1 交接](../engineering-roadmap.md#m1-排期与交接) · [GA-10 验收](../engineering-roadmap.md#ga-10-如何判断通过) |

## 后续操作、容量与文档依据

| 当时的观察 | 现行章节或原始依据 |
|---|---|
| 详写的变更和恢复用例均为已退出范围的 OpenResty、网站备份。独立容器与 MySQL 隔离恢复仅有工单说明及待填记录。 | [现行写入与恢复用例](../engineering-roadmap.md#首个真实写入与恢复怎样验收) |
| 验收编号中 MCP、网站及应用与当前项目并列，历史适用性只见于需求矩阵。 | [产品移交范围](../product-prd.md#原-1panel-怎么用) · [验收编号](../acceptance-ids.json) |
| 容量章节未区分 D1 批调用配额与批内 SQL 工作量。区域方案还缺诊断日志驻留的核对项。 | [部署、容量与恢复](../technical-design.md#部署容量与恢复) · [D1 限制](https://developers.cloudflare.com/d1/platform/limits/) · [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) |
| 平台约束与威胁模型只能下载 Markdown。匿名读取 Console 源码链接失败，1Panel 的 MySQL 引用末行越过文件边界，所查函数止于 1667 行。 | [系统架构与代码边界](../technical-design.md#系统架构与代码边界) · [固定源码](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/database_mysql.go#L1628-L1667) |

## 核对范围

| 核对对象 | 2026-11-19 观察结果 |
|---|---|
| 站点、下载与搜索 | 逐一读取 8 个阅读页、10 份 Markdown 和 4 份 JSON。8 篇阅读页源文件的哈希均与发布清单中的对应值一致。发布清单文件自身的 SHA-256 前 12 位为 `8bd3db0d75c3`。228 个搜索目标均有对应锚点，核对的正文站内链接均可解析。 |
| 上游与私有源码 | 按 1Panel 两个公开提交归档核对 130 条路径及行号。Console 固定提交的 18 条定位在本地存在，对应的 14 个去重后网页地址匿名访问均返回 404，原因未确认。 |
| 平台资料与托管响应 | 当日抽取的 37 个 Cloudflare 文档链接均可达。站点首页 HTTPS 响应有 HSTS，未观察到显式 CSP、X-Frame-Options、X-Content-Type-Options 或 Referrer-Policy。 |
| 验收证据 | 当日资料可追溯到 GA-01 契约和样例校验。核对的发布材料中没有双租户真机、首个真实写入、MySQL 隔离恢复或万节点容量的实测结果。[当前验收状态](../product-prd.md#当前验收状态) |
