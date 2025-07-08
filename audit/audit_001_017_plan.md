# AI 审计方案 - 升级后初始化抢占风险

## 背景
上一轮审计 (`audit_001_016_plan_report.md`) 证实桶重建行为受权限控制，不构成漏洞，已被人工否定。为继续寻找潜在风险，本计划关注 `Upgradeable` 合约在升级完成后 `initialise` 接口可能被未授权账户调用的问题。根据 `pk.md` 的先验知识，`RateLimiter` 的数值逻辑无需复查。

## 目标
1. 确认 `complete_contract_upgrade` 将 `is_initialised` 重置为 `False` 后，哪些账户能够调用 `initialise`。
2. 检查库与示例合约中 `initialise` 实现的权限控制，评估被抢占的可能性。
3. 设计测试场景验证升级后恶意账户抢占初始化的行为及影响。
4. 汇总风险并提出防御措施或最佳实践。

## 审计范围
- `contracts/library/Initialisable.py`
- `contracts/library/extensions/InitialisableWithCreator.py`
- `contracts/library/Upgradeable.py`
- 示例合约中的 `initialise` 实现

## 方法与步骤
1. **代码审查**
   - 阅读上述文件，关注 `initialise` 与升级流程的交互。
   - 搜索项目中公开 `initialise` 的合约及其权限限制。
2. **测试设计**
   - 构建合约或脚本，模拟升级完成后由不同账户尝试调用 `initialise` 的情景。
3. **文档检查**
   - 评估文档是否强调升级后立即由受信任账户初始化，并提供限制调用者的示例。

## 预期输出
- 初始抢占风险的评估结果及复现步骤。
- 若未发现问题，将该方向标记为人工否定；如有风险，提出修复建议。
