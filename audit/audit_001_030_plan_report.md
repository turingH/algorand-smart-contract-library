# 审计报告：BoxMap 条目数量上限与潜在 DoS

## 执行摘要

依据 `audit/audit_001_030_plan.md` 的步骤，对库中 `AccessControl` 与 `RateLimiter` 的条目创建接口进行了审查，并结合测试数据估算批量创建 Box 的资金成本。结果发现：核心库仅通过 `grant_role` 等接口在权限校验后写入 `BoxMap`，`RateLimiter` 的 `_add_bucket` 等函数未被公开，仅在测试合约 `RateLimiterExposed` 中暴露。创建单个桶约需 `154,900` microAlgos 的最低余额，并且 Algorand 协议对 Box 总数限制为 `65,536` 个，理论上最大成本约 `10,151` Algos。仓库 README 与 DeepWiki 未给出条目数量上限或资金提醒，若开发者在自定义合约中不慎开放这些接口，仍存在资金消耗导致 DoS 的风险。

## 详细审计过程

### 1. 代码审查
- `AccessControl` 在 `grant_role` 中先调用 `_check_sender_role` 验证调用者拥有相应管理员权限【F:contracts/library/AccessControl.py†L59-L70】。
- `_grant_role` 在角色首次出现时写入默认管理员，同时记录账户与角色的映射【F:contracts/library/AccessControl.py†L157-L169】。
- `RateLimiter` 构造函数仅初始化 `rate_limit_buckets` BoxMap，未提供公开的添加接口【F:contracts/library/RateLimiter.py†L40-L42】。
- 只有测试用合约 `RateLimiterExposed` 以 ABI 方法 `add_bucket` 调用 `_add_bucket`【F:contracts/library/test/RateLimiterExposed.py†L17-L20】。
- **微断言**：库层默认接口均需管理员权限或仅供内部调用，普通账户无法直接批量创建条目。

### 2. 成本与上限估算
- `RateLimiter.funding.test.ts` 显示创建一个桶需准备 `154,900.microAlgos()`【F:tests/library/RateLimiter.funding.test.ts†L102-L113】。
- 若达到协议上限 `65,536` 个 Box，理论消耗约 `10,151` Algos（154,900 × 65,536）【637246†L1-L5】。
- `AccessControl.test.ts` 中为三种角色分配资金约 `180,000` microAlgos，可推测单个角色记录的余额成本在数万 microAlgos级别【F:tests/library/AccessControl.test.ts†L56-L69】。
- **微断言**：在缺乏数量或余额限制的情况下，接口一旦暴露，攻击者可循环调用造成巨大资金占用，直至达到 Box 上限。

### 3. 文档检查
- README 仅介绍安装、编译与测试流程，未涉及 Box 数量或存储成本说明【F:README.md†L1-L39】。
- 访问 DeepWiki 链接遭遇 403 Forbidden，无法获取更多官方指引【40c0af†L1-L12】。
- **微断言**：官方文档未给出条目管理建议，开发者可能忽视预留余额或权限控制的必要性。

## 结论

- **未发现直接漏洞**：库本身对条目创建均有管理员限制或未暴露接口，常规使用下难以被任意账户滥用。
- **潜在治理风险**：若下游合约显式公开 `_add_bucket` 或 `_grant_role` 等内部函数，批量创建 Box 可能导致应用余额快速膨胀，甚至触及 65,536 个 Box 的协议上限形成 DoS。
- **文档改进建议**：在 README 或 DeepWiki 中补充每个桶/角色的大致存储成本及数量上限提示，引导开发者在部署前准备充足资金并设置合理的访问控制或条目限制。

综上，当前库实现安全度较高，但应在文档和示例中提醒开发者关注 Box 数量和最低余额，避免在自定义合约中引入拒绝服务的隐患。
