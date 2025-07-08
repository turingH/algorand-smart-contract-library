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
- 2025-07-22: audit_001_020_plan_report.md 指出升级后的角色数据会继续保留，虽然未发现直接漏洞，但存在权限管理风险，故将该方向标记为潜在风险。
- 2025-07-23: 为进一步评估升级流程可能遗留的其他状态，新的研究方向转向升级后 Box/全局变量清理策略，计划文件为 audit_001_021_plan.md。
- 2025-07-24: audit_001_021_plan_report.md 指出升级后旧状态不会被自动清理，可能造成余额占用，目前结论等待人工验证。新的研究方向转向升级完成到重新初始化之间的权限过渡风险，计划文件为 audit_001_022_plan.md。


- 2025-07-25: audit_001_022_plan_report.md 未发现漏洞，方向被人工否定。新的研究方向转向 BoxMap 前缀冲突及跨合约状态隔离，计划文件为 audit_001_023_plan.md。
- 2025-07-26: audit_001_023_plan_report.md 指出 BoxMap 前缀隔离良好，旧数据会继续保留但不会被新逻辑读取，仅需在升级时手动处理，未发现直接漏洞，因此将该方向标记为人工否定。新的研究方向转向升级流程中可能发生的版本回滚或重复升级风险，计划文件为 audit_001_024_plan.md。
## 背景
`audit_001_019_plan_report.md` 显示 `InitialisableWithCreator` 权限检查充分，未发现漏洞。随后 `audit_001_020_plan_report.md` 指出角色数据在升级后仍会保留，但仅构成管理隐患，并非直接漏洞。综合 `audit_plan_false_finding.md` 与 `audit_plan_no_finding.md`，旧思路再次被否定。此后 `audit_001_021_plan_report.md` 记录升级完成后旧状态不会被自动清理；`audit_001_022_plan_report.md` 验证预初始化阶段风险为误报；`audit_001_023_plan_report.md` 进一步确认 BoxMap 前缀隔离良好，旧数据仅需在升级时手动处理。故上述方向均被人工否定。本次关注 **升级流程是否允许版本回滚或重复升级**，若缺乏限制可能重新引入已修复漏洞。根据 `pk.md` 的先验知识，`RateLimiter` 的数值逻辑无需复查。

## 审计目标
1. 确认 `schedule_contract_upgrade` 与 `complete_contract_upgrade` 是否限制版本号递增，避免降级或重复升级。
2. 评估管理员能否通过提供旧合约的 `program_sha256` 将合约回滚到早期版本。
3. 设计测试场景：尝试升级到相同或更旧的程序，观察版本号与功能表现。
4. 根据审计结果提出版本管理或程序校验的改进建议。

## 审计步骤
1. **代码审查**
   - 阅读 `Upgradeable.schedule_contract_upgrade` 与 `complete_contract_upgrade` 的实现，查找关于版本号或程序哈希的校验逻辑。
   - 搜索现有测试，看是否覆盖降级或重复升级情形。
2. **测试设计**
   - 部署初始版本合约并记录 `version`。
   - 尝试调度升级到同一份程序或更旧的程序，并执行 `complete_contract_upgrade`。
   - 观察升级是否成功以及 `version` 的变化情况。
3. **文档检查**
   - 查阅 README 与 DeepWiki（如可访问），确认是否建议避免降级或记录已部署版本。

## 预期结果
- 判断合约是否允许回滚到旧版本或重复部署相同程序。
- 若不存在限制而造成潜在风险，提出版本管理或文档改进建议；若无问题，将该方向标记为“未发现漏洞”。
