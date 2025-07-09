# 审计报告：升级后未初始化状态的接口风险

## 执行摘要

依据 `audit/audit_002_004_plan.md` 的步骤，我们梳理了升级完成到重新调用 `initialise` 之间可访问的 ABI 方法，并评估其对状态和权限的一致性影响。代码显示 `complete_contract_upgrade` 会将 `is_initialised` 重置为 `False`，该属性持久化于全局状态，符合 `pk.md` 断言 37 的描述[#37-1]【F:contracts/library/Upgradeable.py†L166-L169】【F:pk.md†L52-L52】。

未受 `_only_initialised` 保护的公开方法主要集中在 `AccessControl` 模块，如 `grant_role`、`revoke_role` 与 `renounce_role` 等【F:contracts/library/AccessControl.py†L58-L94】。在升级后旧角色仍可操作这些接口，符合 `pk.md` 断言 26 关于预初始化阶段权限仍可变更的结论[#26-1]【F:pk.md†L35-L35】。

综合代码审查与文档检查，未发现库内要求升级后立即重新初始化的说明；尝试运行现有测试时因缺少 `jest` 依赖而失败，无法在本地验证接口表现。整体而言，未初始化状态下的可调用接口并不会导致明显的逻辑破坏，但若开发者忽略重新初始化，旧角色可能持续生效并调整权限。

## 详细审计过程

### 1. 代码审查
- `Upgradeable.complete_contract_upgrade` 在重置版本号后把 `is_initialised` 设为 `False`，触发 `UpgradeCompleted` 事件【F:contracts/library/Upgradeable.py†L166-L171】。此变量的持久化在 `pk.md` 已被确认[#37-2]【F:pk.md†L52-L52】。
- `_only_initialised` 断言仅检查 `self.is_initialised` 为真【F:contracts/library/Initialisable.py†L58-L63】。`Upgradeable` 的管理接口 `update_min_upgrade_delay`、`schedule_contract_upgrade` 与 `cancel_contract_upgrade` 均在开头调用该断言【F:contracts/library/Upgradeable.py†L78-L133】，使其在升级完成后暂时不可调用。
- `AccessControl` 中的 `grant_role`、`revoke_role`、`renounce_role` 等函数未包含 `_only_initialised` 检查，升级后依旧可执行【F:contracts/library/AccessControl.py†L58-L94】。结合 `pk.md` 断言 24 和 31，可知旧角色在升级后仍然有效[#24-1][#31-1]【F:pk.md†L33-L33】【F:pk.md†L46-L46】。
- `RateLimiter` 暴露的 ABI 方法均为只读操作，不会修改状态，也没有依赖 `is_initialised`【F:contracts/library/RateLimiter.py†L31-L95】。

**微断言**：升级完成后，除 `AccessControl` 的角色管理接口外，其他修改合约状态的方法均因 `_only_initialised` 断言而无法调用；因此未初始化阶段主要风险在于角色权限的延续和变更。

### 2. PoC 设计与执行尝试
1. 部署旧版合约并授予测试账户若干角色。
2. 调用 `schedule_contract_upgrade` 与 `complete_contract_upgrade` 完成升级，但暂不执行 `initialise`。
3. 使用旧角色调用 `grant_role` 或 `revoke_role`，预期操作成功。

尝试运行仓库自带测试 `npm run test` 以复现上述场景时，命令报错 `jest: not found`【8c84ac†L1-L5】，说明当前环境缺乏必要依赖，无法直接执行 PoC。应在安装依赖和启动本地节点后重试。

### 3. 文档检查
- 仓库 `README.md` 仅描述安装、编译与测试流程，未提及升级后必须重新初始化或限制调用的提示【F:README.md†L1-L80】。
- 访问 DeepWiki 链接返回 403 Forbidden【73a243†L1-L11】，无法确认是否有额外指导。

**微断言**：缺乏官方文档提示可能导致开发者忽视升级完成后仍需调用 `initialise`，从而延长旧角色可操作的时间窗口。

## 结论

- **确认结果**：`complete_contract_upgrade` 会重置 `is_initialised` 为 `False`，使所有受 `_only_initialised` 保护的方法暂时失效，符合 `pk.md` 断言 37[#37-3]。
- **接口风险**：`AccessControl` 的角色管理函数在未初始化状态下仍可执行，旧角色可继续授予或撤销权限，印证 `pk.md` 断言 26 和 31[#26-2][#31-2]。
- **治理建议**：在升级脚本或文档中明确要求完成升级后立即调用 `initialise`，并视需要在 `initialise` 中重新确认或清理旧角色，避免权限配置被意外更改。

