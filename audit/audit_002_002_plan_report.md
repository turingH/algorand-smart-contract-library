# 审计报告：升级后角色持续影响

## 执行摘要

依据 `audit/audit_002_002_plan.md` 的步骤，我们审查了 `AccessControl` 与 `Upgradeable` 在升级流程中的角色数据处理方式。代码显示角色映射 `roles` 与 `addresses_roles` 使用固定 `BoxMap` 前缀，并未在 `complete_contract_upgrade` 中被清理或迁移。结合 `pk.md` 断言 24 与 31，可确认旧角色在升级后仍然存在[#24-1][#31-1]。测试尝试因缺少 `jest` 依赖而无法执行，故未能在本地复现升级场景，但代码逻辑足以推导出角色持续存在。

## 详细审计过程

### 1. 代码审查
- `AccessControl` 在 `__init__` 中创建 `roles` 与 `addresses_roles`，分别带有前缀 `b"role_"` 与 `b"address_roles_"`【F:contracts/library/AccessControl.py†L50-L56】。这些数据结构在合约生命周期内持续存在。
- `Upgradeable.complete_contract_upgrade` 仅删除 `scheduled_contract_upgrade`、递增 `version` 并重置 `is_initialised`，未操作任何角色相关 BoxMap【F:contracts/library/Upgradeable.py†L166-L171】。因此升级不会自动清理旧角色。

### 2. PoC 编写
- 计划部署旧版合约授予测试账户角色，然后升级至修改权限判断的新版本，验证旧角色是否仍能调用敏感方法。
- 在当前环境执行 `npm run test` 报错 `jest: not found`【0685b1†L1-L5】，故无法运行现有测试或构建新的 PoC。应在安装依赖和启动本地节点后重试。

### 3. 文档检查
- `README.md` 仅介绍安装、编译与测试流程，没有提到升级后需要撤销或迁移旧角色【F:README.md†L1-L60】。
- 访问 DeepWiki 链接得到 403 Forbidden【95fe3e†L1-L9】，无法确认是否有额外指引。

## 结论

- **确认结果**：合约升级不会触及 `roles` 与 `addresses_roles` BoxMap，旧角色持续存在，符合 `pk.md` 断言 24、31 的描述。
- **潜在风险**：若新版本改变角色权限含义，旧角色持有者可能仍能调用敏感方法，导致权限不一致。
- **治理建议**：在升级脚本或文档中提供角色迁移或撤销示例，提醒开发者在升级后清理或重新赋权，防止旧角色滥用。

