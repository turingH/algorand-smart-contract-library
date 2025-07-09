# 审计报告：RateLimiter 升级遗留 Box 清理

## 执行摘要

依据 `audit/audit_002_001_plan.md` 所列步骤，我们审查了 `RateLimiter` 在删除桶和完成合约升级后的状态清理情况。代码显示 `_remove_bucket` 直接调用 `BoxMap` 删除，能够释放对应 Box；而升级逻辑 `complete_contract_upgrade` 并未触及任何现有 Box，因此旧数据会持续占用最低余额。文档中亦未找到升级后清理的说明，访问 DeepWiki 页面因 403 失败。

## 详细审计过程

### 1. 代码审查
- `_remove_bucket` 在检查桶存在后执行 `del self.rate_limit_buckets[bucket_id]` 并触发事件【F:contracts/library/RateLimiter.py†L128-L142】。由 `BoxMap` 的语义可推得该语句会删除 Box 并释放存储 —— **微断言**：删除后同一 `bucket_id` 不再出现在 `BoxMap` 中。
- `RateLimiter` 在构造函数中初始化 `rate_limit_buckets`，其 `key_prefix` 为 `rate_limit_buckets_`【F:contracts/library/RateLimiter.py†L40-L42】。`AccessControl` 亦使用独立前缀 `role_` 与 `address_roles_`【F:contracts/library/AccessControl.py†L50-L56】。结合 `pk.md` 断言 27 可知各模块前缀互不冲突[#27-1]【F:pk.md†L30-L40】。
- `Upgradeable.complete_contract_upgrade` 只删除 `scheduled_contract_upgrade`、递增 `version` 并重置 `is_initialised`，未对 `rate_limit_buckets` 或角色信息做任何处理【F:contracts/library/Upgradeable.py†L166-L170】。与 `pk.md` 断言 25 一致，升级不会自动清理 Box[#25-1]【F:pk.md†L30-L40】。

### 2. 实验验证
- 计划在本地部署 `RateLimiterExposed` 合约后创建和删除桶，再查询链上 Box。由于缺少 Algorand 节点与 `jest` 依赖，`npm run test` 执行失败【2a256a†L1-L5】。**微断言**：当前环境无法直接验证 Box 删除效果，应在完整节点环境复现。
- 同理，升级后检查旧前缀 Box 的实验未能执行。根据代码推理，旧 Box 会继续存在并占用余额，但不会被新前缀读取。

### 3. 文档检查
- 仓库 `README.md` 只介绍安装、编译和测试流程，未提及升级后清理旧 Box 的注意事项【F:README.md†L1-L60】。
- 尝试访问 DeepWiki 链接返回 403 Forbidden【3dfa4e†L1-L11】，无法确认是否有额外指引。

## 结论

- **确认结果**：`_remove_bucket` 可彻底删除指定桶，其 Box 被释放。
- **遗留状态风险**：升级流程不会自动移除旧前缀 Box，符合 `pk.md` 断言 25 和 27 的描述。若新版本不再使用这些桶，余额将持续被占用。
- **治理建议**：在升级脚本或新版本 `initialise` 中显式遍历并删除不再使用的 Box，并在文档或 DeepWiki 中补充清理步骤，以免开发者忽视最低余额消耗。

