# AI 审计方案 - 创建者限定初始化检查
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
- 2025-07-19: audit_001_017_plan_report.md 未发现漏洞，方向被人工否定。新的研究方向转向升级调度覆盖导致等待期被缩短的可能性，计划文件为 audit_001_018_plan.md。
- 2025-07-20: audit_001_018_plan_report.md 未发现漏洞，方向被人工否定。参考 @audit_plan_false_finding.md 与 @audit_plan_no_finding.md，总结以往思路均未能挖掘实际问题，新的研究方向转向 `InitialisableWithCreator` 初始化权限，计划文件为 audit_001_019_plan.md。
- 2025-07-21: audit_001_019_plan_report.md 未发现漏洞，方向被人工否定。新的研究方向转向升级过程中 AccessControl 角色持久化及潜在权限滥用，计划文件为 audit_001_020_plan.md。


## 背景
`audit_001_019_plan_report.md` 显示 `InitialisableWithCreator` 权限检查充分，未发现漏洞。结合 `audit_plan_false_finding.md` 与 `audit_plan_no_finding.md` 的结论，旧思路已被人工否定。为继续探索潜在风险，决定关注 **Upgradeable 升级过程中 AccessControl 角色持久化** 是否可能导致权限滥用。根据 `pk.md` 的先验知识，`RateLimiter` 的数值逻辑无需复查。

## 审计目标
1. 确认 `complete_contract_upgrade` 升级后原有角色数据仍被保留且不会自动清空。
2. 评估新版本修改或删除角色定义时，旧角色是否依旧拥有超出预期的权限。
3. 设计测试场景：升级到权限架构不同的合约，验证旧角色能否调用受保护接口。
4. 根据结论给出文档或代码层面的改进建议。

## 审计步骤
1. **代码审查**
   - 阅读 `complete_contract_upgrade` 与 `AccessControl` 的实现，确认升级不会自动重置角色。
   - 检查示例合约在升级到新版本时如何处理旧角色，评估潜在滥用情形。
2. **测试设计**
   - 模拟升级到角色配置不同的新合约，尝试以旧角色调用受限方法，观察是否被允许。
3. **文档检查**
   - 查看 README 与 DeepWiki（如可访问）是否提醒在升级后重新审视角色配置。

## 预期结果
- 判断角色持久化在升级场景下是否会导致权限滥用风险。
- 根据结论，将该方向标记为“未发现漏洞”或给出修复与文档建议。
