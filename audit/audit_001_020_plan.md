# AI 审计方案 - 升级过程中的角色持久化检查

## 背景
`audit_001_019_plan_report.md` 说明 `InitialisableWithCreator` 的初始化权限未暴露安全问题。结合 `audit_plan_false_finding.md` 和 `audit_plan_no_finding.md`，以往方向多被否定。本次计划转向 `Upgradeable` 与 `AccessControl` 的交互：升级完成后，旧版合约的角色信息会继续保留，若新版本调整了角色架构或权限配置，可能导致旧角色仍拥有过高权限。

## 目标
1. 分析 `complete_contract_upgrade` 执行后角色数据是否完全保留。
2. 评估当新版本修改角色用途或撤销部分角色时，旧角色能否继续调用受限接口。
3. 设计测试场景，模拟升级到权限设置不同的合约，并观察旧角色的权限表现。
4. 汇总审计结果，提出文档或实现上的改进建议。

## 审计范围
- `contracts/library/Upgradeable.py`
- `contracts/library/AccessControl.py`
- 示例合约 `SimpleUpgradeable.py` 及相关测试

## 方法与步骤
1. **代码审查**
   - 追踪升级流程对 `BoxMap` 中角色数据的影响。
   - 确认 `version` 递增和 `is_initialised` 重置不会清除现有角色。
2. **测试设计**
   - 编写或修改测试：部署旧版合约并授予角色 → 升级到修改角色定义的新合约 → 使用旧角色调用新接口。
   - 记录是否出现未预期的权限继承或拒绝。
3. **文档检查**
   - 搜索 README 与 DeepWiki（如可访问），看是否提醒开发者在升级后重新配置角色。

## 预期输出
- 判断角色持久化是否会造成权限滥用或管理混乱。
- 如无风险，则将该方向标记为人工否定；如发现问题，提出修复或文档建议。
