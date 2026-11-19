# GA-01 · Go Agent 仓库与联调契约

**冻结版本 `ga01.v1`，2026-11-19。** 节点端代码归入产品下游仓 `XCAngelWatch/AngelFleetAgent`。Go 团队交付独立 connector 和少量 1Panel 执行器补丁，Console 团队交付注册、WSS 和命令查询接口。首个联合场景使用同一组标识：租户 `tenant-a`、节点 `node-a`、节点身份代次 `inc-01`、首个命令 `cmd-001`。

[下载完整联调样例（JSON）](examples/go-agent-first-sample.json)。文件中 `timeline` 按实际交互顺序串起 11 对 HTTP 请求/响应、10 帧 WebSocket 消息和一次本机观察，`cases` 给出 11 个独立分支。可直接将文件用作 Go 测试输入、前端 Mock 和 Worker 契约回归。示例域名 `control.example.invalid`、票据占位符与数据均供离线回放。本文网页提供契约，产品 API 和 Linux 节点联调分别由 GA-03 至 GA-10 交付。

# 1. 仓库、进程与发行边界

**维护与发布决策。** `XCAngelWatch/AngelFleetAgent` 是产品团队维护的 1Panel 下游代码仓，首个同步点固定在 `1Panel-dev/1Panel@aaba86d0ef71a31ee319e74998ffe83c64abf4b6`。节点团队在下游保留上游提交历史并维护产品补丁，独立发行 `angelfleet-connector`。这样，给 Go 采集点增加有效性字段和更新 connector 可以纳入同一份兼容性测试，原 core、agent 仍可单独构建和更新。GA-04 按此仓名落实仓库供应、写权限及首次代码提交。GA-01 的交付是可验证的设计与协议。[上游固定提交](https://github.com/1Panel-dev/1Panel/commit/aaba86d0ef71a31ee319e74998ffe83c64abf4b6)

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

`core/go.mod` 和 `agent/go.mod` 保留原模块名。connector 通过本机 Unix HTTP 调用原 agent，独立运行，不复用 Go 进程的全局变量。首个验证环境选定 Ubuntu 24.04 LTS、Linux amd64、systemd 和 1Panel 社区版主节点模式，具体镜像版本及构建摘要由 GA-02 记录。该模式下 `/etc/1panel` 为 `0700`，`agent.sock` 为 `0600`。服务以经核验的 agent 有效 UID 运行，启动时检查 socket 类型、属主和权限。身份及 journal 持久目录为 `/var/lib/angelfleet-connector/`，目录仅对服务账户开放；重启保留原身份与未决结果。[agent 监听与权限](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/server/server.go#L39-L145)

| 其他代码归属 | GA-01 确定的实现位置 |
|---|---|
| AngelFleetConsole | `src/lib/api/` 放置节点、命令客户端，权限登记在 `src/lib/auth/permission-policy.ts`。`cloudflare/api/src/router.ts` 分流新路由和 Upgrade，新增的 TenantData、AgentConn 分别持有租户状态和节点连接。DO、D1 的实际 namespace 与绑定由 GA-02 按环境配置。 |
| AngelFleetPRD | 本契约与 `docs/examples/go-agent-first-sample.json` 为两端共享的 v1 样例。变更线上的字段名、类型、鉴权或状态语义时，在 PRD 同时提交版本、样例和验证，两个产品仓引用同一 PRD 提交。 |

# 2. 地址、身份与共同字段

**部署路径。** 浏览器从 Console 的同源 HTTPS origin 访问 `/v1/tenants/{tenantId}/…`，connector 使用配置中同一可信 origin 的 `/v1/agents/…`，连接地址仅替换协议为 `wss`。网关按路径交给控制 API；既有 `/api/v1/…` 继续由管理 API 处理。真实联调时将示例 origin 换成 GA-02 分配的域名。GitHub Pages 仅提供静态契约和样例下载。

| 调用方 | 鉴权和权限 | 持久边界 |
|---|---|---|
| Console 浏览器 | 契约采用同源 `af_session` 会话 Cookie，写请求核验 `Origin` 和服务端绑定的 `X-CSRF-Token`。预登记与发票使用新增 `node.enroll` 权限，读列表、读详情和提交 `node.inspect` 需要 `node.read` 及目标节点范围。 | GA-03 在现有登录/刷新成功路径建立受保护的 Cookie 会话及绑定 CSRF 值，退出/撤权时失效。当前源码使用 Bearer 和浏览器生成的 CSRF 值。Mock 可注入样例会话，实际联调须验证网关与会话。 |
| Go 注册端 | `Authorization: Bearer` 持一次性 enrollment ticket 进入注册挑战；持本机私钥证明所有权。 | ticket 绑定预登记节点、租户和 profile，服务端保存摘要。首次成功消费和节点绑定、审计共用事务与赢家条件。 |
| 已注册 Go 节点 | 以已绑定公钥的签名取得短期 connect ticket，再通过 Upgrade 请求头提交。 | 由服务端签发的凭证和已绑定的节点确定租户及身份代次。帧中再次校对它们，每个节点只有当前已激活代次能接收新命令。 |

| 字段 | 线格式与规则 |
|---|---|
| `tenantId/nodeId/nodeIncarnation/commandId` | 不透明字符串。节点 ID 预登记时生成，incarnation 在身份绑定时建立，日常重连沿用。每次命令查询均核验当前调用者权限。 |
| `connectionEpoch/sequence/agentEventSequence/revision/fenceVersion` | 使用无前导零的非负十进制字符串（零为 `"0"`），按整数比较。连接换代更新 epoch。sequence 在本连接、每方向分别计数；agentEventSequence 在同一 incarnation 和 commandId 内跨重连持久递增。 |
| `expiresAt/issuedAt/sampledAt/lastSeenAt` | Unix 毫秒整数。入场期限由云端首创命令时确定。sampledAt 来自 Go 成功读取，lastSeenAt 来自通信。指标值允许合法的零；从未成功的值和时刻都为 `null`。 |
| `intentHash/contentHash` | `sha256:` 加 64 位小写十六进制。对样例 `digestVectors` 给定字段投影按 JCS 生成 UTF-8 字节再计算。intentHash 固定租户、节点、incarnation、operation、resourceVersion、payload、expiresAt；排除会随重投变化的 epoch、sequence、traceId。contentHash 包含稳定事件标识与业务结果。 |

[JCS 规范](https://www.rfc-editor.org/rfc/rfc8785) · [现有 Console 客户端](https://github.com/XCAngelWatch/AngelFleetConsole/blob/df715b38d174b2bdad7a5ab58150c05ead6c5d36/src/lib/api/client.ts) · [主方案附录 A](technical-plan.md#a3-控制协议与-agent-本地连接代次隔离)

# 3. 节点预登记与注册

## 3.1 管理端发放一次性票据

`POST /v1/tenants/{tenantId}/nodes` 接受显示名，以 `Idempotency-Key` 防止网络重试新建第二个节点。服务端分配稳定 nodeId，创建成功返回 `201`。同一 key、同一意图回放原节点。用返回的 nodeId 请求 enrollment，创建时将一次可见的 ticket 交给安装过程，响应设置 `Cache-Control: no-store`。示例 ticket 有效期 10 分钟。同一发放请求重试可返回原 enrollment 标识和期限；若票据原文已丢失，撤销未消费票据再重新发放。票据和签名不进入审计正文。

```http
POST /v1/tenants/tenant-a/nodes HTTP/1.1
Cookie: af_session=${USER_SESSION}
Origin: https://control.example.invalid
X-CSRF-Token: ${CSRF_TOKEN}
Idempotency-Key: pre-node-001
Content-Type: application/json

{"displayName":"lab-linux-a"}

HTTP/1.1 201 Created
Content-Type: application/json

{"tenantId":"tenant-a","nodeId":"node-a","displayName":"lab-linux-a","registrationState":"PENDING"}
```

```http
POST /v1/tenants/tenant-a/enrollments HTTP/1.1
Cookie: af_session=${USER_SESSION}
Origin: https://control.example.invalid
X-CSRF-Token: ${CSRF_TOKEN}
Idempotency-Key: issue-001
Content-Type: application/json

{"nodeId":"node-a","profile":"full-server"}

HTTP/1.1 201 Created
Cache-Control: no-store
Content-Type: application/json

{"enrollmentId":"enrollment-001","nodeId":"node-a","ticket":"${ENROLLMENT_TICKET}","expiresAt":1795047001000}
```

## 3.2 设备证明私钥持有权

Go 在首次发请求前持久化本机 Ed25519 私钥和 requestId。`POST /v1/agents/enroll` 使用 `phase=challenge`、`phase=prove` 两次请求。公钥为 32 字节原始格式，待签字节 `proofInput`、公钥和 64 字节签名均用无填充 base64url 传输。Go 核对已配置的 audience、purpose、requestId、publicKeyHash、enrollmentId、challengeId 和有效期后，对解码后的原字节签名。服务端按存储的一次性挑战复查相同绑定、过期与签名。示例挑战有效 60 秒。

```http
POST /v1/agents/enroll HTTP/1.1
Authorization: Bearer ${ENROLLMENT_TICKET}
Content-Type: application/json

{"phase":"challenge","enrollmentId":"enrollment-001","requestId":"enroll-req-001","publicKey":"6uTEljWfBahG9buIo3WCDT5JdJ88zHaF7U4YECe-8qc","algorithm":"Ed25519"}

HTTP/1.1 200 OK
Cache-Control: no-store
Content-Type: application/json

{"challengeId":"ch-enroll-01","algorithm":"Ed25519","expiresAt":1795046462000,"proofInput":"eyJhdWRpZW5jZSI6Imh0dHBzOi8vY29udHJvbC5leGFtcGxlLmludmFsaWQiLCJjaGFsbGVuZ2VJZCI6ImNoLWVucm9sbC0wMSIsImRvbWFpbiI6ImFuZ2VsZmxlZXQubm9kZS1wcm9vZi52MSIsImVucm9sbG1lbnRJZCI6ImVucm9sbG1lbnQtMDAxIiwiZXhwaXJlc0F0IjoxNzk1MDQ2NDYyMDAwLCJub25jZSI6ImJjT1FPTEdoTEMzeVBsOUVscmt5N2NRaExtV3gyaGsxdzh5TG5jRzd1SlEiLCJwdWJsaWNLZXlIYXNoIjoic2hhMjU2OmRmNTA1MzVjMWVjMjg3M2U5NTQxMzlhNzA4YzY2MjIzYTRkMTIzMTAwMzIxZjJkNTNjM2Y0ODZlOTc5MzYwZmIiLCJwdXJwb3NlIjoiZW5yb2xsIiwicmVxdWVzdElkIjoiZW5yb2xsLXJlcS0wMDEifQ"}
```

```http
POST /v1/agents/enroll HTTP/1.1
Authorization: Bearer ${ENROLLMENT_TICKET}
Content-Type: application/json

{"phase":"prove","enrollmentId":"enrollment-001","requestId":"enroll-req-001","publicKey":"6uTEljWfBahG9buIo3WCDT5JdJ88zHaF7U4YECe-8qc","algorithm":"Ed25519","challengeId":"ch-enroll-01","signature":"5YAm3CAkGce5LHXiDzfSAxOx0LTlK0ohhBkgl9dCTghyKgXvRwMpCwVInh24aeS__DxWUb7MHWWZEMjOWhpFBw"}

HTTP/1.1 201 Created
Cache-Control: no-store
Content-Type: application/json

{"tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","credentialVersion":1,"keyVersion":1,"publicKeyHash":"sha256:df50535c1ec2873e954139a708c66223a4d123100321f2d53c3f486e979360fb"}
```

首次绑定返回 `201`。成功消费后丢失回包，原设备保留同一 requestId、公钥和注册上下文，以**新的挑战及新签名**恢复，服务端返回 `200` 和原 nodeId/incarnation。相同凭据换成另一注册请求或公钥时返回 `409 ENROLLMENT_CONFLICT`。已过期的未消费票据返回 `401 AUTH_EXPIRED`。三个分支分别检查新增绑定数、成功审计数和返回身份，详见 `cases`。

# 4. 连接票据与 WSS 握手

Go 在 `POST /v1/agents/connect-ticket` 上先请求 `phase=challenge`，带 nodeId、nodeIncarnation、keyVersion、requestId 和 protocolVersion；再提交带 challengeId 和签名的 `phase=prove`。服务端按已登记公钥复核挑战，签发绑定节点、租户、密钥版本、协议版本及连接用途的票据，示例有效 5 分钟。注册挑战与建连挑战分别绑定 `enroll` 和 `connect`，票据通过请求头传输。完整两对请求/响应在 `connect.challenge` 和 `connect.prove`。

```http
POST /v1/agents/connect-ticket HTTP/1.1
Content-Type: application/json

{"phase":"prove","nodeId":"node-a","nodeIncarnation":"inc-01","keyVersion":1,"requestId":"connect-req-001","protocolVersion":1,"challengeId":"ch-connect-01","signature":"izjt_oV5S7uxxwFyYbwrS4QRNAQyEIgJXpjfRPDCe7-Cr_SsOT-sBr3ksCRMJrWlhs5SvhrRqV8EYy-ER9kPCA"}

HTTP/1.1 200 OK
Cache-Control: no-store
Content-Type: application/json

{"tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","protocolVersion":1,"keyVersion":1,"connectTicket":"${CONNECT_TICKET}","expiresAt":1795046705000}
```

```http
GET /v1/agents/connect HTTP/1.1
Authorization: Bearer ${CONNECT_TICKET}
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Protocol: angelfleet.v1

HTTP/1.1 101 Switching Protocols
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Protocol: angelfleet.v1
```

Go 使用标准 WebSocket 客户端生成握手随机数和协议头，服务器由库生成握手应答。协商子协议 `angelfleet.v1`，每帧承载一个 UTF-8 JSON 对象，上限 64 KiB。下表从上到下是首连的四次交互。

| 方向与 type | 输入及实现动作 | 允许下一步的条件 |
|---|---|---|
| Go → AgentConn · `hello` | 发送协议范围、执行栈版本、journal 版本、capabilities 和已落盘最高 epoch。首次为 `"0"`。 | 身份与 ticket 一致，双方均支持 v1，才能协商本次连接。 |
| AgentConn → Go · `welcome` | DO 原子分配当前节点下一个 epoch，返回协议版本、绑定和待确认代次。 | Go 校验节点、incarnation、版本及代次，持久化新的最高 epoch。 |
| Go → AgentConn · `ready` | journal 提交后发回同一 epoch。 | DO 接受当前候选代次，旧 socket 的 ready 被拒绝。 |
| AgentConn → Go · `ready.ack` | 确认连接激活。 | 才投递到这个 socket。连接状态可显示在线，指标仍等待首次有效采样。 |

下面两行分别是一条独立消息，重连时使用新 epoch 和新的每方向序号。

```text
{"version":1,"type":"welcome","messageId":"msg-welcome","tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","connectionEpoch":"1","sequence":"1","protocolVersion":1}
{"version":1,"type":"ready","messageId":"msg-ready","tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","connectionEpoch":"1","sequence":"1"}
```

# 5. 第一次 node.inspect 的完整路径

## 5.1 Console 受理与节点执行

前端先读 `GET /v1/tenants/{tenantId}/nodes/{nodeId}` 获取最新 resourceVersion，再通过命令接口提交一次 `node.inspect`。详情响应示例中的 `resourceVersion="1"` 为不透明版本。服务端重新校验权限、目标归属和版本；同一事务写命令、幂等收据、初始审计及 outbox 后才返回 `202`。同一原始请求复用同一幂等键将回放同一 commandId 和到期时间。

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

AgentConn 通过 `beginDispatch` 取得持久投递准入，向当前活跃连接发送下列消息。Go 按命令和意图写入本地 journal 后发送 `command.accepted`，实际开始时发送 `command.started`。

```json
{
  "version": 1,
  "type": "command.dispatch",
  "messageId": "msg-command-dispatch",
  "tenantId": "tenant-a",
  "nodeId": "node-a",
  "nodeIncarnation": "inc-01",
  "connectionEpoch": "1",
  "sequence": "3",
  "commandId": "cmd-001",
  "issuedAt": 1795046408000,
  "expiresAt": 1795046468000,
  "operation": "node.inspect",
  "resourceVersion": "1",
  "payload": {
    "view": "overview"
  },
  "intentHash": "sha256:43ef058831f3ca1a9d33940f2a5830b0641357d74681e0b264a401b0757ac533",
  "fenceVersion": "1",
  "traceId": "trace-first-sample"
}
```

adapter 将 `node.inspect` 的 `{"view":"overview"}` 映射到 Unix socket 上的 `GET /api/v2/dashboard/current/node`，检查 HTTP 状态和 1Panel 应答 `code=200`，从 `data` 读取 `cpuUsedPercent`、`memoryUsed`。GA-07 在下游采集点增补可选 `data.collection`，形状如下（摘录）。timestamp 为采集时刻，validity 按原字段命名。旧版本缺少 collection 时按缺失有效性处理，暂停宣告可信采样能力。读取失败保留原因；同节点已有最后好值则保留其数值及原时刻。Go 的采集返回结构和处理器在下列固定提交可核查。[采集实现](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/service/dashboard.go#L112-L146) · [本机 API 处理器](https://github.com/1Panel-dev/1Panel/blob/aaba86d0ef71a31ee319e74998ffe83c64abf4b6/agent/app/api/v2/dashboard.go#L152-L155)

```json
{
  "code": 200,
  "data": {
    "cpuUsedPercent": 23.5,
    "memoryUsed": 1073741824,
    "collection": {
      "sampledAt": 1795046409000,
      "validity": {
        "cpuUsedPercent": true,
        "memoryUsed": true
      }
    }
  }
}
```

## 5.2 从结果落盘到页面读数

一次采集中至少一项成功时，命令可返回 `SUCCEEDED`，每项仍分别看 `valid`。失败指标在本次事件中用 `value:null`、`sampledAt:null`、`valid:false`、`stale:true` 和 `errorCode:"COLLECTION_FAILED"` 表示。前端投影只用成功字段覆盖最后好值，失败字段保留此前的值和时刻。若两项都失败，命令为 `FAILED` 并保留采集错误，节点摘要不推进上次成功时间。没有历史数据时显示「暂无数据」。

本例原始 CPU 为 23.5%，内存为 1,073,741,824 字节。适配器回传的单位分别是 `percent`、`bytes`。页面可将后者显示为 1 GiB。结果事件中的 `eventId`、`agentEventSequence` 和 `contentHash` 在重发时保持不变，epoch 与连接序号按当前连接填写。

```json
{
  "version": 1,
  "type": "command.result",
  "messageId": "msg-command-result",
  "tenantId": "tenant-a",
  "nodeId": "node-a",
  "nodeIncarnation": "inc-01",
  "connectionEpoch": "1",
  "sequence": "4",
  "commandId": "cmd-001",
  "eventId": "event-003",
  "agentEventSequence": "3",
  "state": "SUCCEEDED",
  "intentHash": "sha256:43ef058831f3ca1a9d33940f2a5830b0641357d74681e0b264a401b0757ac533",
  "result": {
    "sampledAt": 1795046409000,
    "metrics": {
      "cpuUsedPercent": {
        "value": 23.5,
        "unit": "percent",
        "sampledAt": 1795046409000,
        "valid": true,
        "stale": false
      },
      "memoryUsedBytes": {
        "value": 1073741824,
        "unit": "bytes",
        "sampledAt": 1795046409000,
        "valid": true,
        "stale": false
      }
    }
  },
  "contentHash": "sha256:f41a87d89dbc52b646a95ad83ebadda637c925b6ad01d0db78479ba6010d0ab9",
  "traceId": "trace-first-sample"
}
```

`result.received` 表示 DO 持久收件。云端以事件序号、摘要及 revision 合并 D1 状态；只有 `APPLIED` 或证据相符的 `CONSISTENT_NOOP` 可以回复 `result.committed`。收到后节点才进入已确认结果的保留期。两帧分别如下。

```text
{"version":1,"type":"result.received","messageId":"msg-result-received","tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","connectionEpoch":"1","sequence":"4","commandId":"cmd-001","eventId":"event-003","agentEventSequence":"3","contentHash":"sha256:f41a87d89dbc52b646a95ad83ebadda637c925b6ad01d0db78479ba6010d0ab9"}
{"version":1,"type":"result.committed","messageId":"msg-result-committed","tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","connectionEpoch":"1","sequence":"5","commandId":"cmd-001","eventId":"event-003","agentEventSequence":"3","contentHash":"sha256:f41a87d89dbc52b646a95ad83ebadda637c925b6ad01d0db78479ba6010d0ab9","applyState":"APPLIED","appliedRevision":"5"}
```

浏览器通过 `GET /v1/tenants/tenant-a/nodes` 取得 `items/total`；节点详情给出 `lastSeenAt`、`sampledAt`、`stale`、`lastSampleCommandId`。渲染时在原租户调用下列命令查询，从 `result.metrics` 取值并校对 nodeId/incarnation。页面切换或刷新都应重新授权，旧节点的迟到结果只进入其自己的缓存。

```http
GET /v1/tenants/tenant-a/commands/cmd-001 HTTP/1.1
Cookie: af_session=${USER_SESSION}

HTTP/1.1 200 OK
Content-Type: application/json

{"tenantId":"tenant-a","nodeId":"node-a","nodeIncarnation":"inc-01","commandId":"cmd-001","state":"SUCCEEDED","revision":"5","operation":"node.inspect","intentHash":"sha256:43ef058831f3ca1a9d33940f2a5830b0641357d74681e0b264a401b0757ac533","result":{"sampledAt":1795046409000,"metrics":{"cpuUsedPercent":{"value":23.5,"unit":"percent","sampledAt":1795046409000,"valid":true,"stale":false},"memoryUsedBytes":{"value":1073741824,"unit":"bytes","sampledAt":1795046409000,"valid":true,"stale":false}}}}
```

# 6. 两端对接与验收

Go 端按 `http[].id` 加载注册、连接、命令，发送 `websocket[].message` 作为帧正文。服务端按 `timeline` 驱动状态，将 `digestVectors` 与签名样例作为黄金测试向量；前端以 `nodes.list`、`node.read`、`command.read` 的 `response.body` 设置 Mock。在 PRD 根目录运行以下命令可校验样例。

```sh
npm run check:ga01
```

**Go 对接点。** 以下函数接收已核对用途、绑定、时限的挑战，签出 `phase=prove` 请求的 `signature`。调用方从本机身份存储加载 Ed25519 私钥；完整验签向量在样例中，无需取得该测试密钥。

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

**控制台对接点。** 在新域接口已接入的同源测试环境中，使用 GA-03 登录流程取得的 CSRF 值，按下面的请求提交一次采样。调用方保留 key，受理回包丢失时用同一请求重试。随后按返回的 commandId 读取命令详情，待结果可用再渲染。

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

| 可复测的分支 | 两端应观察到的结果 |
|---|---|
| 注册回包丢失、过期或换请求 | 原身份签新挑战恢复原绑定，新增成功审计为 0；过期返回 401；冲突返回 409。 |
| 重连时旧 ready 迟到 | 旧连接以 1008 / `STALE_EPOCH` 关闭，新增投递 0。旧命令结果可在新连接按原事件重报。 |
| 相同命令重试或持旧 key 改参数 | 原请求回放同一命令；更改请求指纹返回 409 / `IDEMPOTENCY_REQUEST_MISMATCH`。 |
| 原命令收到 `result.received` 时断开 | 节点保留结果，重连后按同一事件补报；达到可确认的 D1 应用状态才返回 committed。 |
| 首次采集失败、部分指标失败或断线 | 无历史值显示「暂无数据」；有历史值保留最后成功时间并置 stale。有效 CPU 为 0 时显示 0，心跳不推进采样时间。命令详情保留当时结果，当前节点详情另反映离线状态。 |
| 无节点查看权限 | 对详情请求返回 403 / `NODE_FORBIDDEN`，前端清理旧缓存，不显示原样本。 |

**验证记录。** 同一 fixture 的注册、建连及注册恢复三条公开签名，已在 Go 1.27.4 的 `crypto/ed25519` 和本地 Cloudflare `workerd 1.20261119.1` 的 Web Crypto 中验证通过；分别改动一字节后均被拒绝。另用 Go 新生成的测试密钥对三类挑战签名，workerd 均通过验签。`npm run check:ga01` 复查公开向量、线格式关联、状态推进、摘要与异常预期。GA-01 至此可交付两端；部署到隔离 Worker/D1/DO 及两台 Linux 节点后的实测记录归 GA-10。[研发任务](go-agent-development-plan.md) · [联调验收记录](spaces/implementation-review.md) · [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
