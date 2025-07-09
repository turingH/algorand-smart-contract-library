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
- 2025-07-27: audit_001_024_plan_report.md 发现升级可回滚到旧程序，虽未构成直接漏洞，但属治理风险，故标记为潜在风险。新的研究方向转向升级过程中的全局/局部状态 schema 兼容性，计划文件为 audit_001_025_plan.md。
- 2025-07-28: audit_001_025_plan_report.md 未发现漏洞，方向被人工否定。依据 @audit_plan_false_finding.md 等汇总，决定进一步研究 AccessControl 角色管理员循环依赖可能导致的权限锁定问题，计划文件为 audit_001_026_plan.md。
- 2025-07-29: 参考 audit_plan_false_finding.md 等文件，确认近期方向多为误报或治理风险，audit_001_026_plan.md 正等待人工验证。为继续探索新漏洞，决定研究 Upgradeable.version 的 UInt64 溢出可能性，计划文件为 audit_001_027_plan.md。
- 2025-07-30: audit_001_027_plan_report.md 未发现漏洞，確認版本溢出僅屬理論風險，方向標記為人工否定。為探索新切入點，決定研究升級程序頁數過大導致循環耗盡的可能性，計劃文件為 audit_001_028_plan.md。
- 2025-07-31: audit_001_028_plan_report.md 未发现漏洞，方向被人工否定。新的研究方向关注 default_admin_role 与自定义角色冲突的潜在风险，计划文件为 audit_001_029_plan.md。
- 2025-08-01: audit_001_029_plan_report.md 未发现漏洞，方向被人工否定。新的研究方向转向 BoxMap 条目数量上限与潜在 DoS，计划文件为 audit_001_030_plan.md。
- 2025-08-02: audit_001_030_plan_report.md 指出条目数量上限仅属治理风险，未见直接漏洞，故标记为潜在风险。新的研究方向关注默认管理员全部放弃后是否可恢复，计划文件为 audit_001_031_plan.md。
- 2025-08-03: audit_001_031_plan_report.md 确认最后管理员放弃权限会导致合约无法管理，属治理风险。新的研究方向转向授予角色时资金不足的失败模式，计划文件为 audit_001_032_plan.md。
## 背景
`audit_001_019_plan_report.md` 显示 `InitialisableWithCreator` 权限检查充分，未发现漏洞。随后 `audit_001_020_plan_report.md` 指出角色数据在升级后仍会保留，但仅构成管理隐患，并非直接漏洞。综合 `audit_plan_false_finding.md` 与 `audit_plan_no_finding.md`，旧思路再次被否定。此后 `audit_001_021_plan_report.md` 记录升级完成后旧状态不会被自动清理；`audit_001_022_plan_report.md` 验证预初始化阶段风险为误报；`audit_001_023_plan_report.md` 进一步确认 BoxMap 前缀隔离良好，旧数据仅需在升级时手动处理；`audit_001_024_plan_report.md` 指出版本可回滚但属于治理风险；`audit_001_025_plan_report.md` 证实 schema 兼容性问题亦未构成漏洞，仅需文档补充。故上述方向均被人工否定。目前 `audit_001_026_plan.md` 针对角色管理员循环依赖的风险仍在等待人工验证。为了寻找新的切入点，本次进一步关注 `Upgradeable.version` 的溢出可能性，详见 audit_001_027_plan.md。根据 `pk.md` 的先验知识，`RateLimiter` 的数值逻辑无需复查。
后续 `audit_001_027_plan_report.md` 指出版本号溢出难以在现实触发，故将该方向记为人工否定。随后 `audit_001_028_plan_report.md` 亦未发现漏洞，`default_admin_role` 冲突方向在 `audit_001_029_plan_report.md` 中同样被否定。鉴于近期思路多被证伪，计划转向评估 BoxMap 条目数量上限与潜在 DoS，详见 audit_001_030_plan.md。`audit_001_030_plan_report.md` 进一步确认条目创建需管理员权限，仅在接口外泄时才可能产生治理风险，故将该方向标记为潜在风险。为继续探索，新的研究主题是默认管理员全部放弃后的合约锁定问题，详见 audit_001_031_plan.md。

## 审计目标
1. 评估 `grant_role` 在应用账户余额不足时是否会留下部分写入或事件。
2. 测算授予单个角色所需的最低余额，分析大规模授予操作的成本与失败风险。
3. 核对 README 与 DeepWiki 是否提供资金准备或失败处理指引。
4. 根据结果给出代码或文档的改进建议。
## 审计步骤
1. **代码审查**
   - 阅读 `_grant_role` 实现，确认开辟新 Box 时的异常处理逻辑。
   - 搜索所有可调用 `_grant_role` 的路径，分析可能在余额不足时被触发的场景。
2. **测试设计**
   - 构建脚本在未向应用账户转入足够资金的情况下执行 `grant_role`，观察交易失败与状态变化。
3. **文档检查**
   - 查阅 README 与 DeepWiki（如可访问），确认是否提醒开发者在授予角色前需预留足够余额，并说明失败处理方式。
## 预期结果
- 若资金不足会产生异常状态或事件残留，应提出在库层增加余额检查或回滚机制，并完善文档。
- 若交易能完全回滚，仅需在文档中强调资金要求，可将本方向标记为治理建议。
