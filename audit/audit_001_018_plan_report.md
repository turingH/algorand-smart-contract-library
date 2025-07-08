# 审计报告：升级调度覆盖及延迟绕过风险

## 执行摘要

依据 `audit_001_018_plan.md` 的步骤，我们审查了 `Upgradeable` 合约中升级调度与最小延迟修改的交互。代码显示，`schedule_contract_upgrade` 与 `update_min_upgrade_delay` 均在写入计划前调用 `_check_schedule_timestamp`，该子例程要求时间戳不得早于 `Global.latest_timestamp + get_active_min_upgrade_delay()`【F:contracts/library/Upgradeable.py†L196-L199】。因此，无论是重新调度升级还是缩短最小延迟，都必须等待当前激活的延迟窗口。

通过时间序列推导可知，若想把等待期从旧值 `D0` 降低为 `D1`，需要先调用 `update_min_upgrade_delay` 并等待至少 `D0`，随后才能用新的 `D1` 重新调度升级。整体等待时间为 `D0 + D1`，不小于 `D0`。结合测试文件现状，尚未发现可在旧延迟窗口内提前完成升级的路径。文档亦未明示多次调度的影响，建议在 DeepWiki 或 README 中补充说明。

## 详细审计过程

### 1. 代码审查
- `update_min_upgrade_delay` 在更新延迟前检查时间戳，并在旧计划已生效时将 `delay_1` 覆写到 `delay_0`【F:contracts/library/Upgradeable.py†L81-L95】。
- `schedule_contract_upgrade` 同样使用 `_check_schedule_timestamp` 验证新计划，并直接覆盖旧的升级计划【F:contracts/library/Upgradeable.py†L98-L118】。
- `get_active_min_upgrade_delay` 根据当前时间在 `delay_0` 与 `delay_1` 间切换，供检查函数引用【F:contracts/library/Upgradeable.py†L182-L193】。
- **微断言**：所有计划时间戳均需满足 `timestamp >= now + active_delay`，管理员无法在当前延迟生效期内调度更早的时间。

### 2. 时间推导
- 设初始最小延迟为 `D0`，欲将其改为较小值 `D1`。
- 根据 `_check_schedule_timestamp`，调用 `update_min_upgrade_delay` 时必须令生效时间 `T1 >= now + D0`。
- 在 `T1` 之前，`get_active_min_upgrade_delay()` 始终返回 `D0`，故任何升级均需满足 `timestamp >= now + D0`。
- 当时间达到 `T1`，新的 `D1` 才被采用，此时可重新调用 `schedule_contract_upgrade`，要求 `timestamp >= T1 + D1`。
- **微断言**：任意升级最早发生在 `now + D0 + D1`，不会早于初始要求的 `D0`。

### 3. 单元测试设计
- 构造测试：
  1. 部署合约并设定 `min_upgrade_delay = D0`；
  2. 调用 `schedule_contract_upgrade` 设定任意远期时间；
  3. 立即调用 `update_min_upgrade_delay(D1, now + D0)`；
  4. 跳过 `D0` 时间后，重新调用 `schedule_contract_upgrade`，期望时间戳不得早于 `now + D0 + D1`；
  5. 核对最终计划被覆盖为第二次调度的结果。
- 现有测试仅验证单次覆盖和延迟生效逻辑，并未组合两者。可在 `Upgradeable.test.ts` 中新增上述流程以确认行为。

### 4. 文档检查
- 仓库 `README.md` 未包含关于升级调度或最小延迟调整的说明【F:README.md†L1-L60】。
- DeepWiki 页面因离线环境无法查阅，无法确认是否已有相关指导。
- **微断言**：缺少文档提醒可能使开发者误认为首次调度后的时间不可更改。

## 结论

`Upgradeable` 合约允许在满足当前最小延迟的前提下重新调度升级，且对最小延迟的降低也需等待同样时长。逻辑上无法在旧延迟未过的情况下提前完成升级，但频繁覆盖计划可能影响治理透明度。建议在文档中明确：升级时间可被覆盖，新计划仍需等待当前激活的最小延迟，并提供监控示例或最佳实践。整体评估为 **未发现漏洞**，更多是使用指导层面的改进空间。
