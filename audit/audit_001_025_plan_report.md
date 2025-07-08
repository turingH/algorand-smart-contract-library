# 审计报告：升级时全局/局部状态 schema 兼容性

## 执行摘要

依照 `audit/audit_001_025_plan.md` 的指引，我们审查了仓库中涉及 `GlobalState` 与 `LocalState` 的声明，并评估 `Upgradeable` 模块在升级过程中是否校验状态 schema 的变化。代码显示库中仅 `Upgradeable` 一处使用 `GlobalState`，且没有 `LocalState` 定义；升级流程也未对新旧 schema 做任何比较。测试与文档均未给出相关迁移指引。综合判断，若升级到 schema 不兼容的合约，链上状态可能损坏或升级失败，需要开发者自行管理迁移。

## 详细审计过程

### 1. 代码审查
- `Upgradeable` 定义了两个结构体 `ScheduledContractUpgrade` 与 `MinimumUpgradeDelay`，随后在构造函数中以 `GlobalState` 持久化【F:contracts/library/Upgradeable.py†L12-L20】【F:contracts/library/Upgradeable.py†L56-L61】。
- 全库搜索未发现任何 `LocalState` 声明，亦无其他 `GlobalState` 变量【d061dc†L1-L3】【8652a8†L1-L3】。
- `schedule_contract_upgrade` 与 `complete_contract_upgrade` 只检查时间戳与程序哈希，没有校验状态字段是否兼容【F:contracts/library/Upgradeable.py†L98-L119】【F:contracts/library/Upgradeable.py†L139-L171】。
- **微断言**：升级逻辑缺乏对新旧合约状态 schema 的检查，若字段数量或类型变更，升级交易仍会执行，通过后可能留下无效状态。 

### 2. 测试设计与执行
- 计划尝试编译两个 schema 不同的合约并执行升级，但运行 `npm run pre-build` 时因缺少 `algokit` 命令失败【4f6dba†L1-L10】。
- 尝试执行 `npm test` 同样因 `jest` 未安装而无法运行【8ea229†L1-L4】【3dca33†L1-L2】。
- **微断言**：当前环境缺乏必要工具，无法通过自动化测试验证 schema 兼容性，应在具备依赖的环境补充此类测试。

### 3. 文档检查
- `README.md` 仅介绍编译与测试步骤，未提及升级时的状态迁移或兼容要求【F:README.md†L1-L60】。
- 受限于网络，未能访问 DeepWiki 验证是否有额外指引。
- **微断言**：官方文档缺少关于 schema 变更的说明，开发者可能忽视升级带来的状态迁移风险。

## 结论

- **缺乏兼容性校验**：`complete_contract_upgrade` 在升级时并未比对旧合约与新合约的状态 schema，只有程序哈希和时间戳校验。这意味着升级到字段不匹配的版本不会被自动拒绝。
- **潜在状态损坏**：如果新合约删除或改变了全局/局部状态字段，旧数据仍保留但不再被访问，或者因字段类型变化而导致读取异常。
- **建议**：
  1. 在升级前加入脚本或链上逻辑，比较预编译的 `global/local schema` 与旧版本是否一致；若不兼容，则提示开发者执行迁移。
  2. 在 README 或 DeepWiki 中补充升级到不同 schema 的处理流程，如如何导出旧数据并重新初始化。
  3. 在测试中加入 schema 变更场景，确保升级脚本能正确捕获并处理不兼容情况。

综上，本次审计未发现代码层面的直接漏洞，但确认升级流程没有内建的状态 schema 兼容检查。若开发者疏忽，可能在升级后遇到无法读取或污染旧状态的问题，应通过额外脚本与文档指引来规避。
