# 审计报告：`default_admin_role` 冲突与权限滥用风险

## 执行摘要

依据 `audit/audit_001_029_plan.md` 的步骤，我们审查了 `AccessControl` 模块对全零角色的处理方式，并尝试以脚本模拟授予该角色的场景。代码显示 `default_admin_role` 是唯一的全零角色，其授予与撤销均要求调用者已经持有该角色，因此不会因为角色 ID 与自定义角色冲突而被滥用。测试脚本亦验证无权账户无法赋予自己全零角色。仓库文档未提醒该值被保留，但结合哈希碰撞概率极低，实际风险可忽略。

## 详细审计过程

### 1. 代码审查
- `default_admin_role` 返回 16 字节全零常量【F:contracts/library/AccessControl.py†L95-L102】。
- `get_role_admin` 在角色不存在时返回 `default_admin_role`【F:contracts/library/AccessControl.py†L120-L130】。
- `_grant_role` 在首次出现的新角色时同样将其管理员设为 `default_admin_role`【F:contracts/library/AccessControl.py†L156-L167】。
- `_revoke_role` 仅在账户已有角色时删除记录，不区分角色值【F:contracts/library/AccessControl.py†L172-L180】。
- **微断言**：所有角色 ID（包括全零）均经过相同的管理员校验流程，除非持有 `default_admin_role`，否则无法授予或撤销该角色。

### 2. 测试设计与执行
- 新建脚本 `poc/access_control_zero_role_poc.py`，模拟调用者在未持有默认管理员时尝试赋予自己全零角色，结果抛出 `Access control unauthorised account`；赋予管理员权限后再执行则成功，并显示账户获得该角色【442a24†L1-L4】。
- 容器缺乏 `jest`，运行 `npm run test` 报告 `jest: not found`，无法执行完整测试套件【797641†L1-L5】。
- **微断言**：脚本证明全零角色并无特殊后门，只有现有管理员才能继续扩散该权限。

### 3. 理论分析
- 若开发者硬编码 `0x00..00` 作为自定义角色，将与 `default_admin_role` 完全重合，其授予仍需默认管理员权限，不会无意中提升普通账户。
- 以 `keccak256` 截断 16 字节碰撞全零的概率为 `2^{-128}`，与前述角色碰撞分析一致，几乎不可能发生【F:audit/audit_001_014_plan_report.md†L4-L20】。
- **微断言**：即便出现极端碰撞，也只会让冲突角色成为默认管理员，而非绕过权限检查。

### 4. 文档检查
- `README.md` 主要介绍安装、编译与测试流程，未对角色 ID 的选择或全零值的保留做任何说明【F:README.md†L1-L60】。
- 访问 DeepWiki 链接因网络限制被拒绝【8f40c8†L1-L11】。
- **微断言**：缺乏文档可能让开发者误将 `0x00..00` 用作普通角色，虽不会造成漏洞，但可能引起混淆。

## 结论

- **未发现漏洞**：`AccessControl` 中全零角色即 `default_admin_role`，其授予与管理均受同名角色控制，无权者无法利用角色 ID 冲突提升权限。
- **文档可改进**：建议在 README 或 DeepWiki 明确指出 `0x00..00` 已被保留为默认管理员角色，避免开发者误用。
- 综合来看，角色 ID 冲突并不会导致权限滥用，但完善文档能降低潜在的配置错误。
