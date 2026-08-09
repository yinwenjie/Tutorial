# 后台管理 Dashboard Backlog

## 状态

- 当前状态：已进入 Phase 1.18；Phase 1.18.0 隔离方案和本地 Supabase/CI 准备阶段已完成，业务 migration、Edge Function、私有 Admin 仓库和 Access 配置尚未实施。
- 原延期条件已满足：正式主域名与 Phase 1.17 公开分享均已完成线上验收。
- v1 固定为只读、强审计和最小权限；不会直接修改、恢复、删除或导出用户数据。
- 后续以 `docs/implementation/phase-1/Phase1_18_Implement.md` 为唯一实施基线，本 backlog 只保留背景和候选依据；若两者冲突，以实施计划为准。

## 背景

Phase 1.11.5 已为账号托管空间建立云端历史版本，Phase 1.11.6 已明确账号托管空间是“账号可信托管、可恢复、可审计”模型。后台管理 dashboard 的目标是在受控、留痕、最小权限的前提下，让管理员能够帮助用户排障、审计和恢复非离线加密数据。

跨用户管理能力不能由 GitHub Pages 或任何静态前端直接执行，也不能把 Supabase service role、管理员密钥或跨用户表权限暴露给普通浏览器代码。Phase 1.18 不再向公开主站或 GitHub Pages legacy 构建加入 `/admin/` 外壳；Admin UI 使用私有仓库和独立 Cloudflare Pages project。

## 产品目标

- 查看账号托管用户和首页空间的基本信息。
- 查看账号托管空间云端历史版本和审计事件。
- 对账号托管云端历史生成完整只读预览。
- 查看普通同步码空间的元数据和风险事件，但不默认查看明文内容。
- 记录管理员自己的访问和预览行为。

## v1 范围

Phase 1.18.0 已确认 v1 只做只读后台：

- 用户搜索：按邮箱、用户 id、空间 id 查询。
- 空间列表：展示 `home_spaces`、access mode、sync space id、创建时间、更新时间。
- 账号托管云端历史：读取 `home_space_snapshots`。
- 快照预览：Edge Function 单条读取 `document_json` 并服务端投影为字段白名单 DTO，Admin Pages 不接收 raw JSON，只读展示分组、网站、组件、主题和图片状态。
- 云端操作记录：读取 `home_space_audit_events`。
- 管理员审计：写入并展示 `admin_audit_events`。

v1 不做：

- 不直接修改用户首页。
- 不替用户执行恢复到云端。
- 不删除首页空间。
- 不废弃同步码。
- 不导出完整用户数据包。
- 不绕过普通同步码空间的密文边界。

## 推荐架构

已确认方案：Supabase Edge Functions + 私有独立 Admin Pages + Cloudflare Access。

- Admin UI 使用私有源码仓库、独立 static export、独立 Cloudflare Pages project 和 `admin.mylinker.net`，不进入公开主站或 GitHub Pages。
- `admin.mylinker.net`、生产 `<admin-project>.pages.dev` 和所有 preview hostname 必须分别受 Access 默认拒绝策略保护，只允许精确管理员身份/组。
- Admin UI 只持有公开 anon key 和当前管理员 session。
- 所有跨用户数据读取都通过 Edge Function。
- Edge Function 使用 service role，但 service role 只存在服务端环境变量中。
- Edge Function 每次执行前检查当前用户是否在 `admin_users` 且启用。
- 每次敏感读取都必须成功写入 `admin_audit_events` 后才向 Admin Pages 返回结果；审计失败时 fail closed。
- Cloudflare Access 只保护页面资源；Supabase JWT、`admin_users` 和角色矩阵仍独立保护公网 Edge Function。

未采用方案：独立常驻后台服务。

- 使用 Vercel、Cloudflare 或其他后端服务承载 admin API。
- 安全边界更清楚，部署和运维成本更高。

不推荐方案：

- GitHub Pages 前端直接访问跨用户数据。
- 在前端环境变量、构建产物或公开仓库中保存 service role。
- 用普通用户 RLS policy 扩展出管理员跨用户读取能力。

## 建议数据模型

### `admin_users`

用途：定义管理员身份。

建议字段：

```text
id
user_id
role
enabled
created_at
created_by
updated_at
```

建议角色：

- `owner`：最高权限，可管理管理员名单。
- `admin`：可查看用户、空间、云端历史和审计。
- `support`：只读排障，权限更窄。

### `admin_audit_events`

用途：记录管理员行为。

建议字段：

```text
id
admin_user_id
admin_auth_user_id
target_user_id
target_home_space_id
target_sync_space_id
target_snapshot_id
action
severity
reason
metadata
created_at
```

Phase 1.18.0 固定事件：

- `admin.session.check`
- `admin.user.resolve`
- `admin.home_space.list`
- `admin.snapshot.list`
- `admin.snapshot.preview`
- `admin.home_audit.list`
- `admin.audit.list`

## 权限原则

- 管理员入口必须要求 Supabase 登录态。
- Admin Pages 的 HTML、JS 和 CSS 在返回浏览器前必须通过 Cloudflare Access；Access 和 Supabase 登录是两道独立门禁。
- 管理员身份由 `admin_users` 控制，不依赖前端隐藏路由。
- 普通主站不提供管理员入口、`/admin/` 路由、sitemap 项或 Admin bundle。
- 所有读取账号托管明文历史的动作必须留痕。
- 普通同步码空间默认只展示元数据，不展示明文。
- v1 不提供管理员导出、恢复辅助或用户数据写入；快照正文预览需要 owner/admin 权限、逐次理由和审计成功后才返回。

## Phase 1.18.0 已确认事项

- 后端采用 Supabase Edge Functions；Admin UI 使用私有仓库和独立 Cloudflare Pages project，正式入口为 `admin.mylinker.net`，不部署到主站或 GitHub Pages legacy。
- Access 分别保护自定义域名、生产 `pages.dev` 和预览通配域名，采用默认拒绝、精确管理员身份/组、MFA 和短会话。
- “不暴露”指普通用户拿不到 Admin HTML/JS/CSS 和管理数据；不承诺隐藏后台域名、TLS 证书或 Access 登录页存在性。
- v1 严格只读；唯一业务写入是由服务端追加 `admin_audit_events`。
- “当前内容”只表示最新账号托管云端快照，不服务端解密或读取当前 `sync_spaces`。
- v1 不允许完整导出、原始 JSON 下载、恢复、修改或删除用户数据。
- 审计 v1 永久保留，归档和清理后续单独设计。
- 首个 owner 的精确 Supabase Auth user UUID 仍是部署前外部输入，不写入 migration 或仓库。

## 依赖

- 正式域名和 Auth redirect 稳定。
- 私有 Admin 仓库、独立 Cloudflare Pages project、`admin.mylinker.net` 和 Access IdP/策略已由负责人确认。
- 服务端或 Edge Function 部署通道稳定。
- Supabase secrets 管理明确，service role 不进入静态前端。
- Phase 1.11.5 云端历史表和审计表已经在线。
- Phase 1.11.6 账号托管/普通同步码/高隐私模式边界已经文档化。

## 风险

- service role 泄露风险高于普通前端功能。
- 管理员查看用户内容如果没有审计，会破坏用户信任。
- 如果后台误读普通同步码空间，会破坏密文边界。
- 如果 v1 同时加入写操作，可能引入新的 P0 数据事故入口。
- 后台 dashboard 一旦上线，权限、日志和访问理由都要长期维护。
- 如果只保护自定义域名而遗漏生产 `pages.dev` 或 preview hostname，普通用户仍可能直接取得后台资源。
- 如果 Admin UI 源码进入当前公开仓库，即使线上受 Access 保护，源码仍会公开。

## 验收标准

- 普通主站和 GitHub Pages 构建中没有 `/admin/`、Admin bundle、service role 或管理员密钥。
- 未通过 Access 的请求无法从自定义域名、生产 `pages.dev` 或任一 preview hostname 取得 Admin HTML/JS/CSS。
- 非管理员无法调用任何 admin API。
- 管理员每次查看用户首页内容或云端历史都会写入 `admin_audit_events`。
- 普通同步码空间不会显示明文首页内容。
- 账号托管云端历史可完整预览，但 v1 不提供直接修改用户数据的操作。
- 管理员审计事件可按管理员、目标用户、目标空间和时间查询。
