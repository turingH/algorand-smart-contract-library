# 审计报告：创建者限定初始化检查

## 执行摘要

根据 `audit/audit_001_019_plan.md` 的步骤，我们对 `InitialisableWithCreator` 扩展及其在升级流程中的表现进行了代码审查与测试审阅。该扩展在 `initialise` 中断言 `Txn.sender` 等于 `Global.creator_address`【F:contracts/library/extensions/InitialisableWithCreator.py†L25-L26】。搜索库内所有继承此扩展的合约，均调用 `super().initialise()`【F:contracts/library/test/SimpleUpgradeable.py†L11-L16】【F:contracts/library/test/MockInitialisableWithCreator.py†L9-L13】，因此断言不会被覆盖。

Algorand 应用的 `Global.creator_address` 在升级后保持不变，且 `Upgradeable.complete_contract_upgrade` 重置 `is_initialised` 为 `False`【F:contracts/library/Upgradeable.py†L124-L168】，需要再次调用 `initialise`。示例合约 `SimpleUpgradeable` 继承 `InitialisableWithCreator`，因此升级后仅创建者能重新初始化。测试用例验证升级完成时 `is_initialised` 已被清除【F:tests/library/Upgradeable.test.ts†L434-L458】，但未覆盖升级后再次初始化的场景。

文档层面，README 未提及 `InitialisableWithCreator` 或升级后需由创建者重新初始化的注意事项。DeepWiki 链接在本环境无法访问，故未能确认其描述。总体而言，代码实现满足预期，但测试与文档仍可加强。

## 详细审计过程

### 1. 代码审查
- `InitialisableWithCreator.initialise` 首先检查调用者是否为合约创建者，然后调用父类实现【F:contracts/library/extensions/InitialisableWithCreator.py†L15-L26】。
- `SimpleUpgradeable.initialise` 在执行自身逻辑前调用 `InitialisableWithCreator.initialise`【F:contracts/library/test/SimpleUpgradeable.py†L11-L16】。
- `MockInitialisableWithCreator.initialise` 同样调用 `super().initialise()`【F:contracts/library/test/MockInitialisableWithCreator.py†L9-L13】。
- `Upgradeable.complete_contract_upgrade` 成功后删除 `scheduled_contract_upgrade`、增加版本号并将 `is_initialised` 设为 `False`【F:contracts/library/Upgradeable.py†L144-L168】。

**微断言**：只要子合约继承 `InitialisableWithCreator` 且调用 `super().initialise()`，升级后未初始化的合约只能由创建者再次初始化。

### 2. 测试审阅
- `InitialisableWithCreator.test.ts` 包含非创建者调用失败及创建者成功初始化的测试【F:tests/library/extensions/InitialisableWithCreator.test.ts†L42-L52】。
- `Upgradeable.test.ts` 验证完成升级后 `isInitialised` 为 `False`【F:tests/library/Upgradeable.test.ts†L434-L458】，但缺少升级后重新初始化的测试。

**微断言**：若补充测试在升级后由非创建者重新初始化，预期会触发 "Caller must be the contract creator" 断言。

### 3. 文档检查
- README 中未搜索到 `InitialisableWithCreator` 的说明或升级后的初始化要求。
- 由于网络限制，无法访问 DeepWiki 验证文档内容。

## 结论

- **权限检查充分**：当前扩展能可靠地限制 `initialise` 仅由合约创建者调用，升级后也不会失效。
- **测试覆盖不足**：建议新增测试场景，模拟升级后由非创建者尝试初始化，以验证权限仍生效。
- **文档改进**：在 README 或官方文档中补充说明：升级完成后应由原始创建者重新初始化，并推荐继承 `InitialisableWithCreator`。

综上，此方向暂未发现新的漏洞，可视为人工否定，但建议完善测试与文档以减少误用风险。
