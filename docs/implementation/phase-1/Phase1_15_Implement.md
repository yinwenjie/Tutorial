# Phase 1.15 多语言支持 v1 实施记录

## Summary

Phase 1.15 聚焦产品 UI 的多语言支持。语言偏好属于账号/本机 UI 偏好，不属于首页空间内容；因此不进入 `HomeDocumentV2`、同步码密文、账号托管首页文档、历史快照或数据包导出。

v1 采用分层交付：先完成语言数据模型、Supabase 约束和系统语言解析，再逐步落地 I18n Provider、设置页入口、首页主路径、设置页核心路径和剩余组件/同步/恢复文案。

## Phase 1.15.0：多语言数据模型与 migration

已完成：

- 扩展前端语言偏好类型，支持：
  - `system`
  - `zh-CN`
  - `zh-TW`
  - `en-US`
  - `fr-FR`
  - `es-ES`
  - `ja-JP`
  - `ko-KR`
  - `it-IT`
- 新增 `ResolvedLocale` 概念：`system` 只作为保存偏好，渲染和格式化前会解析为具体 locale。
- 新增 `resolveLocalePreference(...)`，根据浏览器语言候选解析系统语言；不支持的浏览器语言回落到 `zh-CN`。
- 更新 `html lang` 设置逻辑，避免把 `system` 写入 DOM。
- 更新现有日期时间格式化入口，避免将 `system` 直接传给 `Intl.DateTimeFormat`。
- 扩展 `LOCALE_OPTIONS`，为后续设置页语言选择提供完整候选。
- 更新账号偏好保存错误提示：如果线上还未执行 016 migration，保存新语言值时会提示先执行 `016_account_preferences_i18n_locale.sql`。
- 新增 Supabase migration：`supabase/migrations/016_account_preferences_i18n_locale.sql`。
- 新增 Supabase verify：`supabase/checks/018_account_preferences_i18n_locale_verify.sql`。
- 更新 `supabase/checks/012_account_preferences_editing_verify.sql`，使现有偏好验证兼容新的 locale 允许值。
- 更新 `docs/guides/SupabaseMigrationChecklist.md`，补充 016 migration 和 018 verify。

数据与架构边界：

- 不新增 Supabase 表。
- 不改变 RLS、grant、默认首页空间、账号托管凭证或同步 RPC。
- 不修改 `HomeDocumentV2`。
- 不修改首页文档、模板、快照、导入导出和同步码数据结构。
- 不开始大规模 UI 文案翻译；UI 翻译从 Phase 1.15.1 之后继续推进。

## Phase 1.15.1：I18n Provider 与 formatter 底座

已完成：

- 新增静态 dictionary 底座，`zh-CN` 作为 source of truth，其他支持语言可按 key 增量覆盖并回落到 `zh-CN`。
- 新增 `I18nProvider` 和 `useI18n()`，从 UI 偏好派生 resolved locale，避免把 `system` 传给运行时渲染和格式化。
- 新增统一 formatter 底座，收口日期时间、短日期时间、年月、月日、日、星期标签和数字格式化。
- 将 `I18nProvider` 接入应用运行时壳层，挂在 `UiPreferencesProvider` 内部，确保账号/本地语言偏好生效后再派生 i18n 状态。
- 首页日期标签和更新时间改为使用统一 formatter。
- 月历组件的月份、星期标签、今天、周起始、aria label 和导航 title 改为使用 i18n runtime。
- 组件折叠摘要中的 Todo 和月历摘要改为使用 i18n runtime 与 formatter。
- `src/domain/calendar-widget.ts` 去除硬编码 `zh-CN` 月份和中文星期标签，改为接收 resolved locale。

数据与架构边界：

- 不修改 `HomeDocumentV2`。
- 不新增 Supabase 表、migration、RPC 或 Storage 配置。
- 不修改首页文档、模板、快照、导入导出和同步码数据结构。
- 不把模板、默认首页分组名、用户自定义标题或历史快照内容翻译后写回文档。
- 不做全站文案翻译；设置页、同步、恢复和剩余组件文案进入后续子阶段。

验证：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

## Phase 1.15.2：设置页语言选择落地

已完成：

- 通用设置面板接入 `useI18n()`，语言、主题偏好、字体、界面密度、默认搜索引擎和默认首页空间等入口文案改为 i18n runtime 渲染。
- 语言下拉选项改为通过 dictionary 渲染，不再依赖 `LOCALE_OPTIONS` 中的静态中文 label。
- 选择 `system` 时，在语言控件下显示当前 resolved locale，帮助用户理解“跟随系统”的实际渲染结果。
- 通用设置保存按钮、保存中状态、本地/账号保存成功提示、账号/本地偏好作用域说明和禁用 title 改为 i18n runtime。
- 设置页折叠摘要中的“账号偏好/本地偏好”和语言名称改为 i18n runtime；默认搜索引擎仍使用产品固有名称。
- 设置页中通用设置 section 的 title 和 kicker 改为 i18n runtime。
- 为语言解析说明补充轻量 CSS，避免浏览器默认 `small` 样式破坏表单密度。

数据与架构边界：

- 不修改 `HomeDocumentV2`。
- 不新增 Supabase 表、migration、RPC 或 Storage 配置。
- 不改变本地偏好和账号偏好保存模型。
- 不把语言选择结果写入首页文档、同步码密文、账号托管首页文档、历史快照或数据包导出。
- 不扩大到全设置页文案翻译；设置页核心路径和剩余同步/恢复细节继续留给后续阶段。

验证：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

## Phase 1.15.3：首页主路径本地化

已完成：

- 首页外壳接入 `useI18n()`，欢迎条、模板入口、搜索框、首页标题编辑和确认弹窗文案改为 i18n runtime 渲染。
- 首页模板库增加展示层本地化，模板名称、摘要、计数、按钮 title 和模板组件示例名按当前语言显示。
- 首页站点集合主路径本地化，分组/网站操作菜单、拖拽 title、空搜索态、保存消息和删除入口改为 dictionary 文案。
- 首页直编弹窗与编辑 hook 本地化，新增/编辑分组和网站的表单标签、校验错误、确认框和保存消息接入 i18n runtime。
- 首页组件侧栏本地化，账号状态、统计指标、同步状态枚举、更新时间、组件管理、组件选择器和删除确认改为 dictionary 文案。
- Widget Shell、组件设置弹窗和 Todo List 基础交互接入 i18n runtime，覆盖首页一步可触达的组件标题编辑、折叠、排序、设置、任务筛选和清理已完成任务。
- 新增 `src/i18n/home-presentation.ts`，将模板 id、组件类型、模板内置组件标题和同步状态枚举的展示本地化收口在 UI 展示层。
- 补齐 `zh-TW`、`fr-FR`、`es-ES`、`ja-JP`、`ko-KR` 和 `it-IT` 的首页主路径新增文案覆盖，避免 1.15.3 新增 UI 在非英文语言下继续回落到简中。
- 组件卡片标题增加默认/内置标题展示层本地化：`月历`、模板内置组件标题等随语言显示，但不回写 `HomeDocumentV2`。

数据与架构边界：

- 不修改 `HomeDocumentV2`。
- 不新增 Supabase 表、migration、RPC 或 Storage 配置。
- 不翻译用户已保存的分组名、网站名、组件标题、首页标题或历史快照内容。
- 组件标题仅对产品默认值和模板内置值做展示层本地化；用户手动改名后的组件标题仍按用户输入显示。
- 不修改 `createHomeDocumentFromTemplate()` 的持久化生成逻辑；模板库仅在展示层本地化，应用模板后仍按既有模板数据生成首页文档。
- 不扩大到设置页核心路径、同步面板、恢复中心、导入导出等后续阶段文案。

验证：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。
- 1.15.3 新增文案覆盖块完整性检查通过：6 个非简中 locale 均覆盖同一组 216 个新增 key。

后续任务：

- Phase 1.15.4：设置页核心路径本地化。
- Phase 1.15.5：组件、同步和恢复细节本地化收口。
- Phase 1.15.6：质量回归与文档。

## Phase 1.15.4：设置页核心路径本地化

已完成：

- 设置页外壳、折叠 section、账号、首页空间、主题风格、Banner/背景、数据恢复中心和高级操作入口接入 i18n runtime。
- 主题 preset、图片 slot、首页空间 access mode、恢复中心资产摘要和历史版本元信息通过展示层 helper 本地化，不回写首页文档。
- 数据恢复中心的本地/云端历史版本选择、预览、恢复确认、空状态和恢复结果接入 dictionary。
- 首页空间创建、模板创建、认领、迁移、恢复、激活、重命名、默认空间和移除确认接入 dictionary。
- 补齐设置页核心路径在 `zh-TW`、`fr-FR`、`es-ES`、`ja-JP`、`ko-KR` 和 `it-IT` 的基础覆盖；英语完整覆盖。

数据与架构边界：

- 不修改 `HomeDocumentV2`。
- 不新增 Supabase 表、migration、RPC 或 Storage 配置。
- 不改变账号托管、同步码、历史快照或数据包结构。
- 用户自定义空间名、组件标题、首页标题、分组名和网站名仍按用户输入显示。

验证：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

## Phase 1.15.5：组件、同步和恢复细节本地化收口

已完成：

- 同步面板接入 `useI18n()`，同步码创建/绑定/复制/解除/废弃、拉取/上传、暂停、冲突、账号托管边界说明和云端/本地覆盖确认全部改为 dictionary 文案。
- 同步面板日期显示改用统一 i18n formatter，移除本地 `Intl` 和保存值 `system` 的直接格式化。
- 书签 HTML / URL 列表导入面板接入 i18n，覆盖导入入口、草稿恢复/丢弃、解析结果、分组映射、预览筛选、分页、确认导入和撤销导入。
- 导入预览中的重复状态和原因改为展示层本地化，不再直接渲染 domain 中的中文 reason。
- 本机状态、本地审计日志、产品改进/错误诊断设置和 Next route error 页面接入 i18n runtime。
- 新增 `formatSettingsHomeDocumentClass(...)` 展示层 helper，首页数据分类按当前语言显示。
- 埋点事件名、审计事件 `type`、监控 operation 和诊断 metadata 保持稳定英文，不做本地化。

数据与架构边界：

- 不修改 `HomeDocumentV2`、同步码格式、同步 RPC、数据包结构或 Supabase 配置。
- 不翻译用户导入的网站名、URL、源文件名、分组名或已有首页空间名。
- 同步和导入新增 key 在 `zh-CN` 与 `en-US` 完整覆盖；繁体中文通过 `settings.*` 转换器覆盖；其他 v1 语言本阶段可先回落到英语，翻译精修进入 1.15.6。
- 本地审计记录 message 保留创建时文本，展示层仅本地化审计面板标题、操作和空状态。

验证：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。
- 本地开发服务已启动，`/` 与 `/edit/` HTTP 校验通过；人工 UI 验证待完成。

后续任务：

- Phase 1.15.6：质量回归与文档，重点检查新增 key 覆盖、非英语翻译精修和长文本布局。
