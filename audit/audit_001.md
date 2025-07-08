# AI 审计方案 - 更改持续时间的边界情况
## 更新历史
- 2025-07-08: 基于 @audit_001_report_change_01.md、@audit_001_report.md、@audit_001_006_plan_report.md 等误报确认文件，本方案被人工否定，不再继续深挖。新审计方向详见 audit_001_010_plan.md。
- 2025-07-09: 结合 @audit_001_access_control_plan_report.md 与 @audit_001_006_plan_report.md 的结果，确认旧方向均为误报。本方案再次停止，新的研究方向转向 UInt64SetLib 边界条件，详见 audit_001_011_plan.md。
- 2025-07-10: audit_001_010_plan_report.md 未发现漏洞，确认此前假设不成立。
- 2025-07-11: audit_001_011_plan_report.md 未发现漏洞，原方案被人工否定。
- 2025-07-12: 新方向转向 Upgradeable 合约程序哈希校验，详见 audit_001_012_plan.md。

## 背景
- `RateLimiter._update_rate_duration` 在修改桶的持续时间之前，会先调用一次 `_update_capacity`。
- 如果桶的旧持续时间为 `0`（即无限桶），`_update_capacity` 会早返回且不会刷新 `last_updated`。
- 因此，当持续时间从 `0` 调整为非零值后，`last_updated` 仍为旧值，后续容量计算会使用过期时间差，可能导致结果与预期不符。

## 参考自 `pk.md` 的已验证知识
`pk.md` 已确认以下内容无需重新审计（除非代码变动）：
1. `_update_capacity` 使用的 `ARC4UInt256`、`ARC4UInt64` 类型保证 256/64 位运算安全。
2. `limit * time_delta` 使用 `BigUInt`，支持最大 512 位结果，避免溢出。
3. `duration` 参与除法并在结果上限到 `limit`，不会超过设定容量。
4. `tests/library/RateLimiter.test.ts` 已覆盖极端值(`MAX_UINT256`, `MAX_INT64`)且无溢出。
5. 函数包含零持续时间的提前返回等逻辑保护。
6. 所有入口在调用 `_update_capacity` 前都会验证桶是否存在。
7. 现有实现下未发现数值溢出问题。

本次审计方案仅关注更改持续时间为非零值时 `last_updated` 未更新的边界情况。

## 审计目标
1. 确认在旧持续时间为 `0` 的情况下调用 `update_rate_duration` 后，`last_updated` 是否被正确更新。
2. 验证修改后的持续时间生效后，容量计算逻辑依旧遵循已验证的安全属性（无需重新验证溢出）。
3. 保证相关事件 `BucketRateDurationUpdated` 等按预期触发。

## 审计步骤
1. **代码审查**
   - 阅读 `RateLimiter._update_rate_duration` 和 `_update_capacity` 的实现，确认未在持续时间更新后刷新 `last_updated`。
2. **单元测试设计**
   - 新增测试用例：创建持续时间为 `0` 的桶，等待一段时间后调用 `update_rate_duration` 设置为非零值。
   - 断言调用后 `get_bucket` 返回的 `last_updated` 为调用当下的时间戳。
   - 继续调用 `update_capacity`，断言 `time_delta` 的计算只包含自更改时间起的间隔。
3. **手动复现**
   - 在测试链上部署合约，执行与上述单元测试相同的步骤，手动检查事件日志与状态变化。
4. **代码修正建议（若适用）**
   - 在 `_update_rate_duration` 调用 `_update_capacity` 之后、更新 `duration` 之前，若旧 `duration` 为 `0`，显式写入 `last_updated = Global.latest_timestamp`。
   - 或在 `_update_capacity` 的零持续时间分支中更新 `last_updated`。

## 预期结果
- 通过新的测试用例验证 `last_updated` 在持续时间由 `0` 调整为非零值时能正确刷新。
- 保持 `pk.md` 中已验证的溢出安全性不受影响。
- 确保事件与数据状态均符合设计预期。

