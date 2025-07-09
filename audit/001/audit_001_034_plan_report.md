# 审计报告：升级后 upgradable_admin_role 常量变更风险

## 执行摘要

根据 `audit/audit_001_034_plan.md` 的指引，我们评估了在升级过程中更改 `upgradable_admin_role` 常量可能导致的权限丢失问题。代码显示该常量由 `Upgradeable.upgradable_admin_role()` 使用固定字符串计算而来【F:contracts/library/Upgradeable.py†L173-L181】，且库中不存在覆盖或配置途径【b16808†L1-L5】。如果升级后的版本改动此字符串，旧角色将失效，而如果没有账户持有 `default_admin_role`，合约将无法再次授予新角色或完成后续升级。

我们尝试构建测试环境以验证此场景，但 `npm run pre-build` 与 `npm test` 均因缺乏 `algokit` 与 `jest` 等依赖而失败【0c8c25†L1-L23】【224b07†L1-L8】。文档中也未提醒开发者保持常量一致或预留默认管理员【F:README.md†L1-L63】。访问 DeepWiki 时被 403 拒绝，无法确认是否提供额外指引【f13c29†L1-L10】。

综合评估，该问题属于潜在治理风险：若在升级时修改常量且没有默认管理员，合约可能永久丧失升级能力。建议在文档中明确警告，或在升级前确保至少一名账户持有 `default_admin_role` 以便重新分配角色。

## 详细审计过程

### 1. 代码审查
- `upgradable_admin_role` 通过 `keccak256(b"UPGRADEABLE_ADMIN")` 取前 16 字节生成，不依赖存储或外部参数【F:contracts/library/Upgradeable.py†L173-L181】。
- 全库搜索仅在此处出现该字符串，未发现可覆盖或配置的接口【b16808†L1-L5】。
- **微断言**：若新版本更换哈希字符串，旧角色在升级后即失效，因为角色标识完全不同。

### 2. 测试设计与执行
- 计划编写 `UpgradeableV2` 将常量更改为 `"UPGRADEABLE_ADMIN_V2"`，部署初版后授予升级管理员，再升级到新版本并移除所有 `default_admin_role` 持有者。
- 期望升级完成后无法再调用受 `UPGRADEABLE_ADMIN_ROLE` 保护的接口，也无法授予新角色。
- 实际运行 `npm run pre-build` 与 `npm test` 时分别报错 `algokit: not found` 与 `jest: not found`，导致测试无法执行【0c8c25†L1-L23】【224b07†L1-L8】。
- **微断言**：当前环境缺失依赖，自动化验证未完成，但逻辑上更换常量会立即使旧角色失效。

### 3. 文档检查
- `README.md` 仅介绍安装、编译及测试流程，没有关于角色常量或升级权限迁移的说明【F:README.md†L1-L63】。
- 访问 DeepWiki 链接被 403 拒绝，未能确认是否有相关指导【f13c29†L1-L10】。
- **微断言**：官方文档缺乏对 `upgradable_admin_role` 常量不可更改的提醒，开发者在升级时可能忽略这一点。

## 结论

- **潜在治理风险**：`upgradable_admin_role` 常量一旦变更，旧版本授予的角色将全部失效；如果没有账户保留 `default_admin_role`，合约将无法再授予新角色或继续升级。
- **改进建议**：
  1. 在 README 或 DeepWiki 中明确警告开发者不要随意更改 `upgradable_admin_role` 的计算方式。
  2. 在升级前确保至少一名可信账户持有 `default_admin_role`，以便在必要时重新分配新角色。
  3. 补充自动化测试，用 `UpgradeableV2` 验证升级后的权限迁移流程，确保文档提供示例脚本。

综上，更改 `upgradable_admin_role` 常量不会破坏合约逻辑，但可能导致权限无法过渡，进而失去升级能力，应通过文档与流程管理加以避免。

