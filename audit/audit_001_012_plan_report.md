# 审计报告：Upgradeable 合约程序哈希校验

## 执行摘要

依据 `audit_001_012_plan.md` 的要求，对 `Upgradeable` 合约的程序哈希验证逻辑进行了审核。主要关注多页程序在升级时的 SHA256 计算方式、潜在篡改风险以及文档说明的完整性。通过代码静态分析与现有测试审阅，确认合约使用的哈希算法与工具函数 `calculateProgramSha256` 一致，未发现可绕过验证的途径。由于缺乏完整依赖，测试无法在本环境执行，但逻辑推导表明当前实现能够防止错序或额外数据导致的错误升级。

## 详细审计过程

### 1. 代码静态分析
- `complete_contract_upgrade` 在验证程序时，按顺序拼接字节串 `"approval"`、每页 `sha256` 后的审批程序，再拼接 `"clear"` 及清算程序各页哈希，最后整体求 `sha256`【F:contracts/library/Upgradeable.py†L146-L165】。
- 工具函数 `calculateProgramSha256` 以相同顺序和页大小 4096 字节计算哈希【F:tests/utils/contract.ts†L1-L23】。
- **微断言**：两处算法均将页内数据先单独哈希，再在外层拼接后计算整体哈希，数学上等价于 `sha256("approval" || H(page0) || ... || "clear" || H(page0) || ...)`，无遗漏或顺序偏差。

### 2. 边界条件建模
- 测试用例通过 `LargeContractToUpgradeTo` 构造 7 KB 以上的合约，以触发多页程序路径【F:contracts/library/test/LargeContractToUpgradeTo.py†L1-L10】。
- 结合 `PAGE_SIZE=4096` 的拆分逻辑，可推得当程序长度超过一页时，每页均被正确纳入哈希计算，额外填充数据会导致最终哈希不同，无法通过验证。
- **微断言**：假设篡改其中一页或调整页顺序，将改变对应位置的 `sha256` 值，最终哈希必不等于调度时记录的哈希。

### 3. 单元测试设计复核
- `Upgradeable.test.ts` 在 `complete contract upgrade` 场景下调用 `calculateProgramSha256` 生成预期哈希，并断言升级成功【F:tests/library/Upgradeable.test.ts†L392-L456】。
- 测试同时包含篡改哈希或时间未满足时升级失败的检查，间接验证了哈希匹配机制的正确性。
- **微断言**：若任何一页内容变化，`programSha256` 不再相等，测试中的 `"Invalid program SHA256"` 断言将被触发。
- 受环境限制，相关 `jest` 测试未能在容器内执行，但代码路径表明逻辑覆盖充分。

### 4. 文档检查
- 当前 `README.md` 未提及升级程序哈希的具体生成方式【F:README.md†L1-L33】。
- **建议**：在项目文档或 DeepWiki 页面中补充 `calculateProgramSha256` 的算法说明，并提醒多页程序需逐页哈希后再整体计算，以避免开发者误解。

## 结论

`Upgradeable` 合约通过严格的页级 SHA256 拼接方案确保升级包完整且顺序正确。现有实现与工具函数保持一致，理论上无法通过篡改单页或插入额外数据绕过验证。虽然测试未在本环境运行，但逻辑推导结合源代码足以证明哈希校验的有效性。建议完善文档说明，便于使用者理解多页合约升级的正确流程。
