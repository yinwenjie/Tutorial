# Phase 1.17 只读渲染与公开快照分享 v1 实施计划

## Summary

Phase 1.17 为账号托管首页提供可撤销的公开分享能力，并沉淀一个不依赖编辑状态、同步状态或浏览器本地存储的只读首页渲染层。

分享对象是用户显式发布的 `PublicHomeDocumentV1` 快照，而不是当前 `HomeDocumentV2` 的实时公开映射：用户之后继续编辑首页，不会自动修改已发布内容；更新分享必须再次确认。这样既避免把同步读取路径变成公开旁路，也让分享内容、撤销和恢复语义稳定可解释。

## 已确认范围与边界

- 仅已登录用户拥有的 `account-managed` 首页空间可发布；普通同步码空间继续维持密文边界，不能分享。
- 每个账号托管空间最多一个有效分享。发布、更新均替换该快照；撤销立即失效且旧 token 永不恢复；重新发布生成新 token。
- 公开页面默认仅展示：首页标题、主题 preset/accent、分组及网站的名称、URL、mark 和排序。
- Notes、Todo、Countdown、World Clock、月历等组件及其 config 不公开；Banner/背景图片、私有 Storage URL、关键词、同步元数据、账号资料、审计和恢复信息也不公开。
- token 为独立的高熵随机值，只在客户端生成一次并通过 TLS 传给 RPC；数据库只存 token hash，不能由 hash 还原 token。
- 公开链接固定为 `https://mylinker.net/share/#<token>`。fragment 不进入 HTTP request 或 Referer；`/share/` 为静态导出的客户端入口，兼容根路径和 GitHub Pages legacy 子路径。
- v1 不做密码、SEO/public slug、访问统计、访问者身份、评论、协作编辑、自定义域名或实时更新。

## 交付顺序

| 子阶段 | 目标 | 主要产物 | 完成条件 |
|---|---|---|---|
| 1.17.0 | 设计收口 | 本文档、字段/权限/失败语义确认 | 不存在公开读取完整首页的歧义 |
| 1.17.1 | 只读 Renderer | 数据源无关的 `ReadOnlyHomeRenderer` | 现有编辑首页行为不变，renderer 无副作用 |
| 1.17.2 | 公开投影 | `PublicHomeDocumentV1`、normalize、投影测试 | 白名单投影且敏感字段无法进入 payload |
| 1.17.3 | 分享存储与 RPC | migration、verify、repository | 表无直接公开读取；RPC 满足 owner/anon 边界 |
| 1.17.4 | 发布管理 | 设置页分享面板、预览、复制/更新/撤销 | 用户能理解快照非实时且能可靠撤销 |
| 1.17.5 | 公开页面 | `/share/`、通用失败页、metadata | 双静态站点入口均可工作且不暴露编辑入口 |
| 1.17.6 | 回归与发布 | 自动校验、人工回归、双站 smoke test | 隐私、授权、布局和撤销验收全部通过 |

## 1.17.1：只读 Renderer 基座

状态：已完成。

### 任务

- 从 `HomeDashboard` 中提取仅负责首页视觉展示的部分，建立接收规范化 document 和 display mode 的只读 renderer；保留主题、分组、网站、站点图标和安全外链行为。
- 只读 renderer 不导入或调用编辑器、拖拽、Widget 配置、同步、账号、恢复、埋点、本地快照或 `localStorage`。
- 定义加载、空内容、非法 document 和渲染错误的稳定 UI；公开页面不因 malformed payload 崩溃。
- 编辑首页继续由现有 dashboard 组合这些展示组件，避免一次性重写编辑流程。

实施结果：

- 新增 `ReadOnlyHomeRenderer` 和 `ReadOnlyHomeRendererBoundary`，定义最小 `ReadOnlyHomeDocument` 展示模型及 `loading`、`ready`、`empty`、`invalid` 状态；boundary 不上报可能含用户内容的渲染异常。
- 新增 `ReadOnlyThemeStyleBridge`，仅使用 theme preset/accent 和系统深浅色偏好设置视觉 token；不读取 UI 偏好、账号、同步或 localStorage，也不解析 Banner/背景 Storage 资源。
- 新增只读站点卡片，固定使用安全新窗口外链；非法 URL 只显示不可操作卡片。
- 收窄并加固 `SiteIcon` 输入，在 URL 解析失败或非 HTTP(S) 协议时直接显示 mark fallback。
- 现有 `HomeDashboard` 未迁移到只读 renderer，编辑、搜索、组件和同步路径保持原有组合方式。

### 验收

- 只读页面没有新增/删除/排序/编辑/设置/登录/同步/恢复入口。
- 现有首页编辑、搜索、组件和同步路径行为无回归。
- 所有外链使用新窗口并保留 `noopener noreferrer`。

## 1.17.2：公开投影与校验

状态：已完成。

建议新增 `src/domain/public-home-document.ts`，将公开 schema 与源文档 schema 分离：

```ts
type PublicHomeDocumentV1 = {
  version: 1;
  documentTitle: string;
  theme: { presetId: HomeThemePresetId; accent: string };
  groups: Array<{
    id: string;
    title: string;
    order: number;
    sites: Array<{ id: string; name: string; url: string; mark: string; order: number }>;
  }>;
};
```

### 任务

- 实现 `createPublicHomeDocument(source)`：只通过上述白名单构造新对象；绝不采用 `...source` 再删除字段的黑名单方式。
- 实现 `normalizePublicHomeDocument(value)` 和 type guard；统一 title、mark、URL、id、order、preset/accent 的合法值和排序。
- 设置明确上限并在投影和 RPC 前后双重校验：建议最多 60 个分组、每组 100 个网站、标题 80 字符、网站 name/mark 各 80/20 字符、URL 2,048 字符；序列化 payload 最大 256 KiB。超过上限时发布失败并提示用户精简内容，不能静默截断为不同的分享内容。
- 为投影写单元测试或轻量 Node 校验：包含完整 `HomeDocumentV2`（含 syncMeta、billing、assets、widgets）的输入，断言输出不包含敏感 key、组件内容或 Storage URL；同时覆盖无效 URL、超限、旧 document 和稳定序列化。

实施结果：

- 新增 `src/domain/public-home-document.ts`，定义 `PublicHomeDocumentV1`、共享只读展示模型、公开字段上限、投影/解析结果和稳定序列化入口。
- `createPublicHomeDocument()` 在现有首页 normalize 前先执行严格预检，确保非法站点、超长字段或危险 URL 不会被静默过滤后形成部分分享；随后只通过逐字段白名单构造公开快照。
- 公开 group/site ID 使用连续派生 ID，不保留内部首页 ID；空分组不公开，没有任何可公开站点时返回 `empty-content`。
- URL 只允许 canonical HTTP/HTTPS，拒绝用户名/密码凭证；分组、单组站点、总站点和 UTF-8 payload 均有固定上限，超限整体失败且错误只包含 code 和结构 path。
- `parsePublicHomeDocument()` 严格拒绝未知字段、非连续 ID/order、非 canonical URL、非法 preset/accent 和不支持版本；`serializePublicHomeDocument()` 使用固定字段顺序生成确定性 JSON。
- `ReadOnlyHomeRenderer` 改为复用 domain 层只读模型，可直接接收验证成功的 `PublicHomeDocumentV1`，展示层仍不接触完整 `HomeDocumentV2`。
- 新增 `npm run verify:public-document`，覆盖敏感 sentinel 缺失、内部 ID 隔离、确定性序列化、UTF-8 大小、非法 URL、未知字段、空内容和各类上限。
- 扩展 `verify:privacy`，禁止 `documentTitle`、`publicDocument`、`publicSnapshot`、`shareToken` 和 `tokenHash` 进入 analytics、error monitoring 或本地审计 metadata。
- `npm run typecheck`、`npm run lint`、`npm run verify:public-document`、`npm run verify:privacy`、`npm run build` 和 `npm run verify:export` 已通过。

### 隐私不变量

- 任何公开 payload、公开 RPC 返回、分享 UI 状态、analytics、error report 和 local audit metadata 都不能记录 token、完整网站 URL、首页标题或 snapshot JSON。
- 公开 payload 不含 `documentId`、`updatedAt`、`revision`、`syncMeta`、`billing`、`widgets`、`keywords`、`bannerUrl`、`backgroundUrl`、`bannerAsset` 或 `backgroundAsset`。

## 1.17.3：Supabase 分享快照与 RPC

建议新增 migration `017_public_home_shares.sql` 以及对应 verify script。分享快照必须独立于 `sync_spaces` 和 `home_space_snapshots`，只以 `home_space_id` 关联 owner 范围。

建议表字段：

```text
public_home_shares
  id uuid primary key
  user_id uuid not null -> auth.users
  home_space_id uuid not null -> home_spaces(id)
  token_hash text not null unique
  document_json jsonb not null
  payload_version integer not null default 1
  status text not null default 'active'       -- active | revoked
  expires_at timestamptz null                  -- v1 UI 固定 null，预留兼容
  published_at timestamptz not null
  updated_at timestamptz not null
  revoked_at timestamptz null
  unique (home_space_id)
```

### RPC 合约

- `upsert_public_home_share(p_home_space_id, p_token_hash, p_document_json)`：仅 `authenticated`；验证 `auth.uid()` 是该空间 owner 且 `access_mode = 'account-managed'`，验证 JSON schema/大小，原子创建或覆盖该空间唯一记录为新的 active 快照；返回不含 hash/token/payload 的 owner metadata。
- `get_public_home_share_metadata(p_home_space_id)`：仅 `authenticated`；仅返回当前 owner 的发布状态、`published_at`、`updated_at` 和 `expires_at`，不返回 token、hash 或完整 payload。
- `revoke_public_home_share(p_home_space_id)`：仅 `authenticated`；仅 owner 可撤销；幂等成功，不泄露其他空间存在性。
- `read_public_home_share(p_token)`：可由 `anon` 和 `authenticated` 调用；在函数内部 hash token，且只返回有效、未过期的 `PublicHomeDocumentV1`。随机 token、撤销 token、过期 token、无效 token 与不存在记录均返回同一通用错误/空结果。

### 权限要求

- 对 table 启用 RLS，撤销 `anon`、`authenticated` 和 `public` 的直接表权限；不要建立允许直接 `select document_json` 的 policy。
- 所有 security-definer RPC 固定 `search_path = public`、严格的参数长度与 JSON object 校验，并按最小角色 `grant execute`。
- token hash 使用数据库可用的 SHA-256 或等价单向 hash；token 原文至少 256 bit 熵并采用 URL-safe encoding。hash 算法、编码和长度必须前后端固定为一个明确合约。
- verify script 必须以 anon、owner A、非 owner B 覆盖：直读拒绝、越权 owner 操作失败、有效 token 可读、撤销/过期/随机 token 同一失败结果。

## 1.17.4：分享管理与预览

### 入口与状态

- 在现有设置页“首页空间”管理范围内增加分享 section；只有当前激活且账号托管的空间显示可用入口。未登录、普通同步码或非活动空间显示原因说明，而不是无提示禁用。
- 发布前先对本机当前 `HomeDocumentV2` 生成投影，显示实际公开预览、公开字段列表以及“不包含组件和背景图片”“后续编辑不会自动更新”的说明。
- 有有效分享时显示：已发布、快照更新时间、公开预览、复制链接、更新已发布快照、撤销。仅保存 metadata，不在刷新后显示旧 token；用户重新进入管理页时如需复制/更新，生成新 token 的策略必须在实现前与 RPC 合约对齐。

### 关键实现决定

由于数据库只保存 hash，页面刷新后不能恢复原分享 token。因此 1.17.0 固定以下产品语义：**只在创建或更新成功的当前会话展示和复制链接；刷新后提供“重新发布并生成新链接”动作，不提供旧链接复制。** 这保持 token 不可恢复，同时避免把 token 写入 localStorage、账号偏好或审计记录。

- 复制失败时展示可访问的文本 fallback，允许用户手动复制，但不可把 token 写入 analytics/error/audit。
- 撤销需明确确认；成功后立即从内存清除 token 和旧 URL。
- 新增文案进入 dictionary，至少覆盖现有关键路径 locale；管理面板在 320px、390px、768px 与桌面保持可用。

## 1.17.5：公开分享页与部署

### 路由行为

- 新增 `app/share/page.tsx` 和 client component。页面从 `window.location.hash` 读取 token，读取后不将 token 复制到 state、日志、document title 或 query；调用 `read_public_home_share` 后只将 normalize 后的 payload 交给只读 renderer。
- 缺少 token、网络失败、非法 payload、已撤销或已过期均显示相同的“此分享不可用”页面；不得提示该 token 曾经存在或失效原因。
- `<head>` 设置 `robots: noindex, nofollow, noarchive`，不加载可识别访问者的分享统计。页面标题使用固定产品/分享页标题，不使用用户首页标题。
- 对外生成链接始终使用 `https://mylinker.net/share/#<token>`；`NEXT_PUBLIC_BASE_PATH` 只影响静态资源及 legacy 本地验证，不影响 canonical public URL。

### 静态兼容

- 更新 `verify-static-export.mjs`，要求 `out/share/index.html` 存在且其 `_next` 资源前缀同时适配根路径和 `/PersonalHomepge`。
- Cloudflare Pages production 和 GitHub Pages legacy 均 smoke test `/share/` 静态入口；GitHub legacy 仅验证，不作为文案或复制链接目标。

## 1.17.6：验收与上线

自动校验：

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run verify:export`
- `npm run verify:i18n`
- `npm run verify:privacy`（同步扩展规则，禁止分享 token、payload 和用户内容进入可观测 metadata）
- 分享 migration verify script 与公开投影校验。

人工回归：

- owner 创建、预览、复制、刷新后重新发布、更新、撤销和重新发布。
- 普通同步码空间、未登录用户、owner B、随机 token、撤销 token、过期 token。
- 发布后修改本机首页，确认公开页仍显示旧快照；明确更新后才变化。
- 桌面、平板、390px/320px、深浅主题与所有支持语言；公开页无编辑/设置/同步入口，无横向溢出。
- 检查 Network、console、analytics/error/audit 内容，确认 URL fragment、token、完整 URL、标题和 snapshot JSON 不出现。
- Cloudflare 主站和 GitHub legacy 完成静态入口验证；真实对外链接仅使用 `mylinker.net`。

## 依赖与风险门槛

- 先完成 1.17.1/1.17.2，再创建数据库 migration；不允许先接公开 RPC 后补投影。
- migration 上线前必须在 Supabase SQL 环境执行 verify，并保留回滚方案（撤销 execute grant、关闭 RPC、保持分享表不可直读）；不删除用户首页或既有快照。
- 只读 renderer 要优先复用样式和站点展示原子组件，而不是复制完整 `HomeDashboard`，以避免后续模板/历史/后台预览的视觉漂移。
- `expires_at` 只作为存储/RPC 兼容字段，v1 管理 UI 不提供过期时间设置；密码和 SEO 进入后续独立设计，不能顺带扩展本阶段。
