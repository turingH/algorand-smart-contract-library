# 审计报告：BoxMap 结构变更兼容性

## 执行摘要

根据 `audit/audit_002_003_plan.md` 制定的步骤，我们检查了库中 `BoxMap` 的声明位置与 `Upgradeable.complete_contract_upgrade` 的升级逻辑。结合 `pk.md` 断言 36 与 28，可证明升级过程不会自动处理结构兼容性，若调整 `BoxMap` 的字段顺序或类型，旧数据将被误解读[#36-1][#28-1]。

测试阶段尝试运行 `npm run test` 但因 `jest` 缺失而失败，故未能执行 PoC。不过代码审查足以推导出潜在风险。

## 详细审计过程

### 1. 代码审查
- `AccessControl` 在初始化时创建 `roles` 与 `addresses_roles` 两个 `BoxMap`，分别映射角色信息与账户角色关系【F:contracts/library/AccessControl.py†L50-L56】。
- `RateLimiter` 初始化时创建 `rate_limit_buckets` `BoxMap`，存储每个桶的限流数据【F:contracts/library/RateLimiter.py†L40-L42】。
- 这些声明均未包含版本或兼容性标志，若结构发生变更，旧数据会被直接按照新结构解析。
- `Upgradeable.complete_contract_upgrade` 在升级时仅校验程序哈希并重置 `version` 与 `is_initialised`，未清理任何 `BoxMap` 数据或检查结构兼容性【F:contracts/library/Upgradeable.py†L150-L171】。

### 2. PoC 设计
1. 部署旧版合约并调用公开方法写入 `roles` 或 `rate_limit_buckets` 数据。
2. 创建新版合约，调整相应 `Struct` 的字段顺序或添加新字段，再按升级流程执行 `complete_contract_upgrade`。
3. 升级完成后调用读取方法，观察解析出的值是否与预期不符，即为结构不兼容的体现。

由于当前环境缺少测试依赖，PoC 未能自动化执行。

### 3. 文档检查
- `README.md` 仅描述安装、编译和测试流程，没有关于升级时迁移旧 `BoxMap` 数据的说明【F:README.md†L1-L60】。
- 访问 DeepWiki 提示 403 Forbidden，无法确认是否存在迁移指导【b2838a†L1-L5】。

## 结论

- **确认结果**：升级流程不会自动迁移或清理旧 `BoxMap` 数据，改变结构将导致旧值被误解读，符合 `pk.md` 断言 36 和 28 的描述。
- **风险评估**：若未来版本调整 `BoxMap` 结构，必须在升级脚本中手动清理或迁移旧数据，否则可能产生逻辑错误或资金损失。
- **治理建议**：在文档和示例脚本中增加迁移步骤说明，并提示开发者在设计结构时保持向后兼容或做好迁移计划。

