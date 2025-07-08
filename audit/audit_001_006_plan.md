# AI 审计方案 - 升级延迟生效窗口攻击面

## 文件信息
- **文件名**: audit_001_006_plan.md
- **关联主线**: audit_001.md (v3)
- **状态**: 草案 (待复核)

## 背景
`Upgradeable` 合约通过 `min_upgrade_delay` 与 `scheduled_contract_upgrade` 组合实现升级延迟保护。合约允许动态调整最小升级延迟 (`update_min_upgrade_delay`) 并在未来某一时间点生效。攻击者可能利用时间差，在**延迟降低的生效窗口**内安排并执行升级，从而**绕过原本更高的安全延迟**。

### 关键函数
1. `update_min_upgrade_delay(UInt64 min_upgrade_delay, UInt64 timestamp)`
2. `schedule_contract_upgrade(Bytes32 program_sha256, UInt64 timestamp)`
3. `_check_schedule_timestamp(UInt64 timestamp)`
4. `get_active_min_upgrade_delay()`

## 潜在威胁模型
| 场景编号 | 描述 | 潜在影响 |
| -------- | ---- | -------- |
| S1 | 管理员将 `min_upgrade_delay` 从 7 天降为 1 小时，并立即调度升级在 1 小时后执行。若旧值仍在生效，`_check_schedule_timestamp` 是否会被正确阻止？ | 升级延迟被缩短，降低社区治理反应时间 |
| S2 | 恶意管理员分两步操作：先把延迟降为 0 秒且生效时间为当前时间 + ε，然后立即调用 `schedule_contract_upgrade` 设定升级也在当前时间 + ε 后生效。 | 延迟保护完全失效 |
| S3 | 多重签名延迟变更与升级调度顺序交叉执行，测试竞态条件影响。 | 引入未授权升级路径 |

## 审计目标
1. **时间窗口正确性**：确认 `update_min_upgrade_delay` 与 `schedule_contract_upgrade` 的生效时间比较逻辑无绕过空间。
2. **最小值约束**：验证 `min_upgrade_delay` 不能被直接设置为低于协议/治理约定的下限（若有）。
3. **组合调用防护**：评估多次快速调用对 `min_upgrade_delay` 与升级调度交互的影响。
4. **单元测试覆盖**：确保极端时间戳 (0、过去时间、`MAX_UINT64`) 场景有测试。

## 审计步骤
1. **代码走查**
   - 跟踪 `_check_schedule_timestamp` → `get_active_min_upgrade_delay` → `MinimumUpgradeDelay` 结构体转换逻辑。
   - 验证 `delay_0` / `delay_1` 切换条件与 `Global.latest_timestamp` 比较是否准确。
2. **数学与逻辑验证**
   - 建立时序图，证明攻击者无法在旧延迟生效期间使用新低延迟调度升级。
3. **单元测试设计**
   - S1〜S3 场景的实现与断言。
   - 边界时间戳测试 (当前时间、当前时间-1、当前时间+1 等)。
4. **模拟链验证**
   - 使用测试链部署 `RateLimiter` + `Upgradeable` 组合例子。
   - 重放真实交易序列，验证链上时间线与预期一致。
5. **文档与社区反馈**
   - 若发现问题，准备修复提案与治理流程说明。

## 交付物
- **审计报告草案**: `/audit/audit_001_006_report_draft.md` (若发现问题时创建)
- **测试代码**: `/tests/library/Upgradeable.min_delay_window.test.ts`
- **数学证明附录**: `/audit/audit_001_006_proof.md`

## 时程与优先级
| 阶段 | 预计时长 | 负责人 |
| ---- | -------- | ------ |
| 需求确认 | 0.5 天 | 审计 PM |
| 代码走查 & 数学验证 | 1.5 天 | 审计工程师 |
| 单元测试实现 | 1 天 | QA |
| 模拟链验证 | 0.5 天 | QA |
| 报告撰写 | 0.5 天 | 审计工程师 |

> **注**：本计划仅定义审计步骤，不包含实际审计结果。待批准后方可执行。 