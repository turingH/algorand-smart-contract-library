# 审计报告：升级后初始化抢占风险

## 执行摘要

根据 `audit_001_017_plan.md`，我们审查了升级完成后 `initialise` 接口可能被未授权账户抢占的情形。`Upgradeable.complete_contract_upgrade` 在升级成功后会将 `is_initialised` 重置为 `False`，随后任何账户理论上都能尝试调用 `initialise`。然而库提供的 `Initialisable` 类明确要求子类自行校验调用者【F:contracts/library/Initialisable.py†L48-L55】，扩展 `InitialisableWithCreator` 更是强制限制为合约创建者【F:contracts/library/extensions/InitialisableWithCreator.py†L20-L26】。示例合约 `SimpleUpgradeable` 也沿用了这一扩展【F:contracts/library/test/SimpleUpgradeable.py†L8-L16】，因此无法被普通用户抢占。测试用例验证升级完成后 `is_initialised` 为 `False`【F:tests/library/Upgradeable.test.ts†L438-L458】，但未展示再次初始化的场景。综合代码与测试，未发现实际漏洞，但文档缺乏对“升级后立即由受信任账户重新初始化”的明确提醒，可能导致新手开发者忽略权限校验。

## 详细审计过程

### 1. 代码审查
- `complete_contract_upgrade` 重置状态并清空计划数据，随后发出事件【F:contracts/library/Upgradeable.py†L166-L171】。
- `Initialisable.initialise` 仅断言未初始化，不检查调用者，并在注释中提示子合约自行校验【F:contracts/library/Initialisable.py†L48-L55】。
- `InitialisableWithCreator.initialise` 在调用父类逻辑前确认 `Txn.sender` 等于 `Global.creator_address`，防止非创建者调用【F:contracts/library/extensions/InitialisableWithCreator.py†L20-L26】。

### 2. 实现与示例合约
- 搜索 `initialise` 的实现，发现库内示例 `SimpleUpgradeable` 将管理员角色授予传入地址，其 `initialise` 调用的是 `InitialisableWithCreator`【F:contracts/library/test/SimpleUpgradeable.py†L8-L16】。
- `MockAccessControl` 等测试合约未做权限检查，但这些文件位于 `contracts/library/test`，仅用于单元测试。
- **微断言**：只要开发者沿用 `InitialisableWithCreator` 或在自定义 `initialise` 中检查 `Txn.sender`，升级后的初始化无法被任意账户抢占。

### 3. 测试设计
- 现有测试在完成升级后断言 `isInitialised` 为 `False`【F:tests/library/Upgradeable.test.ts†L438-L458】，但未继续调用 `initialise`。理论上，可在此基础上新增一组测试：升级完成后由非创建者调用 `initialise`，期望抛出 "Caller must be the contract creator"。若调用者为创建者，则应能成功并重新授予角色。
- **微断言**：测试应覆盖恶意账户尝试初始化的流程，确保权限逻辑如预期执行。

### 4. 文档检查
- README 与仓库根目录未明确指出升级后必须及时调用 `initialise`，也未示例如何限制调用者。DeepWiki 页面虽包含库介绍，但对这一点着墨不足。
- 建议在文档中强调：升级完成后应由受信任账户立即重新初始化，且 `initialise` 实现需校验 `Txn.sender`（推荐使用 `InitialisableWithCreator`）。

## 结论

`Upgradeable.complete_contract_upgrade` 的实现确实会清除初始化状态，但库提供的 `InitialisableWithCreator` 已能有效防止未授权账户调用 `initialise`。示例合约遵循了这一模式，并无抢占风险。问题主要在于文档未突出此要求，可能导致开发者忽视权限检查。综合判断，此方向属于 **未发现漏洞**，应在文档中补充相应说明以降低误用可能。 
