# AI 审计方案 - 升级后初始化抢占风险
## 更新历史
- 2025-07-08: 基于 @audit_001_report_change_01.md、@audit_001_report.md、@audit_001_006_plan_report.md 等误报确认文件，本方案被人工否定，不再继续深挖。新审计方向详见 audit_001_010_plan.md。
- 2025-07-09: 结合 @audit_001_access_control_plan_report.md 与 @audit_001_006_plan_report.md 的结果，确认旧方向均为误报。本方案再次停止，新的研究方向转向 UInt64SetLib 边界条件，详见 audit_001_011_plan.md。
- 2025-07-10: audit_001_010_plan_report.md 未发现漏洞，确认此前假设不成立。
- 2025-07-11: audit_001_011_plan_report.md 未发现漏洞，原方案被人工否定。
- 2025-07-12: 新方向转向 Upgradeable 合约程序哈希校验，详见 audit_001_012_plan.md。
- 2025-07-13: audit_001_012_plan_report.md 未发现漏洞，确认 Upgradeable 哈希校验方向为误报，标记为人工否定。新的研究方向转向升级时间戳溢出问题，详见 audit_001_013_plan.md。
- 2025-07-14: audit_001_013_plan_report.md 未发现漏洞，再次确认前述假设均为误报。继续寻找新的研究方向。
- 2025-07-15: 基于上述结论，决定审查 AccessControl 角色 ID 的 16 字节截断设计，以评估潜在碰撞风险，计划文件为 audit_001_014_plan.md。
- 2025-07-16: audit_001_014_plan_report.md 未发现漏洞，方向被人工否定。新方向关注 RateLimiter 桶管理及存储成本，计划文件为 audit_001_015_plan.md。
- 2025-07-17: audit_001_015_plan_report.md 证实桶管理与存储成本仅属设计考量，无安全漏洞，方向被人工否定。新的研究方向转向桶删除后立即重新创建是否可重置配额，计划文件为 audit_001_016_plan.md。
- 2025-07-18: audit_001_016_plan_report.md 未发现漏洞，方向被人工否定。新的研究方向转向升级完成后初始化流程可能被抢占，计划文件为 audit_001_017_plan.md。


## 背景
审计确认桶删除后重建只在权限不足时才造成问题，@audit_001_016_plan_report.md 已标记为人工否定。为继续探索潜在风险，本方案研究 **升级完成后 `initialise` 接口被恶意账户抢占** 的可能性。根据 `pk.md` 的先验知识，`RateLimiter` 的数值逻辑无需复查。

## 审计目标
1. 检查 `Upgradeable` 在 `complete_contract_upgrade` 后 `is_initialised` 置 `False` 的流程，确认未授权账户是否可调用 `initialise`。
2. 分析示例合约和库中对 `Initialisable.initialise` 的权限约束，评估被抢占的风险。
3. 设计测试场景模拟升级完成后恶意账户抢先初始化的行为。
4. 提出防护和最佳实践建议。

## 审计步骤
1. **代码审查**
   - 阅读 `Initialisable`、`InitialisableWithCreator` 与 `Upgradeable` 中相关逻辑。
   - 搜索各合约中 `initialise` 的实现，记录是否限制调用者。
2. **测试设计**
   - 在测试合约中构造升级完成后立即由不同账户调用 `initialise` 的流程，观察角色赋值情况。
3. **文档与使用建议**
   - 检查 README 或示例文档中是否提醒开发者在升级后立即重新初始化并限制调用者。

## 预期结果
- 阐明升级后初始化接口是否存在被抢占的风险及影响。
- 根据结论，将该方向标记为“未发现漏洞”或提出修复措施。
