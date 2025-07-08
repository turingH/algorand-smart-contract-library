# 审计报告：RateLimiter 桶管理与存储成本

## 执行摘要

依据 `audit_001_015_plan.md` 的步骤，对 `RateLimiter` 内部的 `_add_bucket`、`_remove_bucket` 等函数进行了代码审查，并结合测试中的资金准备流程估算每个桶的存储费用。结果显示：每个桶大约占用百余字节的 Box 存储，对应最低余额约 154,900 microAlgos。如无访问控制限制，恶意用户可反复创建新桶消耗应用余额。不过当前库并未公开这些函数，文档亦未提醒桶数量及资金需求。建议在使用文档中补充存储成本说明，并在示例合约中加入权限检查或数量上限。

## 详细审计过程

### 1. 代码审查
- `RateLimitBucket` 结构包含四个字段：limit 与 current_capacity 为 `ARC4UInt256`，duration 与 last_updated 为 `ARC4UInt64`【F:contracts/library/RateLimiter.py†L16-L20】。
- `_add_bucket` 在写入 `BoxMap` 前仅检查桶不存在，未做任何资金或权限验证【F:contracts/library/RateLimiter.py†L108-L127】。
- `_remove_bucket` 同样只检查桶存在后删除，无额外限制【F:contracts/library/RateLimiter.py†L129-L142】。
- 在仓库中搜索发现，仅 `RateLimiterExposed` 将这些内部函数暴露为 ABI 接口，主要用于测试目的【F:contracts/library/test/RateLimiterExposed.py†L18-L39】。
- **微断言**：库本身未提供默认的访问控制，若开发者直接暴露这些接口，应确保有足够的权限检查。

### 2. 成本测算
- 按代码推断，每个桶的键由前缀 `"rate_limit_buckets_"`（19字节）及 32 字节的 `bucket_id` 组成，值则存储 32+32+8+8=80 字节的结构体，总计约 131 字节。
- 测试中多处使用 `154_900.microAlgos()` 为每个桶准备资金【F:tests/library/RateLimiter.funding.test.ts†L108-L132】【F:tests/library/RateLimiter.funding.test.ts†L184-L221】。
- 结合 Algorand 的每字节最低余额，推算约需 154,900 microAlgos 才能成功创建一个桶。
- 运行脚本计算多桶场景下的最低余额需求，例如 10 个桶约需 1,549,000 microAlgos【6140a8†L1-L10】。
- **微断言**：若无资金上限或数量限制，大量创建桶可能快速耗尽应用余额。

### 3. 文档与示例检查
- `README.md` 中未出现 “RateLimiter” 相关说明【F:README.md†L1-L60】。
- 资金依赖仅在测试文件中给出示例，文档未明确告知开发者需预留资金或限制桶数量。【F:tests/library/RateLimiter.funding.test.ts†L40-L74】
- **微断言**：缺乏正式文档指导，可能导致集成者忽视资金与存储成本。

### 4. 改进方案草拟
- 在文档或 DeepWiki 页面中列出每个桶约 154,900 microAlgos 的最低余额需求，并给出资金转入示例。
- 示例合约应在公开 `add_bucket` 等接口前检查调用者权限，或设置桶数量上限以防止 DoS。
- 可以在库中提供可选的余额预检查工具函数，便于开发者在调用前验证资金充足。

## 结论

`RateLimiter` 的桶管理逻辑实现简洁，内部操作不会留下残余状态，但存储成本较高。每个桶约消耗 154,900 microAlgos 的最低余额，若接口对外开放且无适当限制，可能被滥用导致资金耗尽。目前文档对这一点缺少说明，建议在 DeepWiki 或 README 中补充存储成本与权限管理的最佳实践，确保开发者理解并正确使用该模块。
