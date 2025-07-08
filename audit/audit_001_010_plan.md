# AI 审计方案 - Initialisable 重复初始化竞态问题

## 背景
- `contracts/library/Initialisable.py` 提供 `initialise()` 基础实现，仅检查 `is_initialised` 标志，无调用者权限控制。
- 子合约可在 `extensions/` 或其他目录中重写 `initialise` 以添加自定义权限校验（例如 `InitialisableWithCreator.py`）。
- 若部署者或升级流程中出现竞态，使得多个交易在极短时间内同时调用 `initialise()`，可能出现重复初始化或权限被非预期账户夺取的风险。
- 先前审计报告未深入探讨此竞态场景，亦无针对多事务并发的单元测试覆盖。

## 目标
1. 验证 `Initialisable.initialise` 在并发环境下能否被多次成功调用。
2. 审查所有继承 `Initialisable` 的合约，实现中是否保证调用者权限及重放保护。
3. 评估升级后 `is_initialised = False` 标志重置期间的窗口期风险。
4. 输出竞态攻击可能带来的权限失控、资金转移或 DoS 影响评估。

## 审计范围
- `contracts/library/Initialisable.py`
- `contracts/library/extensions/InitialisableWithCreator.py`
- 任何直接或间接继承 `Initialisable` 的合约（含测试合约示例）
- 升级流程相关方法：`Upgradeable.complete_contract_upgrade` + `Initialisable.initialise`

## 方法与步骤
1. **代码静态分析**
   - 追踪 `is_initialised` 标志的读写路径，确认是否存在竞争条件。
   - 对比子合约 `initialise` 实现，记录是否添加 `Global.creator_address` 或角色校验。
2. **并发场景建模**
   - 使用 Algorand 事务组或快速连续提交模拟两笔 `initialise()` 交易竞争。
   - 记录成功路径、失败路径和潜在异常。
3. **单元测试设计**
   - 编写测试用例，使用 Jest/pytest 结合 Algorand sandbox，在同一轮次内发送多笔 `initialise` 调用。
   - 验证 `is_initialised` 值、权限分配、事件触发是否唯一。
4. **升级流程窗口期分析**
   - 调用 `schedule_contract_upgrade` → 等待 → `complete_contract_upgrade`。
   - 在 `complete_contract_upgrade` 之后、重新调用 `initialise()` 之前注入恶意交易，验证是否可能抢先初始化。
5. **安全假设验证**
   - 检查依赖假设：一次成功初始化后，所有后续调用都必定失败。
   - 若发现依赖外部约束（如交易组原子性），记录并分析风险。

## 预期输出
- 竞态复现脚本及结果截图/日志。
- 针对每个继承合约的权限检查矩阵。
- 如果验证安全：写出数学或逻辑证明，说明重复初始化不可行。
- 如果发现漏洞：详细技术细节、攻击成本、影响、修复建议（但不在本计划中展开）。

## 时间规划
| 阶段 | 任务 | 预计耗时 |
| ---- | ---- | -------- |
| 1 | 代码走查与静态分析 | 1 天 |
| 2 | 并发场景建模与脚本编写 | 1 天 |
| 3 | 单元测试实现与执行 | 1 天 |
| 4 | 升级窗口期实验 | 0.5 天 |
| 5 | 结果整理与报告草稿 | 0.5 天 |

## 里程碑 & 交付物
1. **M1**: 静态分析笔记 & 路径图
2. **M2**: 并发测试脚本提交 PR
3. **M3**: 测试执行结果与日志
4. **M4**: 完整审计报告初稿（漏洞或安全证明）

## 参考资料
- Algorand Smart Contract 官方文档
- 先前报告：`audit_001_access_control_plan_report.md` 对初始化权限问题的讨论

> 注：本文件仅为审计计划，未开始实际审计工作。 