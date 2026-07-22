# Phase 1.17 只读渲染与公开快照分享 v1 实施计划

## Summary

Phase 1.17 为账号托管首页提供可撤销的公开分享能力，并沉淀一个不依赖编辑状态、同步状态或浏览器本地存储的只读首页渲染层。

分享对象是用户显式发布的 `PublicHomeDocumentV1` 快照，而不是当前 `HomeDocumentV2` 的实时公开映射：用户之后继续编辑首页，不会自动修改已发布内容；更新分享必须再次确认。这样既避免把同步读取路径变成公开旁路，也让分享内容、撤销和恢复语义稳定可解释。

当前状态：1.17.0-1.17.5 已完成仓库实现；1.17.6 已补齐防偏差验收工具，包括事务内 A/B SQL 断言、过期/撤销 token 检查、本地分享合约校验和双站 `/share/` 部署 smoke 脚本。2026-07-21 已通过匿名公开 RPC 确认目标 Supabase 存在 `017`，并定位首次发布失败为 upsert 冲突目标的 PostgreSQL `42702` 歧义；仓库已新增 `018` 热修复、`020` 在线检查和前端安全错误分类。2026-07-22 三个无 token 线上静态入口已通过 smoke test；真实 owner/anon A-B 回归、真实账号交互、真实 token smoke 和生产闭环仍待目标数据库执行 `018` 后完成。

## 已确认范围与边界

- 仅已登录用户拥有的 `account-managed` 首页空间可发布；普通同步码空间继续维持密文边界，不能分享。
- 每个账号托管空间最多一个有效分享。发布、更新均替换该快照；撤销立即失效且旧 token 永不恢复；重新发布生成新 token。
- 公开页面默认仅展示：首页标题、主题 preset/accent、分组及网站的名称、URL、mark 和排序。
- Notes、Todo、Countdown、World Clock、月历等组件及其 config 不公开；Banner/背景图片、私有 Storage URL、关键词、同步元数据、账号资料、审计和恢复信息也不公开。
- token 为独立的高熵随机值，只在客户端生成一次并通过 TLS 传给 RPC；数据库只存 token hash，不能由 hash 还原 token。
- 正式公开链接固定为 `https://mylinker.net/share/#<token>`；仅在 `localhost`、`127.0.0.1`、`::1` 本地服务上生成同源 `/share/#<token>` 供未部署版本验证。fragment 不进入 HTTP request 或 Referer；`/share/` 为静态导出的客户端入口，兼容根路径和 GitHub Pages legacy 子路径。
- v1 不做密码、SEO/public slug、访问统计、访问者身份、评论、协作编辑、自定义域名或实时更新。

## 交付顺序

| 子阶段 | 目标 | 主要产物 | 完成条件 |
|---|---|---|---|
| 1.17.0 | 设计收口 | 本文档、字段/权限/失败语义确认 | 不存在公开读取完整首页的歧义 |
| 1.17.1 | 只读 Renderer | 数据源无关的 `ReadOnlyHomeRenderer` | 现有编辑首页行为不变，renderer 无副作用 |
| 1.17.2 | 公开投影 | `PublicHomeDocumentV1`、normalize、投影测试 | 白名单投影且敏感字段无法进入 payload |
| 1.17.3 | 分享存储与 RPC | migration、verify、repository | 表无直接公开读取；RPC 满足 owner/anon 边界 |
| 1.17.4 | 发布管理（代码已完成） | 设置页分享面板、预览、复制/更新/撤销 | 本地 UI/静态检查已通过，待 `018` 后 owner 回归 |
| 1.17.5 | 公开页面（代码已完成） | `/share/`、通用失败页、metadata | 根路径与 legacy 子路径导出已通过，待真实 token smoke test |
| 1.17.6 | 回归与发布（仓库验收工具已完成） | 自动校验、人工回归、双站 smoke test | 防偏差脚本已落地，线上静态入口已验；数据库 A-B、真实账号和真实 token 待执行 |

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

状态：基础 migration 已在线；`018` 热修复代码已完成，待目标 Supabase 执行并回归。

已新增 `supabase/migrations/017_public_home_shares.sql`、`018_public_home_share_upsert_conflict_fix.sql`、`supabase/checks/019_public_home_shares_verify.sql`、`020_public_home_share_upsert_conflict_fix_verify.sql`、浏览器 token helper 和 RPC-only repository。分享快照独立于 `sync_spaces`、`home_space_credentials`、`home_space_snapshots` 与审计表，只通过 `(home_space_id, user_id)` 复合外键建立 owner 边界。

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

### 实施结果

- `public.public_home_shares` 每个首页空间只保留一条记录，包含公开 schema version、JSON 快照、状态和时间戳；`token_hash` 是唯一的 64 位十六进制 SHA-256，不保存 token 原文。删除首页空间或账号会级联删除分享记录。
- `createPublicHomeShareToken()` 使用 `crypto.getRandomValues()` 生成 32 随机字节并编码为 43 字符的无 padding Base64URL；`isPublicHomeShareToken()` 固定同一长度和字符集。token 仅应保留在当前发布会话内与分享 URL fragment，不能进入 localStorage、审计、analytics 或错误上报。
- `upsert_public_home_share(p_home_space_id, p_token, p_document_json)` 仅授权 `authenticated`。RPC 在数据库内以 `SHA-256("mylinker-public-share-v1:" || token)` 计算 hash，验证当前 owner、`account-managed` 模式、43 字符 token 和完整 v1 JSON schema；同一空间更新时必须使用新 token，active 更新保留首次 `published_at`，撤销后重新发布重置它。
- 原函数的 `ON CONFLICT (home_space_id)` 会与 `RETURNS TABLE` 隐式声明的同名输出变量冲突，首次执行 INSERT 时由 PostgreSQL 抛出 `42702`。`018` 用 `ON CONFLICT ON CONSTRAINT public_home_shares_one_per_home_space` 原位替换函数；`017` 也已同步采用修复写法，保证新环境不会复现。
- `get_public_home_share_metadata(p_home_space_id)` 仅返回 owner 的 status、version 与时间戳；不返回 `token_hash`、token 或 `document_json`。没有记录或不符合 owner/account-managed 边界时统一返回空结果。
- `revoke_public_home_share(p_home_space_id)` 仅允许 owner 调用，重复撤销保持幂等；首次撤销立即把状态改为 `revoked`，并以新的随机不可逆 hash 覆盖旧 hash，使旧 token 永不可恢复。
- `read_public_home_share(p_token)` 仅返回有效、未过期、仍为账号托管空间的 `payload_version` 与 `document_json`；格式错误、随机、撤销、过期或不存在 token 均返回零行，不写入访问日志或审计。
- 数据库 `public_home_document_v1_valid(jsonb)` 独立复核所有公开字段白名单、version、preset、accent、连续 ID/order、分组/站点/字节上限和 canonical HTTP(S) URL 的保守格式；表约束、owner RPC 与公开 read 都使用该检查，浏览器仍会以 `parsePublicHomeDocument()` 复核返回值。
- 分享表开启 RLS 但不建立前端 policy，`anon`、`authenticated`、`PUBLIC` 均没有直接表权限。四个 RPC 均为 fixed `search_path` 的 `security definer`；三个 owner RPC 只 grant 给 `authenticated`，公开 read 只 grant 给 `anon` 与 `authenticated`，hash/schema helpers 无前端执行权限。
- 新增 `PublicHomeShareRepository`，只通过上述 RPC 访问，publish/read 前后严格解析公开 document；repository 不保留 raw error，只按数据库未更新、会话失效、空间无权、网络失败、内容拒绝和未知失败分类，避免调用方把 token、完整 payload 或错误详情传入可观测路径。发布面板据此给出可操作提示，不再把所有问题归为 migration/登录/空间的同一文案。
- 新增 `npm run verify:public-share`，覆盖 256-bit Base64URL token 合约、迁移中表/复合 FK/RLS/最小 grants/RPC/hashing、`017`/`018` 命名冲突约束和 rollback A/B check；`020` 校验线上函数已消除歧义且 grant 未扩大，`019` 继续覆盖实际数据库权限、函数定义、schema 有效性与可选 A/B 事务回归。

### RPC 合约

- `upsert_public_home_share(p_home_space_id, p_token, p_document_json)`：仅 `authenticated`；浏览器传入一次性 raw token，RPC 负责 hash，返回不含 hash/token/payload 的 owner metadata。
- `get_public_home_share_metadata(p_home_space_id)`：仅 `authenticated`；仅返回当前 owner 的发布状态、`published_at`、`updated_at`、`expires_at` 与 `revoked_at`。
- `revoke_public_home_share(p_home_space_id)`：仅 `authenticated`；仅 owner 可撤销；没有分享记录时为空结果，重复撤销返回同一 revoked metadata。
- `read_public_home_share(p_token)`：可由 `anon` 和 `authenticated` 调用；函数内部 hash token，只返回有效的公开 v1 payload。随机、撤销、过期、无效与不存在 token 的结果均为空。

### 权限要求

- 对 table 启用 RLS，撤销 `anon`、`authenticated` 和 `public` 的直接表权限；不要建立允许直接 `select document_json` 的 policy。
- 所有 security-definer RPC 固定 `search_path = public`、严格的参数长度与 JSON object 校验，并按最小角色 `grant execute`。
- token hash 使用 `SHA-256("mylinker-public-share-v1:" || token)`；token 原文为 256 bit 随机值、32 字节无 padding Base64URL（恰好 43 字符）。hash 算法、编码和长度均已作为固定前后端合约实现。
- verify script 必须以 anon、owner A、非 owner B 覆盖：直读拒绝、越权 owner 操作失败、有效 token 可读、撤销/过期/随机 token 同一失败结果。

## 1.17.4：分享管理与预览

状态：代码与错误诊断已完成，待目标数据库执行 `018` 后做真实账号回归。

### 入口与状态

- 在现有设置页“首页空间”管理范围内增加分享 section；只有当前激活且账号托管的空间显示可用入口。未登录、普通同步码或非活动空间显示原因说明，而不是无提示禁用。
- 发布前先对本机当前 `HomeDocumentV2` 生成投影，显示实际公开预览、公开字段列表以及“不包含组件和背景图片”“后续编辑不会自动更新”的说明。
- 有有效分享时显示：已发布、快照更新时间、公开预览、复制链接、更新已发布快照、撤销。仅保存 metadata，不在刷新后显示旧 token；用户重新进入管理页时如需复制/更新，生成新 token 的策略必须在实现前与 RPC 合约对齐。

### 关键实现决定

由于数据库只保存 hash，页面刷新后不能恢复原分享 token。因此 1.17.0 固定以下产品语义：**只在创建或更新成功的当前会话展示和复制链接；刷新后提供“重新发布并生成新链接”动作，不提供旧链接复制。** 这保持 token 不可恢复，同时避免把 token 写入 localStorage、账号偏好或审计记录。

- 复制失败时展示可访问的文本 fallback，允许用户手动复制，但不可把 token 写入 analytics/error/audit。
- 撤销需明确确认；成功后立即从内存清除 token 和旧 URL。
- 新增文案进入 dictionary，至少覆盖现有关键路径 locale；管理面板在 320px、390px、768px 与桌面保持可用。

### 实施结果

- 新增 `PublicHomeSharePanel`，放在设置页“首页空间”管理范围内；未登录、账号读取中、本地存储未就绪、无当前空间和普通同步码空间分别显示明确原因，只有当前账号托管空间进入管理态。
- 管理态直接调用 `createPublicHomeDocument()` 生成实际公开预览，复用 `ReadOnlyHomeRenderer` 展示标题、主题、分组与网站，并同时列出公开字段、排除字段和“后续编辑不会自动更新”的快照说明。
- 面板只通过 `PublicHomeShareRepository` 读取 owner metadata、发布和撤销。metadata 不包含 token/hash/payload；组件不调用埋点、错误监控或本地审计，也不读写 `localStorage` / `sessionStorage`。
- 每次发布、更新或刷新后重新发布都会使用新 token。链接只写入本次已挂载页面的只读输入框，React 状态只保存“是否存在本次会话链接”的布尔值；账号、空间或存储资格变化会重新挂载并清空链接。
- 自动复制失败时保留可选中的完整链接输入框和手动复制提示；刷新后有效分享只显示 metadata 与“重新发布并生成新链接”，不会恢复旧 token。
- 撤销使用明确确认，成功后立即清空链接输入框；再次撤销由数据库保持幂等。发布、复制和撤销路径没有 token/URL/payload 的 console 或 observability 输出。
- 新增简中、繁中、英语、法语、西语、日语、韩语和意大利语文案；新增响应式预览、metadata、链接输入与操作布局，窄屏降为单列。

## 1.17.5：公开分享页与部署

状态：代码已完成；静态导出已验证，待 `018` 后做真实 token 与线上双站 smoke test。

### 路由行为

- 新增 `app/share/page.tsx` 和 client component。页面从 `window.location.hash` 读取 token，读取后不将 token 复制到 state、日志、document title 或 query；调用 `read_public_home_share` 后只将 normalize 后的 payload 交给只读 renderer。
- 缺少 token、网络失败、非法 payload、已撤销或已过期均显示相同的“此分享不可用”页面；不得提示该 token 曾经存在或失效原因。
- `<head>` 设置 `robots: noindex, nofollow, noarchive`，不加载可识别访问者的分享统计。页面标题使用固定产品/分享页标题，不使用用户首页标题。
- 非 loopback 环境对外生成链接始终使用 `https://mylinker.net/share/#<token>`；本地 loopback 测试使用当前 origin，避免主站尚未部署 `/share/` 时误跳线上 404。`NEXT_PUBLIC_BASE_PATH` 只影响静态资源及 legacy 本地验证，不影响 canonical public URL。

### 静态兼容

- 更新 `verify-static-export.mjs`，要求 `out/share/index.html` 存在且其 `_next` 资源前缀同时适配根路径和 `/PersonalHomepge`。
- Cloudflare Pages production 和 GitHub Pages legacy 均 smoke test `/share/` 静态入口；GitHub legacy 仅验证，不作为文案或复制链接目标。

### 实施结果

- 新增 `app/share/page.tsx` 与 `PublicHomeSharePage`。静态页面使用固定 `Shared home · MyLinker` title，并输出 `noindex`、`nofollow`、`noarchive`、`nocache` robots metadata。
- client component 只在请求函数局部变量中读取 `window.location.hash.slice(1)`；token 不复制到 React state、document title、query、localStorage、analytics、error monitoring 或 audit。
- 公开页只把 repository 严格解析成功的 `PublicHomeDocumentV1` 交给 `ReadOnlyHomeRenderer`；缺少/非法/随机/撤销/过期 token、网络失败和非法响应统一进入“此分享不可用”，不透露历史状态。
- 公开页没有编辑、登录、设置、同步、恢复或统计入口；只读站点外链继续使用 `target="_blank"` 与 `noopener noreferrer`。
- `verify-static-export.mjs` 现在强制检查 `out/share/index.html`，并核对 robots 指令；所有导出 HTML 的 `_next` 前缀继续统一验证。
- 对外链接由 `buildPublicHomeShareUrl()` 在非 loopback 环境固定生成 `https://mylinker.net/share/#<token>`；`localhost`、`127.0.0.1` 和 `::1` 生成当前本地 origin 的 `/share/#<token>`，用于在正式部署前验证真实数据库快照。

## 1.17.6：验收与上线

状态：仓库验收工具已完成，线上静态入口 smoke 已通过；Supabase A-B、真实账号交互和真实 token smoke test 待执行。

自动校验：

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run verify:export`
- `npm run verify:i18n`
- `npm run verify:privacy`（同步扩展规则，禁止分享 token、payload 和用户内容进入可观测 metadata）
- 分享 migration verify script 与公开投影校验。
- `npm run verify:public-share-deployment`（部署后执行，只验证无 token 的三个 `/share/` 静态入口）。

人工回归：

- owner 创建、预览、复制、刷新后重新发布、更新、撤销和重新发布。
- 普通同步码空间、未登录用户、owner B、随机 token、撤销 token、过期 token。
- 发布后修改本机首页，确认公开页仍显示旧快照；明确更新后才变化。
- 桌面、平板、390px/320px、深浅主题与所有支持语言；公开页无编辑/设置/同步入口，无横向溢出。
- 检查 Network、console、analytics/error/audit 内容：token 只允许出现在分享 URL fragment 和 Supabase RPC 的 TLS request body 中；公开 snapshot 只允许出现在成功读取 RPC response 中；不得进入 URL query、Referer、console、持久化存储或可观测 metadata。
- Cloudflare 主站和 GitHub legacy 完成静态入口验证；真实对外链接仅使用 `mylinker.net`。

### 已完成回归

- `npm run typecheck`、`npm run lint`、`npm run verify:i18n`、`npm run verify:public-document`、`npm run verify:public-share`、`npm run verify:privacy`、`npm run build`、`npm run verify:export` 全部通过。
- `verify:public-share` 已扩展 canonical fragment URL、分享管理禁用持久化/观测调用、公开页 fragment 局部读取、token 不进入 React state、route robots metadata、A/B rollback SQL 防偏差和部署 smoke 脚本存在性检查。
- 根路径构建与 `NEXT_PUBLIC_BASE_PATH=/PersonalHomepge` 构建均包含静态 `/share/`，对应 `_next` 资源前缀和 robots 指令均通过验证。
- 2026-07-22 已运行 `npm run verify:public-share-deployment`，Cloudflare Pages preview、`mylinker.net` 与 GitHub Pages legacy 的无 token `/share/` 静态入口均通过 HTTP 200/robots smoke test。
- 数据库上线、A/B rollback、部署 smoke test 与回滚步骤已固化到 `docs/guides/PublicHomeShareDatabaseRunbook.md`；在目标数据库未通过 `020` / `019` 和真实账号回归前，不将真实分享功能标记为生产闭环。

## 依赖与风险门槛

- 先完成 1.17.1/1.17.2，再创建数据库 migration；不允许先接公开 RPC 后补投影。
- migration 上线前必须在 Supabase SQL 环境执行 verify，并保留回滚方案（撤销 execute grant、关闭 RPC、保持分享表不可直读）；不删除用户首页或既有快照。
- 只读 renderer 要优先复用样式和站点展示原子组件，而不是复制完整 `HomeDashboard`，以避免后续模板/历史/后台预览的视觉漂移。
- `expires_at` 只作为存储/RPC 兼容字段，v1 管理 UI 不提供过期时间设置；密码和 SEO 进入后续独立设计，不能顺带扩展本阶段。
