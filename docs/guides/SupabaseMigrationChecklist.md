# Supabase SQL 执行清单

## Summary

本项目的 Supabase 数据库变更保存在 `supabase/migrations/` 目录。2026-07-25 已接入 Supabase CLI 本地 migration replay、数据库 lint、pgTAP 和 Deno Functions 测试基线；2026-08-10 已完成受保护远程 dry-run/apply/verification 工作流、GitHub `supabase-production` Environment、secrets、reviewer、`master` 分支限制和 project-ref 配置。目标项目已存在 001-019 schema；经一次性受保护审计后，CLI migration history 已安全对齐到 019，标准 dry-run 返回远端 up to date，标准 verify 和完整 `021` rollback 通过。

## 当前迁移顺序

1. `supabase/migrations/001_sync_spaces.sql`
   - 创建 `sync_spaces` 表。
   - 启用 RLS。
   - 创建同步码 create、pull、push、force push、revoke RPC。

2. `supabase/migrations/002_revision_limit_and_check.sql`
   - 将 revision 调整为允许 `0`。
   - 增加 `next_sync_revision()`。
   - 增加 `check_sync_space_revision()` 轻量检查 RPC。
   - 修改 push/force push 使用 revision 回绕逻辑。

3. `supabase/migrations/003_revision_limit_999.sql`
   - 将 revision 正式上限调整为 `999`。
   - 更新 `next_sync_revision()` 为 `999 -> 0`。
   - 更新 `sync_spaces_revision_range` 约束为 `0-999`。

4. `supabase/migrations/004_account_spaces.sql`
   - 创建账号资料表 `profiles`。
   - 创建账号全局偏好表 `account_preferences`。
   - 创建账号首页空间索引表 `home_spaces`。
   - 启用 RLS，并限制登录用户只能访问自己的账号数据。
   - 不保存 `accessToken`、`encryptionKey` 或完整同步码。

5. `supabase/migrations/005_account_space_activation.sql`
   - 新增 `activate_home_space(p_home_space_id uuid)` RPC。
   - 将默认首页空间激活收束到数据库事务中。
   - 同步更新 `home_spaces.is_default`、`home_spaces.last_used_at` 和 `account_preferences.default_space_id`。
   - 收紧 `account_preferences.default_space_id` 的 RLS 校验，禁止指向其他账号的首页空间。

6. `supabase/migrations/006_account_managed_sync_foundation.sql`
   - 为 `home_spaces` 增加 `access_mode`，默认现有空间为 `sync-code`。
   - 新增账号托管凭证表 `home_space_credentials`。
   - 通过 RLS 限制托管凭证只能由所属账号读取。
   - 新增 `create_account_managed_home_space(...)` RPC，供 Phase 1.6.1+ 创建账号托管空间。
   - 不改变当前前端行为，不隐藏同步码入口，不改变现有同步码 RPC。

7. `supabase/migrations/007_account_managed_credential_regex_fix.sql`
   - 修复 `home_space_credentials` 凭证校验中的 PostgreSQL 正则 `{32,512}` 运行时错误。
   - 将凭证校验改为长度检查加 Base64URL 字符集检查。
   - 重新创建 `create_account_managed_home_space(...)` RPC。
   - 不删除数据，不改变 RLS 规则，不改变同步码 RPC。

8. `supabase/migrations/008_sync_code_to_account_managed.sql`
   - 新增 `migrate_sync_code_home_space_to_account_managed(...)` RPC。
   - 支持把当前账号已认领的普通同步码空间原地迁移为账号托管。
   - 写入 `home_space_credentials`，但不修改 `sync_spaces` 密文，不废弃旧同步码。

9. `supabase/migrations/009_home_space_crud.sql`
   - 新增 `rename_home_space(...)`、`set_default_home_space(...)`、`remove_home_space_from_account(...)` RPC。
   - 支持账号首页空间重命名、设默认和从账号移除。
   - 移除账号托管空间时删除账号侧托管凭证，但不删除、不 revoke、不修改底层 `sync_spaces`。

10. `supabase/migrations/010_account_preferences_editing.sql`
    - 扩展 `account_preferences`，新增 `font_family`、`density`、`default_search_engine`。
    - 将 `locale`、`theme_preference` 和新增偏好字段收紧为固定枚举值。
    - 执行前先回填历史非法值为默认值，避免新增约束失败。
    - 不修改 RLS、grants、`default_space_id` 或首页空间逻辑。

11. `supabase/migrations/011_account_preferences_search_engine_yandex.sql`
    - 将账号默认搜索引擎候选从 Baidu 替换为 Yandex。
    - 回填已有 `baidu` 或非法值为 `duckduckgo`。
    - 更新 `account_preferences_default_search_engine_allowed` 约束。

12. `supabase/migrations/012_home_assets_storage.sql`
    - 固化 `home-assets` Supabase Storage bucket 配置；如果 Dashboard 已手动创建，会保持同名 bucket 并更新参数。
    - bucket 为 private，单文件限制 5MB，只允许 JPG、PNG、WebP 和 GIF。
    - 在 `storage.objects` 上创建 Banner/背景图 RLS policy，限制登录用户只能访问自己目录下的图片。

13. `supabase/migrations/013_cloud_home_snapshots.sql`
    - 新增账号托管空间云端历史表 `home_space_snapshots`，只保存有效用户首页的完整 `document_json`。
    - 新增账号托管空间审计表 `home_space_audit_events`。
    - 新增账号托管专用 v2 创建/迁移 RPC，以及普通上传/强制覆盖 RPC；普通同步码 RPC 保持兼容。
    - 每个账号托管首页空间最多保留最近 50 个云端快照。

14. `supabase/migrations/014_product_analytics_events.sql`
    - 新增隐私优先产品埋点表 `product_analytics_events`。
    - 新增受控上报 RPC `record_product_event(...)`，允许 `anon` 和 `authenticated` 调用。
    - 普通前端角色没有直接表级读写权限；事件名、匿名 ID、属性白名单、payload 大小和禁采字段均由 RPC/约束校验。
    - 新增 `delete_product_analytics_events_older_than(...)` 清理函数，不授予前端角色。

15. `supabase/migrations/015_client_error_events.sql`
    - 新增隐私优先前端错误监控表 `client_error_events`。
    - 新增受控上报 RPC `record_client_error_event(...)`，允许 `anon` 和 `authenticated` 调用。
    - 普通前端角色没有直接表级读写权限；事件类型、severity、fingerprint、匿名诊断 ID、属性白名单、payload 大小和禁采字段均由 RPC/约束校验。
    - 新增 `delete_client_error_events_older_than(...)` 清理函数，不授予前端角色。

16. `supabase/migrations/016_account_preferences_i18n_locale.sql`
    - 放宽 `account_preferences.locale` 约束，支持 `system` 和 Phase 1.15 v1 语言列表。
    - 仅修改 locale check constraint，不新增表，不改变 RLS、grants、默认首页空间或同步数据模型。
    - 执行前会将非法历史值回填为 `zh-CN`，默认值继续保持 `zh-CN`。

17. `supabase/migrations/017_public_home_shares.sql`
    - 新增 `public_home_shares`，为账号托管首页空间保存独立、可撤销的 `PublicHomeDocumentV1` 快照；不复用同步空间、账号托管凭证、云端历史或审计表。
    - 只保存 `SHA-256("mylinker-public-share-v1:" || token)` hash，不保存公开链接 token 原文；每个首页空间最多一条记录，撤销会替换旧 hash。
    - 启用 RLS 并撤销所有前端角色的直接表权限；只提供三个 authenticated owner RPC 与一个 anon/authenticated 公开 read RPC。
    - 分享管理 UI 与 `/share/` 静态路由代码已完成；执行后还必须继续执行 `018` 热修复，再运行 `020` 和 `019` 检查。

18. `supabase/migrations/018_public_home_share_upsert_conflict_fix.sql`
    - 修复 `upsert_public_home_share` 的 `ON CONFLICT (home_space_id)` 与 `RETURNS TABLE` 同名输出变量在首次发布时触发的 PostgreSQL `42702` 歧义。
    - 改用命名唯一约束 `public_home_shares_one_per_home_space` 作为冲突目标；只替换函数并恢复 authenticated execute grant，不改表结构、不删除或重写已有分享数据。
    - 执行后先运行 `supabase/checks/020_public_home_share_upsert_conflict_fix_verify.sql`，再运行 `019` Section 8 的 owner A/B rollback 检查。

19. `supabase/migrations/019_admin_readonly_foundation.sql`
    - 新增 `admin_users`，使用明确 Auth user UUID 保存 `owner`、`admin`、`support` 管理员身份和启用状态；migration 不插入任何真实管理员。
    - 新增追加式 `admin_audit_events`，固定 action/severity、访问理由、结果数量和低敏感 metadata 约束，不保存邮箱搜索词、URL、首页内容、快照正文或凭证。
    - 两张表均启用 RLS 且不创建普通用户 policy；`anon`、`authenticated`、`PUBLIC` 零 direct grant。
    - `service_role` 对 `admin_users` 只有 `SELECT`，对 `admin_audit_events` 只有 `SELECT, INSERT`，没有管理员生命周期或审计更新/删除权限。
    - 执行后运行 `supabase/checks/021_admin_readonly_foundation_verify.sql`；首个 owner 初始化、停用与安全回滚按 `AdminDashboardRunbook.md` 执行。

## 执行规则

- 新 Supabase project：按 `001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007 -> 008 -> 009 -> 010 -> 011 -> 012 -> 013 -> 014 -> 015 -> 016 -> 017 -> 018 -> 019` 顺序执行。
- 已执行到任意早期版本的项目：从下一编号依次补执行，不要跳过 `018`；进入 Phase 1.18 后再执行 `019`。
- 已经执行过 `016` 的项目：依次执行 `017`、`018`，随后运行 `020_public_home_share_upsert_conflict_fix_verify.sql` 和 `019_public_home_shares_verify.sql`。
- 已经执行过 `017` 且公开快照发布报错的项目：只需补执行 `018`；不需要重跑 `017`、删除分享表或清理已有快照。随后运行 `020`，再运行 `019` Section 8。
- 已经完成 Phase 1.17 且准备部署 Phase 1.18.1 的项目：只执行 `019_admin_readonly_foundation.sql`，随后完整执行 `021`；不要重跑公开分享 migration，也不要在 migration 中加入管理员 UUID。
- 已经手动创建 `home-assets` bucket 的项目：仍需执行 `012`，因为上传所需的 RLS policy 不会由 Dashboard 创建 bucket 自动生成。
- 执行前确认目标 project 是线上使用的 Supabase project。

## 本地自动重放与检查

Phase 1.18 准备阶段新增：

- `supabase/config.toml`：仅用于本地 Supabase；没有远端 project ref 或服务端密钥。
- `supabase/tests/database/000_existing_migrations_test.sql`：验证 `001-018` 重放后的关键表和公开分享 RPC。
- `supabase/tests/database/001_admin_readonly_foundation_test.sql`：验证 `019` 后管理员表结构、RLS/grant、约束、索引、触发器、service-role 最小权限与 transaction-scoped A/B/C。
- `supabase/functions/deno.json` 与 `supabase/functions/tests/000_preparation_test.ts`：验证 Deno Functions 测试运行时。
- `scripts/verify-supabase-preparation.mjs` 与 `.github/workflows/verify-supabase.yml`：统一执行本地 migration、lint、pgTAP 和 Deno 门禁。

本机已安装并验证 Supabase CLI、Colima/Docker 和 Deno 后，可在仓库根目录执行：

```bash
npm run verify:supabase-preparation
```

该命令固定执行本地 `supabase db start`、`supabase db reset`、`supabase db lint --level error`、`supabase test db` 和 Deno 检查。它不带 `--linked`、`--db-url`、`db push` 或 Functions deploy，不会连接生产数据库。首次执行会下载本地 Supabase 容器镜像；后续复用本机镜像。

2026-07-25 基线结果：

- PostgreSQL 17 本地数据库成功从空库重放 `001-018`。
- 数据库 lint 零错误。
- pgTAP：`1` 个文件、`10` 项断言全部通过。
- Deno：fmt、lint、type-check 和 `1` 项运行时测试全部通过。

Phase 1.18.1 增量结果记录在 `Phase1_18_Implement.md`；新环境线上执行仍须按 `AdminDashboardRunbook.md` 运行 `021`，本地通过不能替代生产数据库验证。

2026-08-09 Phase 1.18.1 本地结果：

- 当前本机 Supabase CLI `2.113.0` 从空 PostgreSQL 17 数据库重放 `001-019` 成功；本地和远程 GitHub Actions 也固定使用 `2.113.0`。
- 数据库 lint 零错误。
- pgTAP 共 `2` 个文件、`56` 项断言通过，其中 Phase 1.18.1 新增 `46` 项。
- `021` Section 1-8 完整执行通过；rollback 后 synthetic Auth、`admin_users` 和 `admin_audit_events` 行数均为 `0`。
- 没有执行远端 project link、生产 migration、管理员初始化或 Edge Function 部署。

仓库已新增 `npm run verify:supabase-remote-config`、`supabase/remote-deploy.json` 和 `.github/workflows/deploy-supabase.yml`。远程链路只允许 manifest 白名单 SQL，默认 dry-run，apply 必须通过 `supabase-production` Environment 审批并再次输入精确 project ref。它不会执行 `migration repair`、`--include-all`、远程 reset 或 Edge Function deploy；一次性 history 对齐和外部配置详见 `SupabaseRemoteDeployment.md`。Phase 1.18.6 仍负责 Edge Function、Admin Pages、Access 和完整上线回归。

2026-08-10 线上结果：001-019 schema 审计通过；CLI history 由空记录一次性对齐为 001-019；对齐后的 dry-run 显示 Local/Remote 完全一致且远端 up to date；verify 再次通过 `021` 结构、权限、负向约束与 rollback。没有执行 migration apply，也没有保留 synthetic A/B/C 数据。

## 迁移后手动结构检查

- 执行 `003` 后可以在 SQL Editor 中检查 revision 函数是否存在：

```sql
select public.next_sync_revision(998) as rev_999;
select public.next_sync_revision(999) as rev_0;
```

预期结果：

- `rev_999 = 999`
- `rev_0 = 0`

执行 `004` 后可以检查账号表、RLS 和 policy 是否存在：

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'account_preferences', 'home_spaces')
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'account_preferences', 'home_spaces')
order by tablename, policyname;

select
  column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'home_spaces'
  and column_name in ('access_token', 'encryption_key', 'sync_code');
```

预期结果：

- `profiles`、`account_preferences`、`home_spaces` 的 `rowsecurity` 均为 `true`。
- 三张表均存在 `select/insert/update` 的 own-data policy；`home_spaces` 额外存在 `delete` policy。
- 最后一条查询返回 0 行，表示账号首页空间索引没有保存同步码 secret 字段。

## 注意事项

- 前端代码部署不等于数据库迁移已执行。
- 如果前端调用了数据库中不存在的 RPC，会出现同步失败。
- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是公开前端配置，不是服务端密钥。
- 不要把 Supabase service role key 写入前端代码、GitHub Pages 环境变量或公开仓库。
- `004_account_spaces.sql` 只建立账号空间索引，不会改变现有同步码 RPC 行为。
- `005_account_space_activation.sql` 只收口默认空间激活和 RLS 校验，不引入账号托管凭证，不改变同步码密文同步模型。
- `006_account_managed_sync_foundation.sql` 会保存账号托管凭证字段，但只在 `home_space_credentials` 表中保存，并通过 RLS 限制为本人可读；本阶段前端还不会使用这些凭证。
- `007_account_managed_credential_regex_fix.sql` 是 Phase 1.6.1 热修复；如果创建账号托管空间时报 `invalid regular expression: invalid repetition count(s)`，说明线上数据库需要执行该脚本。
- Phase 1.6.2 空白设备账号恢复不新增迁移；它复用 `home_space_credentials` 的本人可读 RLS。上线前可重新执行 `007_account_managed_sync_verify.sql` 和 `008_account_managed_credential_regex_fix_verify.sql` 确认凭证表权限与正则修复仍满足要求。
- `008_sync_code_to_account_managed.sql` 不会废弃旧同步码。迁移后旧同步码仍可继续使用，这是 Phase 1.6.3 的保守设计。
- `009_home_space_crud.sql` 只管理账号侧空间索引。`remove_home_space_from_account(...)` 会删除账号托管凭证，但不会删除或废弃底层 `sync_spaces`。
- Phase 1.6.4a 不新增迁移；如果需要复核删除策略，执行 `supabase/checks/011_home_space_removal_policy_verify.sql`。
- `010_account_preferences_editing.sql` 是 Phase 1.6.6 偏好编辑迁移。建议先执行该脚本，再部署前端；如果前端先部署，账号偏好读取会降级到旧字段，但保存新偏好会提示需要先执行 `010`。
- `011_account_preferences_search_engine_yandex.sql` 是默认搜索引擎候选热修。执行后 Baidu 不再是合法账号偏好值，历史 Baidu 会回落为 DuckDuckGo。
- `012_home_assets_storage.sql` 是 Phase 1.8.1 Banner/背景图片上传所需迁移。前端可以保存外链图片，但登录用户上传 Storage 图片前必须执行该脚本。
- `012_home_assets_storage.sql` 只允许用户访问 `{auth.uid()}/banner/...` 和 `{auth.uid()}/background/...` 路径下的图片；不要把通用文件缓存、公开分享或端到端加密文件复用到这个 bucket policy 中。
- `013_cloud_home_snapshots.sql` 是 Phase 1.11.5 账号托管云端历史版本所需迁移。执行前端代码但未执行该脚本时，账号托管上传和数据恢复中心云端历史读取会失败。
- `013_cloud_home_snapshots.sql` 只为 `account-managed` 空间保存明文 `document_json` 云端历史；普通 `sync-code` 空间继续使用既有密文同步模型，不保存可预览明文历史。
- Phase 1.11.6 不新增 migration。账号托管空间的 v1 定位是账号可信托管、可恢复、可审计；当前仍通过本人 RLS 读取 `home_space_credentials` 完成空白设备恢复，不代表前端完全不接触 managed secret。可执行 `supabase/checks/015_account_managed_recovery_model_verify.sql` 复核当前权限边界。
- `014_product_analytics_events.sql` 是 Phase 1.11.8 基础埋点所需迁移。未执行时，前端埋点会上报失败并静默降级，不影响首页、导入、同步或恢复主流程。
- `014_product_analytics_events.sql` 不保存邮箱、用户 ID、URL、搜索词、首页内容、同步码、账号托管 secret 或云端历史 `document_json`；普通客户端只能调用 `record_product_event(...)`，不能直接查询埋点表。
- `015_client_error_events.sql` 是 Phase 1.11.9 错误监控所需迁移。未执行时，前端错误监控会上报失败并静默降级，不影响首页、导入、同步或恢复主流程。
- `015_client_error_events.sql` 不保存邮箱、用户 ID、URL、搜索词、首页内容、同步码、账号托管 secret 或云端历史 `document_json`；普通客户端只能调用 `record_client_error_event(...)`，不能直接查询错误监控表。
- `017_public_home_shares.sql` 依赖既有 `001`（`pgcrypto`）与 `006`（`home_spaces(id, user_id)` 复合唯一约束）迁移；必须在已完成 `001`-`016` 的数据库中执行。它只允许 `account-managed` 首页空间发布，普通同步码空间不会获得公开读取旁路。`018` 必须紧随其后，用命名约束消除发布函数的 PL/pgSQL 输出变量歧义。
- 分享管理 UI 与公开 `/share/` 路由代码已经完成，当前目标线上项目也已执行 `017`、`018` 并通过 `020`、`019` 和真实账号验收。新环境仍须按顺序执行 migration，再运行 `019_public_home_shares_verify.sql` 的只读段和两个测试账号的 rollback A/B 段。完整流程见 `PublicHomeShareDatabaseRunbook.md`。
- `017` 的安全回滚不删除表或用户快照：先 revoke `read_public_home_share` 对 `anon`/`authenticated` 的 execute，再 revoke 三个 owner RPC 的 execute。这样可立即关闭公开读取和管理入口，同时保留数据以便排查或受控恢复。
- 新设备登录后看到账号空间列表，不代表已经拥有该空间的同步凭证；只有 `account-managed` 空间可以通过账号托管凭证直接恢复，普通 `sync-code` 空间仍需输入完整同步码。

## 辅助检查脚本

- `supabase/checks/004_account_spaces_verify.sql`：验证 `004_account_spaces.sql` 是否已执行到位，包括账号表、RLS、policy、敏感字段缺失、约束和角色权限。
- `supabase/checks/004_account_spaces_repair_grants.sql`：当 `authenticated` 被授予 `TRUNCATE`、`TRIGGER`、`REFERENCES` 等过宽权限时，用于收敛账号表权限。
- `supabase/checks/005_home_space_claim_verify.sql`：验证 Phase 1.5.4 登录账号与同步空间的认领关系；只使用同步码中的 `sync_space_id`，不要把完整同步码粘贴到 SQL Editor。
- `supabase/checks/006_account_security_verify.sql`：验证 Phase 1.5.6 安全收口，包括账号表隔离、`sync_spaces` 直接表权限、`activate_home_space` RPC 权限、默认空间一致性和 A/B 用户 RLS 模拟。
- `supabase/checks/007_account_managed_sync_verify.sql`：验证 Phase 1.6.0 账号托管同步基础，包括 `access_mode`、`home_space_credentials`、RLS、角色权限、RPC 权限和现有同步码 RPC 回归。
- `supabase/checks/008_account_managed_credential_regex_fix_verify.sql`：验证 Phase 1.6.1 账号托管凭证正则热修复，确认约束和 RPC 中不再包含 `{32,512}`。
- `supabase/checks/009_sync_code_to_account_managed_verify.sql`：验证 Phase 1.6.3 同步码迁移 RPC、权限、凭证一致性和可选 A/B 功能回归。
- `supabase/checks/010_home_space_crud_verify.sql`：验证 Phase 1.6.4 首页空间 CRUD RPC、权限、默认空间一致性、凭证约束和可选 A/B 回滚测试。
- `supabase/checks/011_home_space_removal_policy_verify.sql`：验证 Phase 1.6.4a 删除策略，确认从账号移除不会删除、废弃或改写底层 `sync_spaces`。
- `supabase/checks/012_account_preferences_editing_verify.sql`：验证 Phase 1.6.6 偏好编辑字段、默认值、约束、RLS、权限和默认空间 FK/RLS 边界。
- `supabase/checks/013_home_assets_storage_verify.sql`：验证 Phase 1.8.1 `home-assets` bucket 参数、Storage object policies 和 RLS 状态。
- `supabase/checks/014_cloud_home_snapshots_verify.sql`：验证 Phase 1.11.5 云端历史表、审计表、RLS、权限、账号托管 RPC、旧同步码 RPC 兼容和快照约束。
- `supabase/checks/015_account_managed_recovery_model_verify.sql`：验证 Phase 1.11.6 账号托管可恢复模型的当前 v1 权限边界，包括 `home_space_credentials`、云端历史表、审计表的 RLS、anon/PUBLIC 权限、账号托管 RPC 权限和旧同步码 RPC 兼容。
- `supabase/checks/016_product_analytics_events_verify.sql`：验证 Phase 1.11.8 基础埋点表、RLS、前端表权限、受控 RPC、敏感字段缺失和属性白名单/禁采字段约束。
- `supabase/checks/017_client_error_events_verify.sql`：验证 Phase 1.11.9 错误监控表、RLS、前端表权限、受控 RPC、敏感字段缺失和属性白名单/禁采字段约束。
- `supabase/checks/018_account_preferences_i18n_locale_verify.sql`：验证 Phase 1.15.0 多语言 locale 偏好约束、旧数据兼容、RLS、权限和 policy 边界。
- `supabase/checks/019_public_home_shares_verify.sql`：验证 Phase 1.17.3 分享表、复合 owner FK、RLS、零 direct table grant、RPC grant 矩阵、fixed search path、公开 schema validator，以及可选的 rollback A/B token/撤销/越权回归。
- `supabase/checks/020_public_home_share_upsert_conflict_fix_verify.sql`：验证 Phase 1.17 发布 RPC 热修复使用无歧义的命名唯一约束，并保持 security-definer/search-path 和 authenticated-only grant。
- `supabase/checks/021_admin_readonly_foundation_verify.sql`：验证 Phase 1.18.1 管理员身份与审计表、RLS、零前端权限、service-role 最小 grant、约束、索引、updated-at trigger，以及自动 rollback 的 A=owner、B=support、C=普通账号测试。
