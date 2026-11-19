# AngelFleet 本期功能导图

从节点接入到日常运维，按交付阶段查看 AngelFleet 本期计划迁移的 1Panel 功能。

[迁移范围与工单](#angelfleet-迁移范围) · [查看 M1 排期](go-agent-development-plan.md#m1-排期与甘特图)

## 本期功能导图

展开功能分支可查看具体操作。

### M1 首批

#### 节点接入

- 节点注册
- 在线状态与重连

#### CPU 与内存

- CPU 与内存采样
- 最后有效值、时间与来源

#### 授权与审计

- 租户隔离与节点授权
- 登录、授权与任务审计

### FOLLOW 首批扩展

#### 系统指标

- 系统信息与磁盘 I/O
- 网卡速率与 Top 进程

#### 节点日志

- 主机、系统与任务日志查询
- 日志清理及审计

#### 控制台设置

- 会话策略、MFA 与 Passkey
- 显示偏好与备忘

#### 节点维护

- 面板 TLS 与凭据轮换
- 主机与面板重启
- 升级、回滚与救援

### CORE 后续核心

#### 主机管理

- 文件浏览、传输与编辑
- 文件权限、回收站与分享
- 进程与端口
- 防火墙、磁盘与挂载

#### 终端与 SSH

- 本机、SSH 与容器终端
- SSH 连接与服务配置
- 常用命令与导入导出

#### Docker 与 Compose

- 容器清单、状态与日志
- 容器重启与受控变更
- 镜像、仓库与 Compose
- 网络、卷与 daemon 设置

#### 数据库

- 存量与远端实例管理
- MySQL 与 PostgreSQL
- MongoDB 与 Redis
- 按引擎开放库、权限与配置

### OPS 后续保障

#### 备份与快照

- 本地与选定 S3 兼容目标
- 数据库与目录备份恢复
- 面板快照、恢复与回滚

#### 计划任务

- 定时脚本、备份与通用日志任务
- 脚本库、分组与导入导出
- 执行记录与离线对账

#### 告警通知

- 规则、触发记录与投递结果
- 邮件与验证通过的 Webhook

#### 工具箱

- DNS、Hosts、主机名与时区
- NTP、Swap 与系统凭据
- Supervisor 与磁盘清理
- ClamAV、Fail2Ban 与 FTP

## AngelFleet 迁移范围

- **M1 首批**　节点接入、CPU 与内存、节点授权和基础审计。[首批工单](go-agent-development-plan.md#m1-派工单)
- **FOLLOW 首批扩展**　系统指标、节点日志、控制台设置与节点维护。[扩展工单](go-agent-development-plan.md#首批功能的后续扩展)
- **CORE 后续核心**　主机、终端、Docker 与已有及远端数据库。[核心工单](go-agent-development-plan.md#后续核心)
- **OPS 后续保障**　备份恢复、计划任务、告警及工具箱。[保障工单](go-agent-development-plan.md#后续保障)

## 范围与验收依据

GA-01 契约和样例已验证，GA-10 双租户真机验收待执行。后续各域按依赖和节点能力开放，涉及节点写入的工作包还须通过 GA-11 共用写入门禁及各自的业务验收。

[产品范围](product-prd.md#哪些-1panel-功能分批迁移) · [操作清单与范围边界](technical-plan.md#137-本轮非-ai-功能迁移清单) · [分阶段里程碑](go-agent-development-plan.md#分阶段里程碑) · [验收记录](spaces/implementation-review.md)
