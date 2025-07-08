# 审计报告：RateLimiter 桶重建导致配额重置风险

## 执行摘要

依据 `audit_001_016_plan.md` 的步骤，对 `RateLimiter` 删除后立即重建桶的情形进行了验证。代码审查显示 `_remove_bucket` 会完全删除 Box 状态，而 `_add_bucket` 在重新创建时会把 `current_capacity` 重置为 `limit`，`last_updated` 设为当前时间【F:contracts/library/RateLimiter.py†L108-L142】。若外部接口允许这样操作，即可在耗尽配额后通过删除再添加来恢复满额。但仓库中只有 `RateLimiterExposed` 用于测试目的公开这些方法【F:contracts/library/test/RateLimiterExposed.py†L18-L23】。因此实际风险取决于开发者是否暴露相同接口。

为确认行为，我们编写了单元测试 `RateLimiter.recreate.test.ts`：先创建桶并消耗一半容量，再删除并立即重建同一 `bucket_id`。测试断言新建后的容量恢复为上限，验证了配额确实被重置。若没有访问控制，这种做法可绕过正常的时间限制。

## 详细审计过程

### 1. 代码审查
- `_add_bucket` 在创建时把 `current_capacity` 与 `limit` 设为相同，`last_updated` 取最新区块时间戳【F:contracts/library/RateLimiter.py†L108-L127】。
- `_remove_bucket` 删除 Box 状态后触发事件，没有冷却期等额外逻辑【F:contracts/library/RateLimiter.py†L129-L142】。
- 测试合约 `RateLimiterExposed` 将这些函数直接暴露为 ABI 方法，仅用于单元测试【F:contracts/library/test/RateLimiterExposed.py†L18-L23】。
- **微断言**：如果生产合约也暴露这些接口，确实可以通过删除再新增的方式立刻获得满额配额。

### 2. 单元测试验证
- 新增测试 `RateLimiter.recreate.test.ts`，按照计划执行删除后重建流程。
- 结果表明：重新创建后查询 `getCurrentCapacity` 返回与 `limit` 相等，说明容量被重置。
- **微断言**：行为符合合约当前实现；不存在额外状态遗留或时间戳错误。

### 3. 权限与文档检查
- 仓库文档及 DeepWiki 页面均未鼓励在生产环境暴露 `_add_bucket`/`_remove_bucket` 等内部函数。
- 根据 `pk.md` 的先验知识，这些接口默认应由管理员或特殊角色调用，以防止滥用。
- **微断言**：只要接口受权限控制，删除重建配额的能力不会被普通用户利用。

### 4. 风险评估与建议
- 若开发者在自定义合约中暴露删除和新增桶的方法，应确保调用者拥有管理员权限，并在文档中警告可能导致配额重置。
- 另可考虑在删除后重新添加前引入冷却期或历史记录，以便追踪潜在滥用行为。

## 结论

删除并立即重新创建桶确实会让配额恢复至满额，但该行为仅在具备相应权限时才可执行。库中没有对外开放这些入口，示例合约也说明仅供测试。因此该问题在当前仓库中属于**可控行为**，应在使用文档中提醒开发者注意权限管理，避免在生产系统中无保护地暴露这些函数。
