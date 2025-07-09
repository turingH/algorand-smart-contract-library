# 审计报告：Initialisable 重复初始化竞态分析

## 执行摘要

依据 `audit_001_010_plan.md` 的步骤，对 `Initialisable` 及其派生合约进行了静态分析，并结合 Algorand 交易执行模型推导了并发场景下的行为。结果显示：在 Algorand 上事务按顺序执行，`is_initialised` 标志在第一笔初始化成功后即被写入，随后交易无法再次满足 `assert not self.is_initialised` 条件，因此不存在真正的并发初始化。升级完成后标志被重置为 `False`，此阶段若子合约的 `initialise` 无权限校验，则可能被任意账户调用。

## 详细审计过程

### 1. 代码静态分析
- `Initialisable.initialise` 仅检查 `is_initialised` 并在成功后置位【F:contracts/library/Initialisable.py†L46-L58】。
- `InitialisableWithCreator.initialise` 先验证调用者是否为合约创建者，再调用父类实现【F:contracts/library/extensions/InitialisableWithCreator.py†L15-L26】。
- `Upgradeable.complete_contract_upgrade` 执行成功后将 `is_initialised` 设为 `False`，待重新初始化【F:contracts/library/Upgradeable.py†L119-L168】。
- **微断言**：只要状态写入在交易完成时立即生效，随后交易读取到的 `is_initialised` 必为 `True`，从而触发断言。

### 2. 并发场景推导
- Algorand 在同一轮次内按序执行事务组，各事务按索引顺序独立更新全局状态。
- 假设两笔 `initialise()` 调用在同一组中：第一笔执行后 `is_initialised=True`，第二笔执行前已经读取到更新后的状态，因此断言失败。
- 若分属不同组但同一轮，链仍按时间顺序处理，逻辑同上。
- **微断言**：不存在并发执行导致的竞态窗口，因任何写操作都会在下一笔交易前被持久化。

### 3. 继承合约权限检查
- `MockInitialisable.initialise` 无权限控制，仅依赖父类断言【F:contracts/library/test/MockInitialisable.py†L11-L17】。
- `MockInitialisableWithCreator.initialise` 限制调用者为创建者【F:contracts/library/test/MockInitialisableWithCreator.py†L7-L13】。
- `SimpleUpgradeable.initialise` 在升级合约中授予角色，依赖 `InitialisableWithCreator` 进行权限检查【F:contracts/library/test/SimpleUpgradeable.py†L9-L16】。
- **微断言**：若子合约缺少调用者校验，则在升级后 `is_initialised=False` 时可能被非预期账户重新初始化，造成角色滥授。

### 4. 升级窗口期分析
- `complete_contract_upgrade` 任何人可调用，完成后状态未初始化，需再次执行 `initialise`。
- 在此窗口期间所有受 `_only_initialised` 保护的方法均无法调用，因此资产操作被锁定，但 `initialise` 若无权限控制，攻击者可夺取管理员角色。
- **微断言**：升级后应立即由受信任账户执行初始化，或在子合约中限制 `initialise` 调用者。

### 5. 单元测试与复现情况
- 现有测试覆盖单次初始化成功与失败场景，但未包含并发交易测试。【F:tests/library/Initialisable.test.ts†L24-L38】
- 受限于当前环境缺少依赖，无法运行 Algorand sandbox 复现并发事务。但根据顺序执行模型，理论上第二笔初始化必然失败。

## 结论

- **并发调用安全**：Algorand 的事务顺序执行保证 `Initialisable.initialise` 只会成功一次，未发现竞争条件。
- **升级窗口风险**：升级完成到重新初始化之间，如子合约未验证调用者，任意账户可获得初始权限，需由实现者自行防护。
- **建议**：
  1. 在所有继承 `Initialisable` 的合约中明确限制 `initialise` 调用者。
  2. 升级后应尽快由受信任的角色重新初始化，避免权限真空。

