# 审计报告：BoxMap 结构变更兼容性

## 执行摘要

根据 `audit/audit_001_033_plan.md` 的要求，我们研究了库中 `BoxMap` 在升级场景下结构变更的潜在影响。代码显示 `AccessControl` 与 `RateLimiter` 分别定义了多处 `BoxMap`，其键值结构如下：
- `AccessControl.roles`：`Bytes16` -> `Bytes16`【F:contracts/library/AccessControl.py†L50-L52】；
- `AccessControl.addresses_roles`：`AddressRoleKey(role: Bytes16, address: Address)` -> `Bool`【F:contracts/library/AccessControl.py†L53-L56】【F:contracts/library/AccessControl.py†L8-L10】；
- `RateLimiter.rate_limit_buckets`：`Bytes32` -> `RateLimitBucket(limit: UInt256, current_capacity: UInt256, duration: UInt64, last_updated: UInt64)`【F:contracts/library/RateLimiter.py†L15-L20】【F:contracts/library/RateLimiter.py†L40-L42】。

升级流程 `complete_contract_upgrade` 仅验证程序哈希并递增 `version`，未对现有 Box 数据做任何校验或迁移【F:contracts/library/Upgradeable.py†L139-L171】。因此，如果新版本沿用相同 `key_prefix` 但调整上述结构字段或顺序，旧数据会被直接按照新结构解析，可能导致权限判断失真或限流参数错误。

受限于环境，项目测试无法执行【ef41dc†L1-L8】，但根据 `Struct` 按字段顺序序列化的常规实现，可推导以下 **微断言**：若旧结构缺少新字段，新合约解码时将得到默认零值；若字段顺序被调换，各字段含义将错位。例如，在旧版 `RateLimitBucket` 中 `duration` 位于第三位，新版若将其移至首位，则存量 Box 被解码时会将原 `limit` 视为 `duration`，导致限额逻辑混乱。

查阅仓库 `README.md` 并未发现关于 Box 数据迁移或结构兼容性的说明【F:README.md†L1-L60】。尝试访问 DeepWiki 页面因网络限制返回 403，未能确认是否有相关指引【1b2a80†L1-L7】。

## 结论

- **潜在风险**：升级时若保留 `BoxMap` 前缀但修改结构，旧 Box 数据会被新版本以错误的字段解释，进而影响权限判断或限流参数。
- **治理建议**：在升级前应清理或迁移旧 Box 数据，或在新合约中引入版本字段以区分数据格式。项目文档亦需提醒开发者注意结构变更带来的兼容性问题。

综上，本次审计未发现直接漏洞，但指出 Box 结构变更的潜在误读风险。妥善的迁移策略和文档说明能有效避免此类问题。
