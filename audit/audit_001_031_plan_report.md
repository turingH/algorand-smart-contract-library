# 审计报告：默认管理员放弃后的合约锁定风险

## 执行摘要

根据 `audit/audit_001_031_plan.md` 的指引，我们审查了 `AccessControl` 模块在放弃默认管理员角色后的行为。代码显示 `renounce_role` 与 `_revoke_role` 均未检查剩余管理员数量，`default_admin_role` 也只是全零常量且为自身管理员。因此，当所有持有者执行 `renounce_role(default_admin_role)` 后，合约将无法再授予任何角色。自编脚本验证单一管理员放弃权限后再尝试授予角色会抛出 "Access control unauthorised account"。仓库 README 及 DeepWiki 均未提示需保留至少一名管理员，故该情形可能被忽视。

## 详细审计过程

### 1. 代码审查
- `renounce_role` 直接调用 `_revoke_role`，未检查是否剩余管理员【F:contracts/library/AccessControl.py†L87-L94】。
- `_revoke_role` 在删除记录后立刻返回，无任何管理员数量判断【F:contracts/library/AccessControl.py†L172-L180】。
- 合约文档指出 `{default_admin_role}` 既是所有角色的默认管理员又能管理自身【F:contracts/library/AccessControl.py†L40-L48】。
- **微断言**：若合约仅有一名默认管理员，其放弃权限后 `roles` 映射仍指向 `default_admin_role`，但 `addresses_roles` 中无对应账户 → 无法再通过 `grant_role` 或 `_set_role_admin` 修改状态。

### 2. 理论或脚本验证
- 新建脚本 `poc/access_control_admin_lock_poc.py`，复现简化的 `AccessControl` 逻辑并让唯一管理员调用 `renounce_role(default_admin_role)`【F:poc/access_control_admin_lock_poc.py†L1-L48】。
- 运行结果显示管理员先拥有角色，再放弃后 `has_role` 返回 `False`，随后尝试重新授予时抛出 `Access control unauthorised account`【e5dec0†L1-L4】。
- **微断言**：在无其他管理员的情况下调用 `renounce_role` 会导致权限永久丢失。

### 3. 文档检查
- README 仅介绍安装、编译与测试流程，未提及保留管理员的注意事项【F:README.md†L1-L60】。
- 访问 DeepWiki 链接被 403 拒绝，无法获取官方进一步指引【d20401†L1-L12】。
- **微断言**：官方文档缺乏相关警告，开发者可能误将所有管理员移除。

## 结论

- **确认的治理风险**：库允许最后一名 `default_admin_role` 持有者放弃权限，导致合约进入无法管理的状态。
- **改进建议**：在 README 或 DeepWiki 中明确要求至少保留一个默认管理员，并考虑在 `renounce_role` 或 `_revoke_role` 中新增检查或紧急恢复机制。

综上，当前实现符合一般的 `AccessControl` 设计，但缺乏对“最后管理员放弃”场景的防护，应在文档或库层提供相应提示或限制，以避免合约被意外锁定。
