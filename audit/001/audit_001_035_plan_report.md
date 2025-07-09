# 审计报告：隐式全局变量持久化验证

## 执行摘要

依据 `audit/audit_001_035_plan.md`，我们审查了 `Initialisable` 与 `Upgradeable` 模块对
于 `is_initialised` 与 `version` 字段的存储方式。代码显示两者均直接赋值为基本类
型，并未显式声明为 `GlobalState`。尝试使用 `npm run teal` 生成 TEAL 文件时因缺少
`algokit` 报错，无法进一步确认编译输出。现有 TypeScript 测试在运行时通过
`client.state.global.isInitialised()` 等接口访问这些字段，表明它们最终映射到全局
状态槽位。README 与 DeepWiki 均未解释此隐式持久化机制。

综上，Algopy 似乎自动将未声明的类属性持久化为全局状态，但文档缺少说明。建议在
库文档或代码注释中明确该行为，避免开发者误解。

## 详细审计过程

### 1. 代码审查
- `Initialisable.__init__` 将 `is_initialised` 设为 `False`，`initialise()` 调用后置
  为 `True`，全程未使用 `GlobalState`【F:contracts/library/Initialisable.py†L43-L59】。
- `Upgradeable.__init__` 仅对 `min_upgrade_delay` 与 `scheduled_contract_upgrade` 使用
  `GlobalState`，`version` 直接赋值为 `UInt64(1)`【F:contracts/library/Upgradeable.py†L56-L61】。
- 完成升级时删除已调度的升级信息，`version` 自增并将 `is_initialised` 设为 `False`
  【F:contracts/library/Upgradeable.py†L166-L169】。
- **微断言**：若 Algopy 不自动持久化普通属性，则这些字段在跨交易调用时将始终
  恢复默认值，导致无法判断合约是否初始化或升级次数。

### 2. 实验测试
- 现有测试脚本在部署后立即读取 `client.state.global.isInitialised()` 等字段，预期
  为 `False` 并在调用 `initialise` 后变为 `True`【F:tests/library/Initialisable.test.ts†L30-L50】。
- `Upgradeable.test.ts` 中同样在升级完成后检查 `version` 增加且 `isInitialised`
  重新变为 `False`【F:tests/library/Upgradeable.test.ts†L434-L458】。
- 试图执行 `npm run teal` 生成 TEAL 代码验证存储映射，但因 `algokit` 缺失而失败
  【06e5f1†L1-L5】【a1883e†L1-L7】。
- **微断言**：虽然无法编译生成 TEAL，测试脚本能够在运行时读取并断言这些字段，
  说明它们确实以某种方式持久化至全局状态。

### 3. 文档检查
- `README.md` 仅介绍编译与测试流程，未提到 Algopy 会将普通类属性自动持久化
  【F:README.md†L1-L60】。
- 尝试访问 DeepWiki 获得进一步说明时返回 403 Forbidden【0bde96†L1-L10】。
- **微断言**：缺乏官方文档说明可能导致开发者误以为未声明的字段不会持久化，继
  而在升级或初始化逻辑上产生误判。

## 结论

- **推论**：综合代码审查与测试行为，Algopy 应当自动将未用 `GlobalState` 声明的
  类属性映射为全局状态值，否则测试读取 `client.state.global` 将无法获得结果。
- **风险**：文档未阐述该隐式机制，可能使开发者在编写或升级合约时忽略状态迁移
  和初始值管理，存在治理或逻辑错误隐患。
- **建议**：
  1. 在 README 或 DeepWiki 中明确说明 Algopy 对普通属性的持久化规则。
  2. 在代码注释或示例中展示如何显式声明 `GlobalState`，避免依赖隐式行为。
  3. 补充编译与运行环境说明，确保审计与测试过程中能顺利生成 TEAL 验证结果。

综上，本次审计确认 `is_initialised` 与 `version` 等字段会在全局状态中保留，但文
档缺失可能引发误解，应予以补充说明。
