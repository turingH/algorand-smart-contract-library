# 审计报告：AccessControl 角色 ID 碰撞风险

## 执行摘要

依据 `audit_001_014_plan.md` 的要求，对库中所有通过 `keccak256` 截断前 16 字节生成的角色 ID 进行统计，并评估潜在的哈希碰撞概率。代码搜索结果显示仅存在 `default_admin_role`、`upgradable_admin_role` 等极少数角色常量，且各自的哈希值互不相同。理论计算表明，在 `2^128` 的地址空间下，即便未来扩展到上千种角色，发生碰撞的概率仍低于 `10^-33`，可认为几乎不可能。综合当前库的规模与预期角色数量，现行设计足够安全，但可在文档中补充说明哈希算法及概率估算，便于用户理解。

## 详细审计过程

### 1. 角色 ID 统计与重复检查
- 搜索 `op.keccak256(...)[0:16]` 发现仅两处角色定义：`upgradable_admin_role`【F:contracts/library/Upgradeable.py†L174-L180】与文档示例中的 `my_role`【F:contracts/library/AccessControl.py†L18-L23】。
- `default_admin_role` 直接返回全零常量【F:contracts/library/AccessControl.py†L94-L102】。
- 计算 `UPGRADEABLE_ADMIN` 与 `MY_ROLE` 的哈希结果分别为 `b831f3e71ba73888cb926e5fc7dcc3a0` 与 `dcb45d22d6db6f31a037ed3c2b861c3a`【3c9332†L1-L2】。
- **微断言**：当前代码库未出现角色 ID 重复的情况，新增角色只要采用不同的源字符串即可避免冲突。

### 2. 碰撞概率分析
- 角色 ID 长度为 16 字节，对应空间大小 `2^128`，采用生日悖论近似公式 `p ≈ 1 - e^{-n(n-1)/(2·2^{128})}` 估算。
- 当角色数量 `n=1000` 时，`p ≈ 1.47×10^{-33}`，即使 `n` 达到一百万也仅约 `1.47×10^{-27}`【2c2e1b†L1-L4】。
- **微断言**：在常见应用场景中角色种类通常不超过百级，因此碰撞概率几乎为零，可忽略不计。

### 3. 改进方案探讨
- 若未来需要支持上万或更多角色，可考虑在库中记录角色原始名称，或扩展到 32 字节哈希以进一步降低理论风险。
- 目前 `README.md` 未对角色 ID 的生成方式做说明，建议在文档或 DeepWiki 页面中添加算法描述及概率估算，提醒开发者保持角色名称的唯一性。

## 结论

`AccessControl` 采用的 16 字节哈希截断在当前库规模下安全可靠，角色 ID 无重复，理论碰撞概率极低。除非未来角色数量出现数量级扩张，否则无需更改设计。建议在文档中补充生成规则与碰撞概率计算，以提升用户对该机制的信心和理解。
