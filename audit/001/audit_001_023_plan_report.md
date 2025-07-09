# 审计报告：BoxMap 前缀冲突与状态隔离

## 执行摘要

依据 `audit/audit_001_023_plan.md` 制定的步骤，我们梳理了库中所有 `BoxMap` 实例的 `key_prefix`，并评估升级过程中修改或复用前缀可能导致的状态污染风险。代码搜索结果显示仅 `AccessControl` 与 `RateLimiter` 两个模块定义了 `BoxMap`，分别使用 `role_`、`address_roles_` 与 `rate_limit_buckets_` 作为前缀【F:contracts/library/AccessControl.py†L50-L56】【F:contracts/library/RateLimiter.py†L40-L42】。这些前缀在当前仓库中均未重复，说明各模块状态互相隔离。升级逻辑 `complete_contract_upgrade` 只更新版本号并未清理旧 Box【F:contracts/library/Upgradeable.py†L166-L170】，因此若新版本更改前缀，旧数据会继续保留但不会被新逻辑读取。

## 详细审计过程

### 1. 代码审查
- `AccessControl.__init__` 将角色及账户关系分别存储在两张 `BoxMap` 中，前缀为 `role_` 与 `address_roles_`【F:contracts/library/AccessControl.py†L50-L56】。
- `RateLimiter.__init__` 仅定义一张 `BoxMap`，前缀为 `rate_limit_buckets_`【F:contracts/library/RateLimiter.py†L40-L42】。
- 搜索 `contracts` 目录未发现其他 `BoxMap` 实例，说明当前前缀集合为上述三个。
- **微断言**：由于三处前缀完全不同，现有模块之间不存在前缀冲突。

### 2. 升级流程分析
- `Upgradeable.complete_contract_upgrade` 在成功执行后仅删除升级计划、递增 `version` 并将 `is_initialised` 置为 `False`【F:contracts/library/Upgradeable.py†L166-L170】。
- 该过程不会删除任何 Box，因此若新版本修改了 `BoxMap` 的 `key_prefix`，旧前缀的 Box 会持续存在并占用余额。
- **微断言**：升级并不自动迁移或清理旧前缀数据，除非开发者在新版本 `initialise` 中显式处理。

### 3. 测试设计
- 可构建示例合约包含 `AccessControl` 与 `RateLimiter`，部署后向其 `BoxMap` 写入数据，再升级到修改 `key_prefix` 的版本。
- 升级完成后读取旧前缀的 Box 应仍返回先前写入的数据，而新前缀下的 Box 为空，由此验证状态隔离依赖前缀唯一性。
- 若在同一应用中实例化两份库合约且故意使用相同前缀，应观察到写入彼此可见，从而证明冲突风险。
- **微断言**：测试若能重现旧数据遗留或跨实例数据共享，即说明前缀设计需谨慎管理。

### 4. 文档检查
- 仓库 `README.md` 仅介绍编译与测试流程，未对 `key_prefix` 命名或升级迁移提供任何建议【F:README.md†L1-L60】。
- 由于网络限制，无法访问 DeepWiki 验证是否存在相关指导。
- **微断言**：缺乏文档说明可能导致开发者在升级时忽视前缀冲突或清理问题。

## 结论

- **前缀隔离良好**：当前库中的 `BoxMap` 前缀互不相同，未发现直接冲突风险。
- **升级遗留数据**：升级流程不会自动删除旧前缀的 Box，若新版本调整前缀，需要额外的迁移或清理步骤以避免余额占用和潜在误读。
- **建议**：
  1. 在文档中加入前缀命名规范，确保各模块或合约实例化时选择独一无二的前缀。
  2. 若需修改前缀，应在 `initialise` 中遍历旧 Box 完成迁移或删除，避免状态污染。

综上，本次审计未发现实质漏洞，但指出在跨版本或多实例场景下前缀管理的重要性。适当的命名约定与升级迁移流程将有助于保持状态隔离。 
