# AI 审计方案 - 升级后未初始化状态的接口风险

## 背景
- 根据 `pk.md` 断言 #37，`is_initialised` 和 `version` 等属性会持久化到全局状态，升级完成后 `is_initialised` 会被重置为 False[#37-1]。
- 断言 #26 指出在升级预初始化阶段旧角色仍可授予或撤销权限[#26-1]。
- 以往关于 Box 清理及角色持续存在的风险已被认定为治理问题，现转向关注升级完成后未重新初始化的状态下是否存在安全隐患。

## 新方向
评估在执行 `Upgradeable.complete_contract_upgrade` 之后到再次调用 `initialise` 之间，合约可调用的接口是否会导致状态异常或权限绕过。

## 审计目标
1. 梳理所有 ABI 方法，识别未调用 `_only_initialised` 的函数。
2. 分析这些函数在升级后 `is_initialised` 为 False 时的行为，判断是否会破坏逻辑一致性。
3. 检查文档是否要求在升级后立即重新调用 `initialise`，避免开发者疏忽。

## 审计步骤
1. **代码审查**
   - 全局搜索 `_only_initialised` 的使用范围，列出未使用的公开方法。
   - 确认 `complete_contract_upgrade` 调用后将 `is_initialised` 置为 False。
   - 对比 `RateLimiter`、`AccessControl` 等模块，检查其核心操作是否缺少初始化判断。
2. **PoC 编写**
   - 部署旧版合约并写入示例数据。
   - 执行升级但不调用 `initialise`，随后尝试调用如 `add_bucket`、`grant_role` 等方法，观察是否成功。
   - 记录状态变化，用于人工验证。
3. **文档检查**
   - 搜索 README 与 DeepWiki，确认是否存在关于升级后必须重新初始化的说明。

## 预期输出
- 若发现未初始化状态下仍可执行敏感操作，应建议在相关方法前增加 `_only_initialised` 检查或在升级流程中强制重新初始化。
- 若无直接风险，可在文档中提醒开发者注意升级后及时调用 `initialise`。

> 注：本文件仅为审计计划，尚未执行实际审计工作。
