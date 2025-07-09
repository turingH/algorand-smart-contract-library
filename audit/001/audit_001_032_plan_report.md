# 审计报告：AccessControl 授予角色时的资金不足处理

## 执行摘要

按照 `audit/audit_001_032_plan.md` 的指引，我们检查了库中 `AccessControl` 合约在调用 `grant_role` 时的资金需求及失败模式。代码显示 `_grant_role` 直接向 `roles` 与 `addresses_roles` 两个 `BoxMap` 写入数据，一旦应用账户余额不足，写入将因 TEAL 的 box 指令失败而使整笔交易回滚。测试脚本尝试在缺乏依赖的环境中运行时失败，未能验证实际链上行为。仓库文档及 DeepWiki 均未提及授予角色所需的最低余额。整体评估为**未发现漏洞，但文档需要补充资金说明**。

## 详细审计过程

### 1. 代码审查
- `grant_role` 先通过 `_check_sender_role` 验证调用者权限后直接调用 `_grant_role`【F:contracts/library/AccessControl.py†L59-L70】。
- `_grant_role` 在角色首次出现时写入默认管理员，并在账户无角色时创建 `(role,address)` 映射【F:contracts/library/AccessControl.py†L157-L169】。
- Algorand 的 box 写入在余额不足时会触发程序错误并回滚全部状态，未找到额外 catch 逻辑。
- **微断言**：由于 box 写入失败会导致交易整体回滚，`roles` 与 `addresses_roles` 任一写入失败都不会留下部分数据。

### 2. 测试设计与执行
- 计划构造单元测试：在未给应用账户足够资金时执行 `grant_role`，期望交易失败且查询角色信息返回空值。
- 实际运行 `npm run test` 时因 `jest` 未安装而失败【255ae6†L1-L5】。
- **微断言**：当前环境缺乏必要依赖，无法完成自动化验证，应在具备依赖的环境补充此测试。

### 3. 文档检查
- `README.md` 只包含安装、编译和测试流程，无关于角色授予资金要求的描述【F:README.md†L1-L39】。
- 访问 DeepWiki 链接被 403 拒绝，无法确认是否有额外资金指引【0fdc35†L1-L7】。
- **微断言**：官方文档未提示在授予角色前需要为应用账户预留足够余额，开发者可能忽视该要求。

## 结论

- **未发现直接漏洞**：`_grant_role` 的实现依赖 Algorand 的原子交易特性，余额不足会使交易整体失败，不会产生脏数据。
- **改进建议**：
  1. 在 README 或 DeepWiki 中补充授予单个角色的大致最小余额（测试示例中约 145,000 microAlgos【F:tests/library/AccessControl.test.ts†L65-L69】）。
  2. 提供失败示例或余额检查逻辑，提醒开发者在批量授予角色前预留充足资金。

综上，库代码在资金不足时能够安全回滚，但文档需明确资金要求，以降低开发者在部署与调用中的操作风险。
