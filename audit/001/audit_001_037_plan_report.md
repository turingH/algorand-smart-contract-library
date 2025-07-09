# 审计报告：管理员账户 rekey 场景评估

## 执行摘要

根据 `audit/audit_001_037_plan.md` 的指引，我们检查了合约在管理员或创建者账户执行 rekey 后的行为。代码层面，`AccessControl` 使用 `Txn.sender` 作为权限校验的唯一依据【F:contracts/library/AccessControl.py†L149-L150】，`InitialisableWithCreator` 同样比较 `Txn.sender` 与 `Global.creator_address`【F:contracts/library/extensions/InitialisableWithCreator.py†L14-L26】。在 Algorand 中 rekey 只更换签名公钥并不改变账户地址，因此角色绑定与初始化流程不会因 rekey 失效。此结论依托先验知识 **#21** 关于创建者校验可靠性的断言 1 次。

尝试按照计划运行 `npm run pre-build` 与 `npm test` 以构建实验环境，仍因缺少 `algokit` 与 `jest` 报错，无法在本地模拟 rekey 后的调用差异【854c90†L1-L10】【2c4770†L1-L6】。README 未提及 rekey 相关注意事项【F:README.md†L1-L60】，访问 DeepWiki 同样被 403 拒绝【085d61†L1-L7】。

综上，现有实现对 rekey 场景没有逻辑缺陷，但文档缺少对这一行为的说明，可能使开发者在更换密钥后感到疑惑。

## 详细审计过程

### 1. 代码审查
- `grant_role` 等函数通过 `_check_sender_role` 调用 `_check_role`，最终比较 `Txn.sender` 与记录的地址【F:contracts/library/AccessControl.py†L148-L154】。
- `InitialisableWithCreator.initialise` 断言 `Txn.sender == Global.creator_address`，确保仅合约创建者能初始化【F:contracts/library/extensions/InitialisableWithCreator.py†L14-L26】。
- **微断言**：rekey 不改变地址，因此 `has_role` 与初始化检查依旧成立。

### 2. 实验设计与执行
- 预期步骤：部署合约后将管理员账户 rekey 到新密钥，再调用 `grant_role` 或 `initialise`。
- 实际执行 `npm run pre-build`、`npm test` 时分别提示 `algokit: not found` 与 `jest: not found`，实验无法继续【854c90†L1-L10】【2c4770†L1-L6】。
- **微断言**：即使缺乏实际运行环境，理论上 `Txn.sender` 仍对应原地址，交易可以正常通过权限检查。

### 3. 文档检查
- `README.md` 主要介绍安装和测试流程，未包含任何关于 rekey 的指南【F:README.md†L1-L60】。
- 访问 DeepWiki 链接被 403 禁止，无法确认官方文档是否有补充说明【085d61†L1-L7】。
- **微断言**：官方文档未提醒开发者 rekey 对权限系统的影响，可能导致操作时缺乏信心。

## 结论

- **无直接漏洞**：`AccessControl` 与 `InitialisableWithCreator` 均基于地址校验，rekey 不会令已授予的角色或初始化入口失效。
- **改进建议**：
  1. 在 README 或 DeepWiki 中加入提示，说明管理员账户若进行了 rekey，原有角色仍与地址绑定，可继续使用。
  2. 提供简单脚本或操作说明，展示如何安全地在 rekey 后确认权限仍有效，以免用户误以为需要重新赋权。

