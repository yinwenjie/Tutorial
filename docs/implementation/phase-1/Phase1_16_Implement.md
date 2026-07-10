# Phase 1.16 低成本组件扩展实施记录

## Summary

Phase 1.16 的目标是在现有 Widget Registry、Widget Shell、统一配置弹窗、快照、同步和恢复体系上，新增少量纯前端、低数据体积、高日常价值的组件。Notes v1、Countdown v1、World Clock v1 和模板组件组合已完成，Phase 1.16.5 已完成本地回归与发布准备，等待提交和双站部署验证。

本阶段不是组件市场阶段，不实现联网组件，不新增后端服务，不扩大账号权限边界。RSS、天气、GitHub public repo 等需要代理、缓存、API key、额度或 OAuth 的能力继续保留在候选设计中，不进入 Phase 1.16 实现范围。

## Phase 1.16 总体边界

必须保持：

- 组件数据继续写入 `HomeDocumentV2.widgets[].config`，随完整首页文档进入本地保存、同步码、账号托管、历史快照、数据包导出和恢复。
- 新组件复用 `WidgetShell` 的标题、折叠、设置、管理、排序和删除能力。
- 新组件复用统一 `WidgetConfigDialog` 模式，不为每个组件另起配置入口。
- 新组件的内容操作保留在组件内部，低频设置进入配置弹窗。
- 新组件必须提供有信息量的折叠摘要。
- 新组件必须提供空状态和配置损坏时的可恢复默认值。
- 新组件必须接入 i18n runtime，不新增硬编码 UI 文案。

明确不做：

- 不新增 Supabase 表、RPC、Storage bucket 或 Edge Function。
- 不接入第三方 API、API key、OAuth、浏览器定位、通知提醒或服务端缓存。
- 不新增独立 widget 表或组件市场权限模型。
- 不把 Notes 正文、倒计时标题、城市标签、时区列表或完整 widget config 写入基础埋点、错误监控或本地审计 metadata。
- 不自动修改用户已有首页、历史快照或云端历史中的组件组合。

## Phase 1.16.0：组件扩展设计收口

状态：已完成设计收口。

目标：先固定 Notes、Countdown、World Clock 的数据模型、交互边界、隐私约束和验收标准，避免实现阶段范围漂移。

已完成：

- 明确 Phase 1.16 只做纯前端、低数据体积组件。
- 明确新组件继续内嵌在 `HomeDocumentV2.widgets[].config`，不新增服务端数据模型。
- 明确 Notes v1 为首个实现目标，Countdown 和 World Clock 作为后续递进候选。
- 明确所有候选组件的用户输入内容都属于敏感或半敏感用户意图，不进入 analytics/error/audit metadata。
- 明确新组件必须同步更新 registry、类型守卫、normalize、渲染分支、配置弹窗、折叠摘要、i18n、恢复预览和模板摘要。

## Phase 1.16.1：Notes v1 实现

状态：已完成并部署。

目标：在不新增后端和不扩大隐私边界的前提下，新增轻量便签组件，支持短备忘、临时想法和链接说明等首页工作台场景。

已完成：

- 新增 `notes.list` widget type，接入 `HomeWidgetType`、registry、类型守卫、默认配置和 normalize。
- 新增 `src/domain/notes-widget.ts`，提供 `NotesWidgetConfig`、`NoteItem`、20 条数量上限、500 字符长度上限、ISO 时间规范化、排序重排和统计 helper。
- 新增 `src/components/widgets/notes-list-widget.tsx`，展开态支持新增、编辑、删除、上移和下移；空状态提示添加第一条便签。
- 折叠摘要只显示便签数量或空状态，不展示正文。
- 统一配置弹窗接入 Notes 只读数量统计；正文编辑仍保留在组件展开态。
- `src/i18n/messages.ts` 和 `src/i18n/home-presentation.ts` 已补齐 Notes 名称、描述、设置标题、空状态、操作按钮和消息文案，并覆盖当前支持 locale。
- 新增 Notes 专用样式，复用现有 Widget/Todo 的紧凑密度和交互 token。

隐私边界：

- `widget.added` 仍只记录 `widgetType`。
- Notes 正文不进入埋点、错误监控、本地审计 metadata、折叠摘要或配置弹窗摘要。
- Notes config 继续随完整 `HomeDocumentV2` 进入本地保存、同步码、账号托管、历史快照、数据包导出和恢复，不新增独立存储。

自动校验：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run verify:i18n` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

部署记录：

- 已提交 `f35a5cf feat: add notes widget`。
- 已推送到 `master` 和 `production`。
- Cloudflare Pages 主站 `https://mylinker.net/` 已返回 200。
- GitHub Pages legacy `https://yinwenjie.github.io/PersonalHomepge/` 已通过手动重试完成 Pages build，latest build 状态为 `built`。

后续观察：

- Notes v1 先保持不进入默认模板。
- 如后续人工使用发现移动端密度或输入体验问题，作为 Phase 1.16 缺陷修复处理，不阻塞进入 Countdown v1 设计。

## Phase 1.16.2：Countdown v1 实现

状态：已完成并部署。

目标：在纯前端、低数据体积和不新增后端的边界内，新增简单倒计时组件，覆盖考试、发布、纪念日和项目节点等场景。

已完成：

- 新增 `countdown.timer` widget type，接入 `HomeWidgetType`、registry、类型守卫、默认配置和 normalize。
- 新增 `src/domain/countdown-widget.ts`，提供 `CountdownWidgetConfig`、标题长度限制、目标日期校验、display mode normalize 和倒计时状态计算。
- 无效或缺失目标日期显示未配置状态，不静默生成默认未来日期。
- 新增 `src/components/widgets/countdown-timer-widget.tsx`，展开态显示事件名、剩余天数/天数+小时、目标日期、今天到期和已过去状态。
- 统一配置弹窗接入组件名称、事件标题、目标日期和显示模式。
- 折叠摘要显示剩余天数、今天到期、已过去或未配置，不展示事件标题。
- `src/i18n/messages.ts` 和 `src/i18n/home-presentation.ts` 已补齐 Countdown 名称、描述、设置标题、配置项、空状态和状态文案，并覆盖当前支持 locale。
- 新增 Countdown 专用样式，保持 Widget 侧栏内的紧凑信息密度。
- `days-hours` 模式使用精确剩余时长，24 小时内显示小时，超过 24 小时显示天数和小时；`days` 模式显示日历天差。

隐私边界：

- `widget.added` 仍只记录 `widgetType`。
- 倒计时事件标题和目标日期不进入埋点、错误监控或本地审计 metadata。
- Countdown config 继续随完整 `HomeDocumentV2` 进入本地保存、同步码、账号托管、历史快照、数据包导出和恢复，不新增独立存储。

自动校验：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run verify:i18n` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

部署记录：

- 已提交 `a9e6e75 feat: add countdown widget`。
- 已推送到 `master` 和 `production`。
- Cloudflare Pages 主站 `https://mylinker.net/` 已返回 200。
- GitHub Pages legacy `https://yinwenjie.github.io/PersonalHomepge/` 已返回 200。

后续观察：

- Countdown v1 默认不带具体日期，模板接入时也不写死未来日期，避免过期信息误导用户。

## Phase 1.16.3：World Clock v1 实现

状态：已完成并部署。

目标：在纯前端、不接定位、不接外部 API 的边界内，新增世界时钟组件，服务开发者、远程协作和跨时区工作场景。

已完成：

- 新增 `world-clock.list` widget type，接入 `HomeWidgetType`、registry、类型守卫、默认配置和 normalize。
- 新增 `src/domain/world-clock-widget.ts`，提供 curated IANA timezone list、6 个时钟上限、40 字符标签上限、timezone 校验、排序重排和 fallback label。
- 新增 `src/components/widgets/world-clock-list-widget.tsx`，展开态显示 label、当前时间、日期和相对本地日期偏移。
- 使用浏览器 `Intl.DateTimeFormat` 进行 timezone 格式化，每 30 秒刷新一次。
- 统一配置弹窗接入新增时钟、编辑 label、选择 timezone、删除、上移和下移。
- 折叠摘要只显示时钟数量或空状态，不展示 label/timeZone。
- `src/i18n/messages.ts` 和 `src/i18n/home-presentation.ts` 已补齐 World Clock 名称、描述、设置标题、配置项、空状态、摘要和日期偏移文案，并覆盖当前支持 locale。
- 新增 World Clock 专用样式，配置弹窗在移动端会单列布局。

隐私边界：

- `widget.added` 仍只记录 `widgetType`。
- 城市/标签和时区组合可能暴露工作地点或协作对象，不进入埋点、错误监控或本地审计 metadata。
- 折叠摘要不展示 label/timeZone 明细。
- World Clock config 继续随完整 `HomeDocumentV2` 进入本地保存、同步码、账号托管、历史快照、数据包导出和恢复，不新增独立存储。

自动校验：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run verify:i18n` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

部署记录：

- 已提交 `333d68f feat: add world clock widget`。
- 已推送到 `master` 和 `production`。
- Cloudflare Pages 主站 `https://mylinker.net/` 已返回 200。
- GitHub Pages legacy `https://yinwenjie.github.io/PersonalHomepge/` 已返回 200。

后续观察：

- World Clock v1 可进入开发者工作台模板评估，但默认时区必须保持通用、非个人化。

## Shared Implementation Checklist

新增任一 widget type 时必须同步检查：

- `src/domain/home-document.ts`
  - 扩展 `HomeWidgetType`。
  - 更新 `isWidgetType` 间接依赖的 registry 类型范围。
- `src/domain/widget-registry.ts`
  - 新增 `WidgetDefinition`。
  - 设置 `allowMultiple`、默认标题、默认 config 和 normalize。
- `src/domain/<widget>-widget.ts`
  - 新增 config 类型、默认值、normalize、排序和统计 helper。
- `src/components/widget-panel.tsx`
  - 新增渲染分支。
  - 新增折叠摘要。
  - 确保埋点只记录 `widgetType`，不记录完整 config。
- `src/components/widgets/widget-config-dialog.tsx`
  - 接入配置字段。
  - 保存时继续走 normalize 边界。
- `src/i18n/messages.ts`
  - 补齐 `zh-CN`、`en-US` 和当前支持 locale 的 UI 文案。
  - 更新 `verify:i18n` 覆盖范围，如新增 key 属于关键路径。
- `src/i18n/home-presentation.ts`
  - 补齐组件名称、默认标题、描述和设置标题的展示层映射。
- 数据恢复中心和导出恢复路径
  - 确认新 config 能被完整保存、预览、导出和恢复。
  - 摘要只显示数量、类型和安全元信息，不展示正文或敏感标题。
- 样式与回归
  - 移动端 390px、平板、桌面无横向溢出。
  - 深色、浅色、紧凑密度、小语种下不遮挡。
  - 触屏设备关键入口不依赖 hover。

## Notes v1 Design

### Product Goal

Notes v1 提供轻量便签能力，用于短备忘、临时想法、链接说明和当日上下文。它不是富文本编辑器、知识库、Markdown 应用或附件系统。

### Widget Type

建议：

```ts
type HomeWidgetType = "notes.list";
```

### Config

建议字段：

```ts
type NotesWidgetConfig = {
  notes: NotesWidgetItem[];
};

type NotesWidgetItem = {
  id: string;
  text: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};
```

限制：

- 最多 20 条便签。
- 单条正文最大 500 字符，v1 实现时可按 UI 密度收紧到 280 字符。
- 空白正文不保存。
- `createdAt` 和 `updatedAt` 使用 ISO string。
- normalize 时按 `order` 排序并重排连续 order。
- normalize 时丢弃空正文、无效 id 和超过限制的项目。

### Expanded UI

展开态应支持：

- 新增便签。
- 编辑便签。
- 删除便签，删除前二次确认可选；如果删除入口足够明确，v1 可以用轻量确认。
- 上移/下移或拖拽排序，必须保留触屏可用兜底。
- 空状态：提示添加第一条便签。

不做：

- Markdown。
- 富文本。
- 附件。
- 标签。
- 全文搜索。
- 多列看板。
- 单条便签独立同步或历史。

### Collapsed Summary

折叠摘要不得展示正文。建议：

- 无便签：`No notes`
- 有便签：`{count} notes`
- 可选：`Updated {time}`，但不作为 v1 必需。

### Config Dialog

v1 配置弹窗只做：

- 组件名称。
- 类型、折叠状态等现有只读信息。
- 便签数量只读统计。

不在配置弹窗内编辑正文；正文属于高频内容操作，保留在组件展开态。

### Privacy And Observability

- `trackProductEvent("widget.added", { widgetType: "notes.list" })` 可保留。
- 不记录便签正文、便签数量以外的 config 细节。
- 错误监控只记录 widget type、错误阶段和脱敏错误类别。
- 本地审计不记录正文。

### Template Candidate

Notes v1 稳定后再进入模板评估。建议：

- 空白首页不预设。
- 极简起步不预设。
- 工作办公可评估加入 Notes + Todo。
- 通用效率可评估加入 Notes，但需验证首屏密度。

## Countdown v1 Design

### Product Goal

Countdown v1 提供简单倒计时能力，用于考试、发布、纪念日、项目节点和个人 deadline。它不是提醒系统、日历系统或通知服务。

### Widget Type

建议：

```ts
type HomeWidgetType = "countdown.timer";
```

### Config

建议字段：

```ts
type CountdownWidgetConfig = {
  eventTitle: string;
  targetDate: string;
  displayMode: "days" | "days-hours";
};
```

规则：

- `eventTitle` 最大 80 字符。
- `targetDate` 使用 `YYYY-MM-DD`，按浏览器本地时区解释。
- 缺失或无效日期时 normalize 到今天之后 7 天，或显示配置缺失空状态；实现时优先选择不会静默误导用户的策略。
- `displayMode` 默认 `days`。

### Expanded UI

展开态显示：

- 事件标题。
- 剩余天数。
- 目标日期。
- 到期状态：今天到期、已过去、剩余。

不做：

- 通知提醒。
- 重复倒计时。
- 系统日历联动。
- 服务端时间校准。
- 多事件列表。

### Collapsed Summary

建议：

- 剩余：`{count} days left`
- 今天：`Today`
- 已过：`{count} days ago`
- 未配置：`Set a target date`

### Config Dialog

配置弹窗支持：

- 组件名称。
- 事件标题。
- 目标日期。
- 显示模式。

### Privacy And Observability

倒计时标题可能暴露用户计划或隐私，不进入埋点、错误监控或审计 metadata。可记录 `widgetType` 和显示模式，不记录 `eventTitle` 或 `targetDate`。

### Template Candidate

Countdown v1 稳定后可优先评估学习研究模板，用于考试、课程节点或论文 deadline；通用效率模板可作为次选。

## World Clock v1 Design

### Product Goal

World Clock v1 提供纯前端世界时钟，服务开发者、远程协作和跨时区工作。它不是天气、定位或会议排期系统。

### Widget Type

建议：

```ts
type HomeWidgetType = "world-clock.list";
```

### Config

建议字段：

```ts
type WorldClockWidgetConfig = {
  clocks: WorldClockItem[];
};

type WorldClockItem = {
  id: string;
  label: string;
  timeZone: string;
  order: number;
};
```

规则：

- 最多 6 个时钟。
- `label` 最大 40 字符。
- `timeZone` 必须来自 curated IANA timezone 列表。
- normalize 时丢弃无效 timezone，保留有效条目并重排 order。
- 默认可提供 2-3 个常见时区，但是否默认填充需在实现时结合模板密度再决定。

### Curated Timezone List

v1 不引入完整时区数据库 UI。建议先提供有限列表：

- `Asia/Shanghai`
- `Asia/Tokyo`
- `Asia/Seoul`
- `Europe/London`
- `Europe/Paris`
- `America/New_York`
- `America/Los_Angeles`
- `America/Chicago`
- `UTC`

后续可按用户需求扩展。

### Expanded UI

展开态显示：

- 城市/标签。
- 当前时间。
- 日期或相对本地日期偏移，例如今天、昨天、明天。
- 可选显示 UTC offset，但不作为 v1 必需。

不做：

- 自动定位。
- 天气。
- 工作时间重叠计算。
- 会议排期。
- 第三方 API。

### Collapsed Summary

建议：

- 无时钟：`No clocks`
- 有时钟：`{count} clocks`
- 可选：第一个时区当前时间。

### Config Dialog

配置弹窗支持：

- 组件名称。
- 添加/删除时钟。
- 编辑标签。
- 从 curated list 选择 timezone。

如果配置弹窗复杂度过高，v1 可把添加/删除保留在展开态，配置弹窗只管理组件名称；实现前需要再确认。

### Privacy And Observability

城市标签和时区组合可能暴露用户工作地点或协作对象，不进入埋点、错误监控或审计 metadata。可记录 `widgetType` 和时钟数量 bucket，不记录 label/timeZone 明细。

### Template Candidate

World Clock v1 稳定后优先评估开发者工作台模板，不建议默认加入通用效率或极简模板。

## Phase 1.16.4：模板组件组合调整

状态：已完成代码接入、自动校验和人工模板创建回归。

目标：在新组件稳定后，小幅调整模板默认组件组合，只影响新建首页，不自动修改用户已有首页。

已完成：

- 空白首页继续不预设组件。
- 极简起步继续保持轻，只保留折叠月历，不默认加入 Notes。
- 通用效率新增折叠 `notes.list`，标题为“快速便签”，用于通用临时记录。
- 工作办公新增折叠 `notes.list`，标题为“工作便签”，与 Todo 和会议月历形成办公组合。
- 开发者工作台新增折叠 `world-clock.list`，标题为“协作时区”，预设 UTC、Shanghai 和 New York 三个通用协作时区。
- 学习研究新增折叠 `countdown.timer`，标题为“重要节点”，不预设目标日期，避免模板日期过期误导用户。
- `src/i18n/home-presentation.ts` 和 `src/i18n/messages.ts` 已补齐新增模板组件标题在当前支持 locale 下的展示映射。

边界：

- 只修改 `HOME_TEMPLATES[].widgets`，只影响新建首页和从模板创建空间。
- 不新增 migration，不修改用户已有首页、历史快照、云端历史或数据包内容。
- 新增组件默认折叠，模板默认组件最多 3 个，保持首屏信息密度克制。

自动校验：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run verify:i18n` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

人工回归结果：

- 首页模板库已显示通用效率、工作办公、开发者工作台和学习研究的新组件数量与本地化摘要。
- 已从首次创建流程应用开发者工作台模板，确认 Todo、Calendar 和 World Clock 类型、顺序、折叠状态及 UTC、Shanghai、New York 三时区 config 正确。
- 已覆盖 `1440px` 桌面和 `390px` 移动端模板生成结果，无横向溢出。
- 模板调整仍只通过 `createHomeDocumentFromTemplate()` 生成新文档，没有已有首页、快照或云端历史迁移逻辑。

## Phase 1.16.5：回归与部署收口

状态：已完成实现与本地回归，等待提交部署。

代码收口：

- 数据恢复中心快照预览不再重复组件标题，第二行改为“组件类型 · 隐私安全 config 摘要 · 折叠状态”。
- Notes 预览只显示便签数量，Countdown 只显示未来/今天/已过期/未配置状态，World Clock 只显示时钟数量。
- 本地审计 metadata 对组件 config、Notes/Todo 正文、倒计时标题和日期、World Clock 标签和时区、用户标题、URL 和搜索词进行递归脱敏。
- metadata key 在匹配前统一转为小写并移除 `_`、`-`，避免命名变体绕过脱敏。
- 新增 `scripts/verify-observability-privacy.mjs` 和 `npm run verify:privacy`，覆盖本地审计、产品埋点和错误属性三条观测边界。
- 修复窄屏恢复预览中长警告文案被 Grid 压缩到 20px、与后续区块发生纵向重叠的问题；弹窗 body 使用顶部对齐和 max-content 隐式行，超出内容进入内部滚动。

组件与模板回归：

- 首页模板库四个调整模板的组件数量和组件摘要正确。
- 开发者工作台首次创建后生成 `todo.list`、`calendar.month`、`world-clock.list`，新增 World Clock 默认折叠并保留三时区预设。
- Notes、Countdown、World Clock 的设置入口均能读取完整 config；组件管理态提供折叠、上移、下移和删除入口。
- Notes 折叠后显示 2 条便签摘要，折叠状态和 Notes/Countdown/World Clock config 在刷新后保持不变。

数据保全回归：

- 使用包含 Notes 正文、Countdown 标题和 World Clock 自定义标签的隔离夹具验证本地保存和刷新恢复。
- 注入本地历史快照后，恢复中心能读取并派生三个新组件的脱敏摘要，且预览不出现正文、事件标题或城市标签哨兵。
- 通过真实浏览器下载 HomeDocument JSON 和 `homepage-data-export-v1` 数据包；解析后 `widgets[]` 与刷新后的 `type`、`title`、`order`、`layout`、`config` 完全一致。
- 将导出的非敏感测试数据包重新选择到恢复入口，恢复预览正确识别文档标题和 3 个组件；未执行最终覆盖恢复。
- 本轮未创建真实同步码或账号托管测试空间。两条远端链路仍序列化完整 `HomeDocumentV2`，没有组件类型分支；真实账号态写入留部署后 smoke test。

多视口与多语言回归：

- 桌面 `1440x1000`、平板 `768x1024`、移动端 `390x844` 和窄屏 `320x568` 均无横向溢出。
- `fr-FR` 深色紧凑模式下组件首页、恢复中心和恢复预览无控件遮挡。
- `zh-TW`、`en-US`、`fr-FR`、`es-ES`、`ja-JP`、`ko-KR`、`it-IT` 的移动端 World Clock 摘要和配置弹窗均通过；意大利语额外覆盖 `320px` 窄屏。
- 恢复预览警告与下一节实际边界保留 14px 间距，不再纵向重叠。

隐私回归：

- `verify:privacy` 验证本地审计对 `note_text`、嵌套 `eventTitle`、`time_zone` 和完整 `clocks` config 脱敏。
- 产品埋点只保留 allowlisted `widgetType`，拒绝 Notes、Countdown 和 World Clock 自定义字段。
- 错误监控属性只保留 allowlisted `source`，拒绝 config、label 和 targetDate。
- 浏览器回归确认快照预览、本地审计和导出审计不包含组件哨兵；完整用户内容只存在于预期的首页文档、快照和用户主动导出的数据文件。

自动校验：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run verify:i18n` 通过。
- `npm run verify:privacy` 通过。
- `npm run build` 通过。
- `npm run verify:export` 通过。

## Phase 1.16 Acceptance

Phase 1.16 完成时至少满足：

- Notes v1 完整上线，或明确记录为何只完成设计而暂缓实现。
- `HomeWidgetType`、registry、normalize、渲染、配置、折叠摘要、i18n、恢复预览和模板摘要链路完整。
- 新组件在本地保存、同步码、账号托管、历史快照、JSON 导出和数据包导出/恢复中不丢失。
- 多视口无横向溢出，移动端关键操作可触达。
- `npm run typecheck`、`npm run lint`、`npm run build`、`npm run verify:export`、`npm run verify:i18n`、`npm run verify:privacy` 通过。
- 文档更新 Phase 1 计划和实施记录，说明实际完成范围、暂缓范围和后续候选。

## Next Step

下一步提交 Phase 1.16.5，推送 `master` 和 `production`，完成 Cloudflare Pages 主站与 GitHub Pages legacy 部署验证。部署完成后进入 Phase 1.17，只读 renderer 与分享链接在实现前先完成数据暴露、撤销和只读边界设计。
