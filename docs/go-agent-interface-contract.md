# 节点接入与接口契约

## 本期 Linux 原生设备与交互终端

设备端独立构建 `angelfleet-agent` 和 `angelfleet-updater`。原生采集从 Linux 的 procfs、statfs、os-release 和 dpkg 读取。设备密钥和待报 SQLite 账本位于稳定的状态目录。可选 1Panel 适配器通过私有 Unix 套接字核验对端身份，读取 v2.5.1 的节点概览。原生设备分别保留 Linux 指标的来源、采样时刻及上游概览的读取时刻。下文 `ga01.v1` 冻结样例另有逐探针有效性要求。公开样例使用虚构的租户、设备和账户。

本期设备首次注册时证明持有 Ed25519 私钥，重连时提交新的签名挑战。控制面依据租户、设备、身份代次及单调增长的连接代次接收观测。CPU 来自两个累计采样点，内存采用 MemTotal 减 MemAvailable。每份资产报告附带事件 ID、采样时间及摘要，设备收到持久化确认后从待报队列移除该事件。

| 操作 | API 与约束 |
|---|---|
| 终端目标 | `/v1/tenants/{tenant}/nodes/{node}/terminal-targets` 登记或列出本设备目标。SSH 绑定账户、主机、端口及 SHA256 主机密钥指纹。本机绑定实际 OS 账户，容器绑定完整不可变 ID 和容器内账户。SSH 私钥引用由设备本地解析。 |
| 会话打开 | `POST /v1/tenants/{tenant}/nodes/{node}/terminals` 带幂等键与目标 ID。浏览器和设备分别使用一次性角色票据接入同一 TerminalRelay，在两端就绪和目标复核成功后开启交互。 |
| 租约与撤权 | 初始租约最多 90 秒，浏览器每 30 秒请求续租。中继和设备同时执行绝对截止时间。显式撤权先持久化关闭状态，再通知会话双方。断线后重新打开会话，输入只在原会话内按序发送。 |
| 资产和合规 | 用节点和身份代次读取资产。合规结果关联租户策略版本及原始观测 ID，分别返回系统版本、Agent 版本和根分区可用字节的通过、未通过或未知。 |
| 签名升级验收 | 两个真实版本分别绑定架构、字节长度、SHA-256 和发行签名。先行设备通过本机健康检查、三次连续心跳及升级后的资产回读后才可扩批。失败设备恢复原版本及原账本。 |

每个终端故障用例保存同一终端 ID 下的浏览器关闭、中继关闭、实际进程退出以及时间。跨租户读取、同名容器替换、指纹变化、慢消费者、并发上限和撤权通知丢失分别签收。双租户两台独立 amd64 实机的结果与 ARM64 先行测试分别记录。

**目标修订与会话关闭。** 修改终端目标时提交当前 `revision`。控制面在同一事务内增加版本、撤销旧授权、记录审计，并通知旧会话关闭。管理员在新修订上重新授权。设备通过认证中继的握手时间与本机单调时钟计算截止点，续租时再次核对中继时间。输入和输出各自按序确认并限制待传字节数。审计保存会话标识、账户、目标、开始与结束时间和关闭原因。

**SSH 服务配置。** 设备本地登记独立 sshd 配置、服务标识、恢复目录和用于新连接验证的 SSH 账户。操作提交至 `/v1/tenants/{tenant}/nodes/{node}/ssh-config`，写入时携带预期版本及幂等标识。设备回执区分读取、已应用、已回滚及需要恢复，前端回读实际配置。公开文档保留接口字段和验证方法，现场的密钥引用及配置全文留在私有测试环境。

**签名包和恢复。** arm64、amd64 分别提供 Debian 安装包及独立的 Agent 升级清单。两类清单分别绑定产品、稳定版本、架构、字节数和摘要。设备持有发行公钥，独立升级器在切换前校验签名，并在服务启动失败时恢复前一版本。启动恢复服务先处理未完成的切换，再启动 Agent。控制面经私有 R2 分发制品，在暂停的批次上停止后续投递。

**GA-01 冻结版本 `ga01.v1` · 2026-11-19。** 第一条联调链路从 Console 预登记节点开始，经 Go 注册、主动建连和一次 `node.inspect`，以页面读数能追溯到同一次本机采样结束。示例使用租户 `tenant-a`、节点 `node-a`、身份代次 `inc-01` 和命令 `cmd-001`。

[下载完整联调样例（JSON）](examples/go-agent-first-sample.json)。`timeline` 给出交互顺序；`http` 收录 11 对请求与响应，`websocket` 收录带发送方向的 10 帧原文，`localObservation` 提供一次本机观察，`cases` 给出 11 个独立分支。Go、控制面与前端按下文章节的条目 ID 对照同一份报文。示例域名和占位票据用于本地回放，接入测试环境时使用实际域名、会话与新挑战。

GA-08 至 GA-10 使用独立读取契约 `node-metric-read.v1`。需要在新标签页展示各指标最后有效值时，直接看[逐指标读取与冷启动展示](#53-逐指标读取与冷启动展示)及[两次采样的联调 JSON](examples/node-metric-read.v1.json)。

# 1. 仓库、进程与发行边界

**节点代码归 `XCAngelWatch/AngelFleetAgent`。** 产品团队在该下游仓保留 1Panel 的提交历史，首个同步点为 `aaba86d0ef71a31ee319e74998ffe83c64abf4b6`。GA-04 负责仓库供应、写权限、服务代码和发行。connector 与采集点补丁在同一仓验证兼容性，三个 Go 模块可分别构建。[上游固定提交](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

```text
XCAngelWatch/AngelFleetAgent/
├── core/                         上游 Go 模块，保留启动、代理与数据库初始化
├── agent/                        上游 Go 模块，持有采集器和本机业务执行器
│   ├── app/dto/                  对现有应答增补采集时刻和字段有效性
│   └── app/service/              dashboard.go 在采集点记录结果或错误
└── connector/                    新 Go 模块 github.com/XCAngelWatch/AngelFleetAgent/connector
    ├── go.mod
    ├── cmd/connector/            装配依赖、启动服务、退出处理
    ├── internal/identity/        本地密钥、注册意图、签名与票据交换
    ├── internal/protocol/        HTTP/WSS 类型、摘要输入、版本与限值
    ├── internal/connection/      主动 WSS、握手、重连、代次隔离
    ├── internal/journal/         SQLite 中的代次、接收记录、结果及确认状态
    ├── internal/adapter/         准许的 operation 到本机 Go API 的映射
    └── packaging/systemd/        angelfleet-connector.service
```

`core/go.mod`、`agent/go.mod` 沿用上游模块名。connector 作为独立 systemd 服务，通过本机 Unix HTTP 调用 agent。首个目标环境是 Ubuntu 24.04 LTS、amd64、1Panel 社区版主节点。该模式下 `/etc/1panel` 为 `0700`，`agent.sock` 为 `0600`。服务使用经核验的 agent 有效 UID，启动时检查 socket 类型、属主和权限。密钥与 journal 保存在仅服务账户可访问的 `/var/lib/angelfleet-connector/`，重启后沿用原身份并恢复未确认结果。GA-02 登记实际镜像和构建摘要。[agent 监听与权限](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/server/server.go#L39-L145)

| 仓库 | 团队交付 |
|---|---|
| AngelFleetConsole | 节点与命令客户端放在 `src/lib/api/`，权限登记在 `src/lib/auth/permission-policy.ts`。`cloudflare/api/src/router.ts` 分流控制路由与 Upgrade。TenantData 管理租户状态，AgentConn 管理节点连接，GA-02 配置隔离环境的 DO、D1 绑定。 |
| AngelFleetPRD | 本页定义接线规则，下载样例保存完整报文与校验向量。字段、类型、鉴权或状态语义变化时同步更新契约版本、样例和校验，两端引用同一 PRD 提交。 |

# 2. 地址、身份与共同字段

浏览器从 Console 同源 HTTPS 访问 `/v1/tenants/{tenantId}/…`；Go 向已配置的可信 origin 请求 `/v1/agents/…`，Upgrade 使用同一主机的 WSS。既有管理 API 位于 `/api/v1/…`。GA-02 分配测试域名并配置网关。本文所在的网页提供静态文档和样例下载。

| 调用方 | 鉴权与权限 |
|---|---|
| Console 浏览器 | 使用同源 `af_session` Cookie。写请求核验 `Origin` 和服务器绑定的 `X-CSRF-Token`。预登记与签发注册票据需要 `node.enroll`；查询和提交 `node.inspect` 需要 `node.read` 及目标节点授权。当前客户端使用 Bearer 和浏览器生成的 CSRF 值，GA-03 须在登录、刷新、退出及撤权流程接入新会话。[现有 Console 客户端](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/src/lib/api/client.ts) |
| Go 注册端 | 用 `Authorization: Bearer` 提交一次性 enrollment ticket，再证明持有本机私钥。票据绑定预登记节点、租户和 profile，服务端保存摘要。 |
| 已注册 Go 节点 | 以绑定公钥对应的私钥证明身份，换取短期 connect ticket。云端从凭证与已绑定的节点确定租户、节点、身份代次，并逐帧核对它们。 |

| 字段 | 类型及比较规则 |
|---|---|
| `tenantId`、`nodeId`、`nodeIncarnation`、`commandId`、`resourceVersion` | 不透明字符串。预登记分配 nodeId，首次绑定建立 incarnation，日常重连沿用。命令受理时校验目标当前版本。 |
| `connectionEpoch`、`sequence`、`agentEventSequence`、`revision`、`fenceVersion` | 无前导零的非负十进制字符串，按整数比较。新连接更换 epoch；连接内每方向独立计数。agentEventSequence 在同一 incarnation 和 commandId 内跨连接持久递增。 |
| `expiresAt`、`issuedAt`、`sampledAt`、`lastSeenAt` | Unix 毫秒整数。云端确定命令准入期限，Go 在采集点产生 sampledAt，通信更新 lastSeenAt。没有成功读数的指标以 `null` 表示值和采样时间。 |
| `intentHash`、`contentHash` | `sha256:` 加 64 位小写十六进制。以 `digestVectors` 的字段投影按 JCS 生成 UTF-8 再散列。意图包含租户、节点、incarnation、操作、目标版本、载荷及期限；事件包含稳定事件标识与业务结果。重投时变化的连接字段在投影之外。[JCS 规范](https://www.rfc-editor.org/rfc/rfc8785) |

# 3. 节点预登记与注册

## 3.1 管理端发放一次性票据

| 样例 ID | 请求 | 成功响应与重试 |
|---|---|---|
| `node.create` | `POST /v1/tenants/{tenantId}/nodes`，提交 `{"displayName":"lab-linux-a"}` 与 `Idempotency-Key`。 | `201` 返回 `nodeId` 及 `registrationState:"PENDING"`。原键和原请求重试时取得同一节点。 |
| `enrollment.issue` | `POST /v1/tenants/{tenantId}/enrollments`，提交 `{"nodeId":"node-a","profile":"full-server"}` 与该请求的幂等键。 | `201` 返回 `enrollmentId`、`nodeId`、`ticket`、`expiresAt`，设置 `Cache-Control: no-store`。示例票据有效 10 分钟。 |

将一次可见的 ticket 交给节点安装流程。发放回包丢失时可用原键取回登记标识和期限；原文丢失则撤销未消费票据后重新发放。日志和审计只保留标识、指纹与结果。

## 3.2 设备证明私钥持有权

节点在发请求前持久化本机 Ed25519 私钥、注册 requestId 与注册上下文。用同一 enrollment ticket 向 `POST /v1/agents/enroll` 发送两次请求。

| 样例 ID | 请求 | 成功响应 |
|---|---|---|
| `enroll.challenge` | `phase:"challenge"`，携带 enrollmentId、requestId、publicKey、algorithm。 | `200` 返回 challengeId、algorithm、expiresAt、proofInput。示例挑战有效 60 秒。 |
| `enroll.prove` | 沿用同一组入参，改为 `phase:"prove"`，附 challengeId 与 signature。 | 首次绑定返回 `201`，包含 tenantId、nodeId、nodeIncarnation、credentialVersion、keyVersion、publicKeyHash。服务端在同一事务中消费票据、绑定节点和写成功审计。 |

**待补的注册恢复用例。** 公开样例分别覆盖注册成功后丢回包，以及未消费票据过期。恢复须核对原绑定、公钥和节点吊销状态，保持原身份与消费记录。GA-03／04 在联调前确认恢复截止、超窗响应和人工处置交接，候选规则见 [ADR-09](technical-design.md#adr-09--注册响应丢失后的恢复截止点)。GA-10 比对挑战发放、证明到达与到期时刻，并记录绑定、消费与成功审计计数。

**注册与建连共用的签名规则。** 公钥为原始 32 字节，签名为 64 字节，publicKey、proofInput、signature 均使用无填充 base64url。Go 解码 proofInput，核对 `domain=angelfleet.node-proof.v1`、可信 audience、用途、requestId、公钥摘要、挑战标识及有效期。注册用途 `enroll` 还须匹配 enrollmentId；建连用途 `connect` 须匹配 nodeId、nodeIncarnation、keyVersion、protocolVersion。确认后对**解码所得原字节**作 Ed25519 签名。服务端按已保存的一次性挑战核对绑定、期限与签名。下文 Go 片段执行最后的签名步骤。

# 4. 连接票据与 WSS 握手

| 样例 ID | 请求 | 成功响应 |
|---|---|---|
| `connect.challenge` | `POST /v1/agents/connect-ticket`，提交 `phase:"challenge"`、节点及身份代次、密钥版本、requestId、协议版本。 | `200` 返回建连挑战，按第 3.2 节校验和签名。 |
| `connect.prove` | 同一端点改为 `phase:"prove"`，附 challengeId 与 signature。 | `200` 返回绑定身份、协议及密钥版本的 `connectTicket` 和 `expiresAt`。示例有效 5 分钟。 |
| `connect.upgrade` | `GET /v1/agents/connect`，用 `Authorization: Bearer` 携带 connectTicket，协商子协议 `angelfleet.v1`。 | `101 Switching Protocols` 确认 Upgrade 与子协议。由 WebSocket 库生成和验证握手头。 |

每帧承载一个 UTF-8 JSON 对象，上限 64 KiB。连接按以下顺序激活。

| 方向与消息 ID | 接收方的处理 |
|---|---|
| Go → AgentConn · `hello` | 校验 ticket 对应身份、协议范围、执行栈、journal 版本和能力。Go 上报本地已持久化的最高 epoch，首次为 `"0"`。 |
| AgentConn → Go · `welcome` | 云端原子分配新的候选 epoch；Go 校验绑定、版本及代次，将最高 epoch 写入 journal。 |
| Go → AgentConn · `ready` | journal 提交后回送同一 epoch，云端核对候选代次。 |
| AgentConn → Go · `ready.ack` | 确认激活后才能向该连接投递。节点此时可显示在线，指标等待有效采样。 |

**断开事件的顺序。** AgentConn 只把已激活连接的状态同步到该节点绑定的 D1 摘要。按 epoch 合并，新代次覆盖旧代次；同一代次一旦关闭，迟到的激活事件不能使它重新上线。GA-10 激活第二代连接后再送达第一代的关闭记录，节点详情和 `metrics/latest` 应保持在线。随后关闭第二代并重送其激活记录，两个读取入口都应保持离线。仅有连接事件时，指标值、采样时间、来源和投影版本保持原值。

Go 发送的第一条 `ready` 帧原文如下。

```json
{"version":1,"type":"ready","messageId":"msg-ready","tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","connectionEpoch":"1","sequence":"1"}
```

# 5. 第一次 node.inspect 的完整路径

## 5.1 Console 受理与节点执行

实际调用先通过 `GET /v1/tenants/{tenantId}/nodes/{nodeId}` 读取目标的 resourceVersion，再提交 `command.create`。离线样例预置该版本为 `"1"`，时间线末尾的 `node.read` 用于核对采样后的详情。服务端重新校验授权、归属和版本，在同一事务内写命令、幂等收据、审计和 outbox，提交后返回 `202`。

```http
POST /v1/tenants/tenant-a/nodes/node-a/commands HTTP/1.1
Idempotency-Key: inspect-first-001
Cookie: af_session=${USER_SESSION}
Origin: https://control.example.invalid
X-CSRF-Token: ${CSRF_TOKEN}
Content-Type: application/json

{"operation":"node.inspect","resourceVersion":"1","payload":{"view":"overview"}}

HTTP/1.1 202 Accepted
Content-Type: application/json

{"commandId":"cmd-001","state":"QUEUED","expiresAt":1795046468000,"idempotencyReplay":false}
```

| 消息或观察 ID | 谁执行、何时执行 |
|---|---|
| `command.dispatch` | AgentConn 取得 `beginDispatch` 准入后向已激活连接下发命令、意图摘要、目标版本及入场期限。 |
| `command.accepted`、`command.started` | Go 将 commandId 与 intentHash 写入 journal 后报告 `RECEIVED`；开始执行时报告 `RUNNING`。 |
| `localObservation` | Go adapter 仅将 `node.inspect` 的 `{"view":"overview"}` 映射到 `/etc/1panel/agent.sock` 上的 `GET /api/v2/dashboard/current/node`。校验 HTTP 状态和应答 `code=200`，读取 `data.cpuUsedPercent` 和 `data.memoryUsed`。 |

GA-07 在下游采集点增加可选 `data.collection`。其中 `sampledAt` 是本次采集时刻，`validity` 按原指标命名。下例摘取本机 API 的相关字段。旧版缺少有效性时，connector 暂停宣告可信采样能力。[上游采集实现](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L146) · [本机 API 处理器](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/api/v2/dashboard.go#L152-L155)

```json
{
  "code": 200,
  "data": {
    "cpuUsedPercent": 23.5,
    "memoryUsed": 1073741824,
    "collection": {"sampledAt": 1795046409000, "validity": {"cpuUsedPercent": true, "memoryUsed": true}}
  }
}
```

## 5.2 从结果落盘到页面读数

| 样例 ID | 谁发送、接收方如何使用 |
|---|---|
| `command.result` | Go 持久化结果并报告各指标。示例为 `cpuUsedPercent=23.5`（percent）、`memoryUsedBytes=1073741824`（bytes，可显示为 1 GiB）。至少一项有效时命令可为 `SUCCEEDED`；两项均失败时为 `FAILED` 并保留采集错误。 |
| `result.received` | AgentConn 确认已持久收件。Go 继续保留结果；重连补报时复用原 eventId、agentEventSequence 和 contentHash，使用新连接的 epoch 与 sequence。 |
| `result.committed` | D1 已按事件序号、摘要及 revision 合并。仅 `APPLIED` 或证据相符的 `CONSISTENT_NOOP` 可以确认；Go 此时才进入已确认结果的保留期。 |
| `nodes.list`、`node.read`、`command.read` | Console 读取租户节点列表、节点摘要与命令详情。摘要的 lastSampleCommandId 可定位一次原始命令；命令页展示该次 `result.metrics`。节点概览按 §5.3 分别取得两项读数与来源。 |

**一次结果与当前页面读数。** 本次失败指标写 `value:null`、`sampledAt:null`、`valid:false`、`stale:true`、`errorCode:"COLLECTION_FAILED"`。页面只用本次有效值更新对应指标。失败项保留同一节点最后成功的数值和时刻；没有历史则显示「暂无数据」。两项均失败时节点摘要维持上次成功时间。离线时最后好值标记为过期，心跳只更新 lastSeenAt，合法 CPU 零值显示为 0。

## 5.3 逐指标读取与冷启动展示

**节点概览用一次授权 GET 读取 CPU、内存及各自来源。** S1、S2 表示同一绑定先后受理的两次 `node.inspect`。各用独立幂等键提交，等到结果写入 D1 再读。下表中的时间均为 Go 在采集点记录的 Unix 毫秒。

| 已提交的采样结果 | CPU 读数 / 采样时刻 / 来源命令 | 内存读数 / 采样时刻 / 来源命令 |
|---|---|---|
| S1（`cmd-001`）两项成功 | 23.5% · 1795046409000 · `cmd-001` | 1 GiB · 1795046409000 · `cmd-001` |
| S2（`cmd-002`）只有 CPU 成功 | **0%** · **1795046420000** · **`cmd-002`** | **1 GiB** · **1795046409000** · **`cmd-001`**，标记「上次有效，本次采集失败」 |

GA-08 在 TenantData D1 按 `(tenantId,nodeId,nodeIncarnation)` 保存最近一次已有终态采样结果的命令，并按指标保存最后有效的值、采样时间与来源命令。控制面受理命令时为该绑定分配递增的 `sampleOrder`。合并终态结果时，在同一事务中更新命令与读取数据。S2 推进最近命令及 CPU，内存保留 S1，同时登记 S2 的内存失败。重复回执不得再次推进版本；迟到结果仍可补入有效指标，条件是它的受理序号高于该指标上次好值的来源序号。断线、心跳和重连不改写来源与时间。[落库与乱序合并](technical-design.md#逐指标读取与乱序合并)

**请求。** GA-09 先经已授权的节点详情取得当前 incarnation，再从同源页面发送下列 GET。服务端逐次检查登录会话、租户成员资格、`node.read` 和目标节点授权，再核对必填的 `nodeIncarnation`。每次响应均带 `Cache-Control: private, no-store` 和本次请求的 `X-Trace-Id`。GA-10 从响应头读取追踪号，关联该次 GET 的控制面日志；错误体的 `traceId` 与响应头相同。

```http
GET /v1/tenants/tenant-a/nodes/node-a/metrics/latest?nodeIncarnation=inc-01 HTTP/1.1
Host: control.example.invalid
Cookie: af_session=${USER_SESSION}
Accept: application/json
```

在测试环境中，将 `CONTROL_ORIGIN` 设为控制台源站，`COOKIE_JAR` 指向已登录测试用户的 Cookie 文件，路径和代次换成该用户获准访问的节点。以下请求只读，刷新不会创建第三条采样命令。

```sh
curl -sS -i --cookie "$COOKIE_JAR" --get \
  "$CONTROL_ORIGIN/v1/tenants/tenant-a/nodes/node-a/metrics/latest" \
  --data-urlencode "nodeIncarnation=inc-01"
```

**S2 完成后的响应。** 清空页面缓存后或新开标签页，同一授权请求取得同样的指标数据。下列响应头及完整 JSON 可直接用于 Mock。

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, no-store
X-Trace-Id: trace-s2-metrics-read
```

```json
{
  "contractVersion": "node-metric-read.v1",
  "tenantId": "tenant-a",
  "nodeId": "node-a",
  "nodeIncarnation": "inc-01",
  "connectionState": "ONLINE",
  "projectionRevision": "2",
  "latestAttempt": {"commandId": "cmd-002", "sampleOrder": "2", "state": "SUCCEEDED"},
  "metrics": {
    "cpuUsedPercent": {
      "unit": "percent",
      "lastGood": {"value": 0, "sampledAt": 1795046420000, "commandId": "cmd-002"},
      "latestValid": true, "stale": false, "errorCode": null
    },
    "memoryUsedBytes": {
      "unit": "bytes",
      "lastGood": {"value": 1073741824, "sampledAt": 1795046409000, "commandId": "cmd-001"},
      "latestValid": false, "stale": true, "errorCode": "COLLECTION_FAILED"
    }
  }
}
```

| 字段或情形 | 服务端语义与前端行为 |
|---|---|
| `latestAttempt`、`latestValid`、`errorCode` | 指向已有终态采样结果中 `sampleOrder` 最大的命令及该次各项结果。两项都失败仍推进最近命令，`state:"FAILED"`。尚无结果时三个字段均为 `null`。 |
| `lastGood` | 单位由指标的 `unit` 给出。渲染 `lastGood.value` 和它自身的 `sampledAt`；来源链接为租户内 `GET /v1/tenants/{tenantId}/commands/{lastGood.commandId}`，同样鉴权。两项均有固定键。从未成功的指标返回 `lastGood:null`，页面显示「暂无数据」，时间与来源留空。 |
| `stale`、`connectionState` | 失败项、无好值、离线或新激活连接还未采到该项有效值时标过期。可同时显示「节点在线」和「内存上次有效」。重连时，按新激活 epoch 取得的有效采样逐项清除过期；旧连接执行的补报按原执行代次判定。 |
| `projectionRevision`、`sampleOrder` | 都是按整数比较的十进制字符串。前者只随该绑定已保存的指标投影内容变化。连接切换可改变 `stale` 而保持同一修订号。后者表示命令受理顺序。 |
| `401 UNAUTHORIZED`、`403 NODE_FORBIDDEN` | 当前接口的会话 Cookie 缺失、过期或失效均返回 401，提示重新登录。跨租户、无目标授权或撤权返回 403。错误体仅含 `errorCode`、`traceId`。页面清除该上下文读数与来源链接。 |
| `400 INVALID_REQUEST`、`409 NODE_INCARNATION_MISMATCH` | 代次缺失或为空返回 400。经授权但代次已更换返回 409。页面丢弃旧绑定数据，重新获取有权访问的节点详情，再按新代次读取。 |
| `503 STORAGE_UNAVAILABLE` | D1 或同一主库快照的授权、指标数据不可读时返回 503。错误体仅含 `errorCode`、`traceId`。页面隐藏数值与来源并显示「读取失败，可重试」。重试须重新授权，期间不展示旧缓存中的读数。 |

**清缓存后的首次绘制。** GA-09 在会话与节点上下文就绪后发起读取，等待期间显示加载状态。到达响应时核对租户、节点、incarnation 和本地请求序号，同一绑定拒绝较低的 `projectionRevision`。按最新请求处理同修订号的连接状态变化。页面逐项渲染上述字段，CPU 的数值 0 也有效。以 UTC+8 显示这组样例时，CPU 卡显示「0% · 08:00:20 · cmd-002」，内存卡显示「1 GiB · 08:00:09 · cmd-001 · 上次有效，本次采集失败」。打开 S2 命令详情时，仍应看到原始内存 `value:null` 和 `sampledAt:null`；点内存读数的来源则打开 S1。

[下载完整联调样例](examples/node-metric-read.v1.json)可核对两次命令创建、两帧 Go 原始结果、两次命令详情与两次指标 GET，并回放空历史、离线和错误响应。Go 与控制面沿用 `ga01.v1` 命令协议，新增的读取响应使用 `node-metric-read.v1`。GA-10 将空缓存读取与两次 Go 原始值、命令及页面逐项核对。[真机验收与证据清单](spaces/implementation-review.md#两次采样后的无缓存验收)

# 6. 两端对接与验收

**按 ID 取完整报文。** 在 PRD 仓库根目录运行以下命令，依次打印注册响应、握手帧和结果帧。替换末尾 ID 可查其他步骤或异常。HTTP 项分 request/response；WSS 仅由 `direction` 所列发送方发送 `message`，对端校验该帧。前端 Mock 可直接加载三项读取接口的 `response.body`。

```sh
node -e "const f=require('./docs/examples/go-agent-first-sample.json'); for(const id of process.argv.slice(1)){const e=[...f.http,...f.websocket,...f.cases].find(x=>x.id===id); console.log(JSON.stringify(e,null,2))}" enroll.prove ready command.result
npm run check:ga01
```

**Go 对接。** 从本机存储加载私钥，在第 3.2 节的用途、绑定和期限检查通过后生成 `phase:"prove"` 的 signature。样例含公开验签向量，两端可离线验证。

```go
func signCheckedChallenge(privateKey ed25519.PrivateKey, proofInput string) (string, error) {
    input, err := base64.RawURLEncoding.DecodeString(proofInput)
    if err != nil {
        return "", err
    }
    if len(privateKey) != ed25519.PrivateKeySize {
        return "", errors.New("invalid Ed25519 private key length")
    }
    signature := ed25519.Sign(privateKey, input)
    return base64.RawURLEncoding.EncodeToString(signature), nil
}
```

**Console 对接。** 在集成环境用 GA-03 登录流程取得会话和 CSRF 值。调用方传入最新 resourceVersion，并保留请求和幂等键以便重试。受理后通过返回的相对路径查询命令。

```ts
async function inspectNode(tenantId: string, nodeId: string, resourceVersion: string,
                           key: string, csrfToken: string) {
  const tenant = "/v1/tenants/" + encodeURIComponent(tenantId);
  const response = await fetch(tenant + "/nodes/" + encodeURIComponent(nodeId) + "/commands", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key, "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ operation: "node.inspect", resourceVersion, payload: { view: "overview" } })
  });
  const body = await response.json();
  if (response.status !== 202) throw new Error(body.errorCode ?? String(response.status));
  return tenant + "/commands/" + encodeURIComponent(body.commandId);
}
```

| `cases` 中的样例 ID | 验收预期 |
|---|---|
| `recover-lost-enroll-response` | 保留原 requestId、公钥与注册上下文。原设备签新挑战后获 `200` 及原绑定；新增绑定、成功审计均为 0。 |
| `expired-enrollment`、`conflicting-enrollment` | 未消费票据过期返回 `401 AUTH_EXPIRED`；已消费票据换注册请求或公钥返回 `409 ENROLLMENT_CONFLICT`。 |
| `stale-epoch` | 迟到的 ready 遇到更高代次时，旧连接以 `1008 / STALE_EPOCH` 关闭，该连接新增投递 0。 |
| `replay-command`、`command-key-mismatch` | 原键加原请求回放 `202` 及同一命令、同一到期时间；原键改目标版本返回 `409 IDEMPOTENCY_REQUEST_MISMATCH`。 |
| `await-d1-commit` | 收件后、D1 合并前断线，Go 保留结果并按原事件重报，云端暂缓 committed。 |
| `partial-collection`、`no-prior-sample`、`offline-after-good-sample` | 分别核对有效 CPU 零值与旧内存值、无历史值的显示、断线后保留的最后成功时刻。 |
| `unauthorized-node` | 租户 B 的账户读取 A 的命令详情返回 `403 NODE_FORBIDDEN`，响应与页面均无 A 的样本。 |

**验收边界。** GA-01 已验证公开向量及报文关联。历史记录覆盖 Go 1.27.4 与本地 workerd 1.20261119.1 的交叉验签和篡改单字节的拒绝。`npm run check:ga01` 复查样例的鉴权头、签名、摘要、报文方向、状态推进与异常预期。全链路授权、两项采集均失败的完整结果、断线重报等行为由 GA-10 在隔离 Worker/D1/DO 与两台 Linux 节点上取证。[GA-10 验收条件](engineering-roadmap.md#ga-10-如何判断通过) · [联调验收记录](spaces/implementation-review.md)
