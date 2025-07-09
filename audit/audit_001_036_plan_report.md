# 审计报告：UInt64SetLib 长度溢出检查

## 执行摘要

依据 `audit/audit_001_036_plan.md` 的步骤，我们审查了 `UInt64SetLib` 在尝试添加第 512 项时的行为。代码仅在文件头部提示最多支持 511 项【F:contracts/library/UInt64SetLib.py†L8-L11】，`add_item` 本身未包含长度判断【F:contracts/library/UInt64SetLib.py†L19-L29】。现有测试只验证了 511 项上限【F:tests/library/UInt64SetLib.test.ts†L155-L193】。由于环境缺乏 `algokit` 与 `jest`，`npm run pre-build` 与 `npm test` 均报可执行文件缺失，无法通过编译或执行验证【ddad5e†L1-L15】【ac365c†L1-L4】。README 未说明此限制【F:README.md†L1-L60】，访问 DeepWiki 时被 403 拒绝【2ec59c†L1-L12】。

根据 Algorand TEAL 的栈上限 4098 字节推断，`DynamicArray.append` 在第 512 次操作时会超出栈容量并导致编译或运行失败。虽然底层限制可以阻止溢出，但库与文档未明确告知开发者，也缺乏对失败情形的测试，可能在使用时造成困惑。

## 详细审计过程

### 1. 代码审查
- 文件开头注释指出集合最多 511 项【F:contracts/library/UInt64SetLib.py†L8-L11】。
- `add_item` 遍历数组检查是否重复，随后直接 `append`，无任何长度判断【F:contracts/library/UInt64SetLib.py†L19-L29】。
- **微断言**：当数组已含 511 项时，再次调用 `append` 将需要在栈中存放至少 512 个元素，加上局部变量已超过 4098 字节限制，编译或运行阶段必然失败。

### 2. 测试设计与执行
- 现有测试 `supports up to 511 items` 仅循环插入 511 项后再逐一删除【F:tests/library/UInt64SetLib.test.ts†L155-L193】。
- 按计划尝试新增 512 项测试，但 `npm run pre-build` 因 `algokit` 缺失失败，`npm test` 又因 `jest` 缺失无法运行【ddad5e†L1-L15】【ac365c†L1-L4】。
- **微断言**：在无法安装依赖的环境下，无法通过实践验证 512 项场景，测试覆盖仍停留在 511 项。

### 3. 文档检查
- README 仅介绍安装、编译和测试流程，未提及集合长度上限或超过后的行为【F:README.md†L1-L60】。
- 尝试访问 DeepWiki 获得进一步说明时遭遇 403 禁止，无法确认官方文档是否有相关警告【2ec59c†L1-L12】。
- **微断言**：文档未明确声明 511 项限制，开发者可能在无提示的情况下触发栈溢出。

## 结论

- **潜在风险**：`UInt64SetLib` 依赖 `DynamicArray` 的隐式限制。若开发者未注意到 511 项上限，在链上操作第 512 次 `append` 很可能因栈溢出而回滚，导致交易失败。
- **改进建议**：
  1. 在 `add_item` 前加入显式长度断言，或在文档中明确说明 511 项限制及超出后的后果。
  2. 补充单元测试，验证尝试添加第 512 项时出现的编译或运行错误，确保开发者能在测试阶段察觉该限制。

综上，虽然栈深限制避免了实际溢出，但库缺乏显式提示和测试覆盖，仍可能给使用者造成困扰，应通过断言或文档予以澄清。
