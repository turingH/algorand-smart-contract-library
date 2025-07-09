# 审计报告：升级后遗留状态清理

## 执行摘要

依照 `audit/audit_001_021_plan.md` 制定的步骤，我们审查了 `Upgradeable` 模块与其子模块在完成合约升级时对旧状态的处理方式。代码显示 `complete_contract_upgrade` 仅删除升级计划、递增 `version` 并将 `is_initialised` 置为 `False`【F:contracts/library/Upgradeable.py†L122-L171】；`AccessControl` 的角色映射与 `RateLimiter` 的桶映射均未在升级逻辑中被触及，意味着这些 Box 和全局变量会在链上保留【F:contracts/library/AccessControl.py†L50-L56】【F:contracts/library/RateLimiter.py†L40-L42】。现有测试聚焦升级流程本身，并未覆盖升级到结构差异较大的合约后旧状态的表现。仓库 `README.md` 未提供清理旧 Box 或全局变量的指引【F:README.md†L1-L60】，DeepWiki 页面因环境限制无法访问确认。综合分析，遗留状态虽然不会直接破坏新逻辑，但会持续占用最低余额并可能引入权限管理混乱。

## 详细审计过程

### 1. 代码审查
- `Upgradeable.complete_contract_upgrade` 在重置版本时仅执行以下操作：删除 `scheduled_contract_upgrade`、递增 `version`、重置 `is_initialised`，未调用任何清理函数【F:contracts/library/Upgradeable.py†L166-L170】。
- `AccessControl` 在构造函数中声明 `roles` 与 `addresses_roles` 两个 `BoxMap`，均使用固定前缀存储，生命周期独立于升级流程【F:contracts/library/AccessControl.py†L50-L56】。
- `RateLimiter` 同样在构造函数中初始化 `rate_limit_buckets` BoxMap【F:contracts/library/RateLimiter.py†L40-L42】，仅通过 `_remove_bucket` 手动删除桶【F:contracts/library/RateLimiter.py†L128-L142】。
- **微断言**：上述代码表明升级不会自动清理旧角色或旧桶，除非新版本在 `initialise` 中显式执行删除逻辑。

### 2. 测试设计
- 现有 `Upgradeable.test.ts` 只验证升级流程和版本变化，并未检查旧 Box 的残留影响【F:tests/library/Upgradeable.test.ts†L420-L460】。
- 可新增测试：先部署包含多个角色和桶的合约，升级到一个不再定义这些状态的简化合约。随后读取旧 Box，验证其仍然存在并占用余额。若新合约调用 `has_role` 或 `get_current_capacity` 等接口应抛出不存在的异常，以确认是否遗留逻辑依赖。
- **微断言**：如无额外清理步骤，升级后通过 `App.boxes` 查询应依旧能找到旧前缀的 Box，从而证明状态保留。

### 3. 文档检查
- `README.md` 主要介绍安装、编译和测试流程，未涉及升级后清理状态的注意事项【F:README.md†L1-L60】。
- 深入搜索仓库亦未找到关于升级清理的说明。由于网络限制，无法验证 DeepWiki 是否有相关文档。
- **微断言**：缺乏官方文档指导可能导致开发者在升级后忘记删除旧 Box，最终占用额外余额。

## 结论

- **遗留状态持续存在**：`complete_contract_upgrade` 的实现不会清除 `AccessControl`、`RateLimiter` 等模块的 Box 或全局变量，旧数据在新版本合约中依旧可见。
- **潜在资源浪费**：根据以往审计结论，每个 `RateLimiter` 桶约需 154,900 microAlgos 的最低余额【F:audit/audit_002_report.md†L104-L112】，若升级后不再使用这些桶却未删除，将导致资金长期占用。
- **建议**：在合约的升级脚本或新版本 `initialise` 中添加清理逻辑，如遍历并删除不再需要的 Box；同时在 README 或 DeepWiki 中补充升级后状态迁移与清理的最佳实践，提醒开发者注意最低余额和权限管理。

综合以上，本次审计未发现立即可利用的漏洞，但指出升级遗留状态可能带来的存储成本与管理复杂度。若开发者未在升级流程中进行清理，合约账户将承担额外余额压力，相关文档亦应明确此风险。

