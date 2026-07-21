# 公开快照分享数据库上线流程

## 目标与当前状态

Phase 1.17 的分享管理 UI、`/share/` 静态入口、公开投影、repository 和自动校验已在仓库完成。2026-07-21 对当前 Supabase 项目的匿名 `read_public_home_share` RPC 探测返回 HTTP 200，确认 `017_public_home_shares.sql` 已存在于目标数据库；真实发布失败定位为原 `upsert_public_home_share` 中 `ON CONFLICT (home_space_id)` 与 `RETURNS TABLE` 同名输出变量的 PostgreSQL `42702` 歧义。目标数据库需执行 `018_public_home_share_upsert_conflict_fix.sql` 并通过 `020_public_home_share_upsert_conflict_fix_verify.sql`，随后再做 `019` Section 8 的事务内 A/B 回归。

本流程只新增独立的公开快照表、校验函数和四个最小授权 RPC，不修改普通同步码密文，不读取或改写 `home_space_credentials`、`home_space_snapshots`、账号审计或本地首页。数据库只保存分享 token 的 SHA-256 hash，不保存原 token 或完整公开链接。

## 一、上线前确认

1. 在 Supabase Dashboard 顶部确认当前 project 是目标环境，记录 project ref 和执行人。
2. 确认 `001` 至 `017` migration 已完成；`017` 依赖：
   - `001` 提供 `pgcrypto` / `extensions.digest`。
   - `006` 提供 `home_spaces(id, user_id)` owner 复合约束和 `account-managed` 模式。
3. 确认至少准备两个非生产数据测试账号：owner A 和非 owner B；owner A/B 各有一个账号托管空间。
4. 不要在 SQL Editor、工单、日志或聊天中粘贴真实分享链接或真实 token。A/B 检查使用新生成的 43 字符测试 token。
5. 记录回滚窗口。`018` 使用 `begin` / `commit`，只原位替换发布函数并恢复最小 grant；执行失败会整体回滚，不修改表结构或已有分享数据。

## 二、执行 migration

1. 打开 Supabase Dashboard → SQL Editor → New query。
2. 当前项目已执行过 `017`：完整复制并执行 `supabase/migrations/018_public_home_share_upsert_conflict_fix.sql`，不要删除或重建分享表。新建空项目仍按顺序执行 `017`、`018`。
3. 确认没有 error，并记录执行时间。
4. 不要手工给 `public_home_shares` 添加 RLS policy，也不要给 `anon` 或 `authenticated` 表级权限。浏览器访问必须全部经过 RPC。

执行后应存在：

- `public.public_home_shares`，RLS 开启、每个 `home_space_id` 唯一。
- `public_home_document_v1_valid(jsonb)` 等 schema helper。
- `upsert_public_home_share`、`get_public_home_share_metadata`、`revoke_public_home_share` 三个 owner RPC。
- `read_public_home_share` 公开只读 RPC。
- owner RPC 仅授权 `authenticated`；公开 read 仅授权 `anon`、`authenticated`。
- `upsert_public_home_share` 的冲突目标为 `ON CONFLICT ON CONSTRAINT public_home_shares_one_per_home_space`，不再触发 `42702`。

## 三、运行结构与权限检查

1. 新建 SQL Editor query，完整复制并执行 `supabase/checks/020_public_home_share_upsert_conflict_fix_verify.sql`。
2. 确认 `conflict_target_is_unambiguous = true`、函数仍为 `security definer` 且只有 `authenticated` 拥有 owner RPC execute 权限。
3. 再完整执行 `supabase/checks/019_public_home_shares_verify.sql`。Section 1-7 为只读检查，Section 8 默认被块注释包围，不会写入测试数据。
4. 核对结果：
   - `public_home_shares` 恰好一行表记录且 `rowsecurity = true`。
   - 前端角色 direct table grant 返回 0 行。
   - 表上 RLS policy 返回 0 行，因为访问为 RPC-only。
   - 四个 RPC 都是 `security definer` 且固定 `search_path`。
   - grant 矩阵只包含规划中的五条前端 execute grant。
   - 所有 invalid count 都是 0。
   - `read_public_home_share` 只返回 `payload_version` 和 `document_json`，并过滤 hash、状态、过期、空间模式与 schema。

任何一项不符合时停止前端上线，先执行“六、安全回滚”。

## 四、运行事务内 A/B 检查

1. 复制 `019` 的 Section 8 到单独 query。
2. 去掉最外层块注释，替换：
   - `USER_A_UUID`
   - `USER_B_UUID`
   - `HOME_SPACE_A_UUID`
   - `HOME_SPACE_B_UUID`
3. 保持 `begin;` 和末尾 `rollback;`，不要改为 `commit`。
4. 使用测试 token，不要使用真实用户的分享 token。
5. 预期：
   - owner A 发布成功，metadata count 为 1。
   - owner B 读取 A 的 metadata count 为 0，更新和撤销均被拒绝。
   - anon 直接读取分享表被拒绝。
   - active token read count 为 1；随机 token 为 0。
   - 撤销后原 token read count 为 0。
   - `rollback` 后不留下测试分享记录。

过期校验按 `019` 文件末尾说明，在单独 rollback transaction 中临时设置 `expires_at` 后验证 read 返回 0；不要修改生产分享记录。

## 五、前端 smoke test

数据库检查通过后再部署或启用本次前端：

1. owner A 登录，激活账号托管空间，进入设置 → 首页空间 → 公开快照分享。
2. 核对预览仅包含标题、主题、分组和网站；不得出现组件、Banner、背景图片、账号或同步信息。
3. 本地验证时，`localhost`、`127.0.0.1` 或 `::1` 会生成同源 `/share/#<token>`；在无登录窗口打开并确认快照可读。正式部署后再验证 `https://mylinker.net/share/#<token>`。若正式地址返回服务器 404，说明包含 `/share/` 的静态构建尚未部署，而不是 token 或数据库快照失效。
4. 修改本机首页但不重新发布，公开页应仍显示旧快照。
5. 更新快照后生成新链接，旧链接应立即不可用，新链接显示新快照。
6. 刷新设置页，旧链接不可恢复；界面应提供“重新发布并生成新链接”。
7. 撤销分享，当前链接立即显示统一的“此分享不可用”；随机、撤销、过期和不存在 token 的文案必须相同。
8. 用普通同步码空间和未登录状态检查入口原因说明，不能出现可发布按钮。
9. 检查 Network、console、analytics、error monitoring 和本地审计：不得出现 token、完整分享 URL、首页标题、网站 URL 或 snapshot JSON。

## 六、安全回滚

若权限、泄露或公开读取出现异常，先在 SQL Editor 执行：

```sql
revoke execute on function public.read_public_home_share(text) from anon, authenticated;
revoke execute on function public.upsert_public_home_share(uuid, text, jsonb) from authenticated;
revoke execute on function public.get_public_home_share_metadata(uuid) from authenticated;
revoke execute on function public.revoke_public_home_share(uuid) from authenticated;
```

该操作会立即关闭公开读取和 owner 管理 RPC，但保留分享表、hash 与快照用于排查。不要 drop 表、不要删除首页空间，也不要修改 `sync_spaces` 或账号托管凭证。

问题修复并重新运行 `020` 与 `019` 后，可按 migration 末尾的四条 `grant execute` 恢复。恢复前先确认主站已回滚或修复，避免前端再次触发错误路径。

## 七、上线记录

建议记录：

- Supabase project ref / 环境：
- `017` 执行时间与执行人：
- `018` 执行时间与执行人：
- `020` 检查结果：
- `019` Section 1-7 结果：
- A/B rollback 检查账号与空间 ID（不要记录 token）：
- 前端部署版本：
- Cloudflare `/share/` smoke test：
- GitHub Pages legacy `/share/` smoke test：
- 回滚窗口与结论：
