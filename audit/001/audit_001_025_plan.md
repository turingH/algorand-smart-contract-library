# AI 审计方案 - 升级时全局/局部状态 schema 兼容性

## 背景
`audit_001_024_plan_report.md` 表明合约升级允许回滚到旧版本，但该问题属于治理风险而非直接漏洞。为继续挖掘新的潜在问题，本计划聚焦于升级过程中文件 schema 的兼容性。若新旧版本的 global/local state 定义不一致，可能导致升级失败或状态损坏。

## 目标
1. 梳理库中各合约的 `GlobalState` 与 `LocalState` 声明，记录字段数量和类型。
2. 评估 `Upgradeable` 模块在升级时是否校验 schema 兼容性，或完全依赖外部约束。
3. 设计实验：从旧版本升级到修改 schema 的新版本，观察链上行为及错误信息。
4. 根据结果提出迁移脚本或在文档中标明的最佳实践。

## 审计范围
- `contracts/library/Upgradeable.py`
- 依赖 `GlobalState` 或 `LocalState` 的其他模块
- 升级相关测试与文档

## 方法与步骤
1. **代码审查**
   - 搜索 `GlobalState`、`LocalState` 的定义与使用位置，记录各版本差异。
   - 检查 `schedule_contract_upgrade` 与 `complete_contract_upgrade` 是否对 schema 变化做任何限制或提示。
2. **测试设计**
   - 编写或修改示例合约，创建一个版本在全局或局部状态上新增/删除字段。
   - 尝试利用 `Upgradeable` 模块从旧版本升级到新版本，记录升级是否被拒绝或成功后状态是否一致。
3. **文档检查**
   - 阅读 README 与 DeepWiki（如可访问），确认是否存在关于升级时 schema 迁移的说明。

## 预期输出
- 如果发现 schema 变化导致升级失败或潜在数据丢失，将给出迁移策略与改进建议。
- 若库中已有充分约束或文档，说明现有方案可接受，并将该方向标记为“未发现漏洞”。

> 注：本文件仅为审计计划，尚未执行实际审计工作。
