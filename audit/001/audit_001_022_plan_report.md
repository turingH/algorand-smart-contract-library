# 审计报告：升级后预初始化阶段权限过渡

## 执行摘要

依据 `audit/audit_001_022_plan.md` 的步骤，我们梳理了升级完成到再次初始化之间的可调用接口，重点分析旧角色在此阶段是否会影响权限控制。代码显示 `complete_contract_upgrade` 在结束时仅将 `is_initialised` 设为 `False`【F:contracts/library/Upgradeable.py†L166-L170】，而 `AccessControl` 的角色映射则完整保留【F:contracts/library/AccessControl.py†L50-L56】。因此，升级后虽无法调用受 `_only_initialised` 保护的方法，但旧角色仍可通过 `grant_role` 等接口授予新权限。

## 详细审计过程

### 1. 代码审查
- 在 `AccessControl` 中，`grant_role`、`revoke_role` 与 `renounce_role` 等函数均未调用 `_only_initialised`，可在未初始化状态下执行【F:contracts/library/AccessControl.py†L58-L94】。
- `Upgradeable` 的管理接口均在开头执行 `_only_initialised()` 检查【F:contracts/library/Upgradeable.py†L78-L149】；升级完成后这些函数无法再被调用，直到重新初始化。
- 只读方法如 `get_active_min_upgrade_delay`、`upgradable_admin_role` 同样未受初始化限制【F:contracts/library/Upgradeable.py†L173-L193】，但不会修改状态。
- **微断言**：若升级后长时间不初始化，持有旧角色的账户仍可以调用 `grant_role` 等接口修改角色映射，从而影响下一次初始化或后续权限管理。

### 2. 测试设计
- 部署旧版本 `SimpleUpgradeable` 并授予若干角色后，按测试脚本执行 `schedule_contract_upgrade` 与 `complete_contract_upgrade`，但暂不调用 `initialise`。
- 在此状态下尝试使用旧 `DEFAULT_ADMIN_ROLE` 调用 `grant_role` 或 `revoke_role`。根据代码推断，这些调用应成功并产生事件日志，与升级前行为一致。
- 再尝试调用 `schedule_contract_upgrade` 等函数则会因 `_only_initialised` 断言失败。
- **微断言**：测试若观察到角色仍可被修改，而升级相关函数全部拒绝执行，则证实权限过渡期间只有角色管理接口仍然开放。

### 3. 文档检查
- 仓库 `README.md` 仅描述安装、编译与测试流程，未提及升级后需立即重新初始化或限制调用的建议【F:README.md†L1-L60】。
- 由于网络限制，无法访问 DeepWiki 验证是否存在相关指导。
- **微断言**：缺乏官方文档提示可能导致开发者忽略升级窗口的角色管理风险。

## 结论

- **升级后旧角色依旧有效**：`complete_contract_upgrade` 不会清理 `AccessControl` 状态，旧角色可在未初始化期间继续授予或撤销权限。
- **潜在权限漂移**：若升级与重新初始化之间存在较长时间窗口，拥有旧角色的账户能够调整角色分配，可能影响新版本的初始配置。
- **建议**：在合约升级脚本或文档中强调应尽快重新初始化，并在需要时限制 `grant_role` 等接口在未初始化状态下的使用，或在 `initialise` 中清理/迁移旧角色映射。

综上，本次审计未发现直接的代码漏洞，但指出升级完成到重新初始化前的权限过渡期可能造成管理混乱。合理的初始化流程与文档提示能有效降低风险。
