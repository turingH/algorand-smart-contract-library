# AI 审计方案 - 创建者限定初始化检查

## 背景
`audit_001_018_plan_report.md` 已确认升级调度相关的假设为误报。根据 `audit_plan_false_finding.md` 与 `audit_plan_no_finding.md` 的经验，本次计划转向 `InitialisableWithCreator` 扩展。该扩展在初始化时要求调用者必须是合约创建者，若实现或使用不当可能导致未授权的初始化。

## 目标
1. 验证 `InitialisableWithCreator.initialise` 对 `Global.creator_address` 的检查是否充分，没有被子类覆盖或绕过的风险。
2. 评估在 `Upgradeable` 合约升级后，继承该扩展的新版本是否仍然只能由原始创建者初始化。
3. 设计测试场景，确保非创建者在任何阶段均无法成功调用 `initialise`，包括升级后的合约。
4. 根据审计结果提供必要的文档或代码改进建议。

## 审计范围
- `contracts/library/extensions/InitialisableWithCreator.py`
- 继承该扩展的示例合约与测试代码
- 与升级流程相关的 `Upgradeable` 实现

## 方法与步骤
1. **代码审查**
   - 逐行检查 `InitialisableWithCreator` 的实现，确认 `initialise` 中的断言顺序和调用关系。
   - 搜索仓库中所有继承该扩展的合约，确认其 `initialise` 实现均调用 `super().initialise()`。
   - 了解 `Global.creator_address` 在升级后的取值是否保持不变，排除因升级导致的权限转移。
2. **测试设计**
   - 编写或修改现有测试，模拟非创建者调用 `initialise` 以及升级合约后的再次初始化，期望均被拒绝。
3. **文档检查**
   - 审阅 README 与 DeepWiki，确认是否对使用 `InitialisableWithCreator` 的限制做出明确说明。

## 预期输出
- 确认初始化权限仅限合约创建者，且在升级后依旧生效。
- 若未发现问题，将该方向标记为人工否定；如有风险，提出修复建议并完善文档。
