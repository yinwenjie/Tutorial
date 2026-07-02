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

后续任务：

- Phase 1.15.2：设置页语言选择落地。
- Phase 1.15.3：首页主路径本地化。
- Phase 1.15.4：设置页核心路径本地化。
- Phase 1.15.5：组件、同步和恢复细节本地化收口。
- Phase 1.15.6：质量回归与文档。
