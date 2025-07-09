# 审计报告：升级后的角色持久化影响

## 执行摘要

依据 `audit/audit_001_020_plan.md` 的指引，我们审查了 `Upgradeable` 与 `AccessControl` 交互时对角色数据的处理方式，并关注升级完成后旧角色是否会造成权限混乱。代码显示 `complete_contract_upgrade` 在成功执行后仅删除升级计划、增加 `version` 并将 `is_initialised` 置为 `False`，并未触及角色映射【F:contracts/library/Upgradeable.py†L166-L170】。角色信息存储于 `AccessControl` 定义的 `BoxMap` 中【F:contracts/library/AccessControl.py†L50-L56】，因此在升级过程中会被完整保留。

从逻辑上推导，若新版本调整了角色用途或取消某些角色，旧版授予的权限仍会存在，除非在升级后的 `initialise` 流程中显式清理或迁移这些角色。现有测试仅覆盖升级本身的状态变更【F:tests/library/Upgradeable.test.ts†L414-L458】，未验证升级后角色依旧有效的情况。README 中亦未搜索到关于升级后重新配置角色的提醒【F:README.md†L1-L60】。

## 详细审计过程

### 1. 代码审查
- `AccessControl.__init__` 将角色及其关联账户存储在两个 `BoxMap` 中，生命周期独立于升级流程【F:contracts/library/AccessControl.py†L50-L56】。
- `Upgradeable.complete_contract_upgrade` 完成升级时，只是清除 `scheduled_contract_upgrade`、递增 `version` 并重置 `is_initialised`【F:contracts/library/Upgradeable.py†L166-L170】。
- **微断言**：升级不影响 `roles` 或 `addresses_roles` 这两个映射，旧角色值在链上依旧存在。

### 2. 测试设计
- 拟新增测试：部署 `SimpleUpgradeable` 并授予测试账户 `UPGRADEABLE_ADMIN_ROLE`。
- 模拟升级到修改了 `upgradable_admin_role` 逻辑的新合约版本，升级后无需重新初始化即可调用受限接口，验证旧角色是否仍具备权限。
- 预期：如无清理逻辑，旧账户应能继续执行 `schedule_contract_upgrade` 等方法，证明角色持久化。

### 3. 文档检查
- 在仓库 `README.md` 中未找到关于升级后需要重新配置或迁移角色的说明【F:README.md†L1-L60】。
- 由于环境限制，无法查阅 DeepWiki 以确认是否有相关指导。
- **微断言**：缺乏文档提醒可能导致开发者忽略升级后的角色管理，产生权限滥用风险。

## 结论

- **角色确实持久化**：升级流程不会修改 `AccessControl` 存储的角色数据，旧角色在新版本中依旧有效。
- **潜在管理风险**：若新版本改变角色架构或不再需要某些角色，必须在 `initialise` 或额外脚本中显式迁移或撤销，否则旧角色可能拥有不合时宜的权限。
- **改进建议**：在文档中加入升级后处理角色的最佳实践，并在测试中覆盖角色持久化场景，以减少配置失误的可能。

综上，本次审计未发现直接的代码漏洞，但指出了升级后角色持续生效可能造成的权限管理隐患，需依赖开发流程或文档加以约束。
