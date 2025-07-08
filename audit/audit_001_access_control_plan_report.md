# 审计报告：权限管理与升级机制安全性分析

## 执行摘要

本次审计依据 `audit_001_access_control_plan.md` 的流程，对 `AccessControl.py`、`Upgradeable.py` 及其初始化机制进行了静态代码审查。通过逻辑推导和代码逐行分析，确认存在以下主要风险：

1. `default_admin_role` 为自身管理员，若所有持有者放弃权限，合约将不可管理。
2. `complete_contract_upgrade` 允许任何人调用，且升级后将 `is_initialised` 重置，可能导致权限丢失。
3. 初始化依赖子合约实现，若调用顺序或逻辑错误，可能导致权限未正确分配。
4. `_set_role_admin` 为内部函数但无权限检查，若子合约暴露入口，角色层级可被任意修改。

以下为详细分析与推导。

## 详细发现

### 1. `default_admin_role` 循环依赖风险
- 代码位置：`AccessControl.py` `renounce_role` 中直接调用 `_revoke_role`【F:contracts/library/AccessControl.py†L86-L93】。
- `default_admin_role` 返回全零 bytes，且默认作为所有角色的管理员【F:contracts/library/AccessControl.py†L95-L129】。
- **微断言**：若所有默认管理员均调用 `renounce_role(default_admin_role)`，`roles` 映射仍然指向 `default_admin_role`，但无账户再持有该角色 → 合约失去管理入口。

- 人工评判：误报，官方设计意图。

### 2. 升级流程权限缺失
- `complete_contract_upgrade` 标记 `allow_actions=["UpdateApplication"]`，内部未调用任何权限检查【F:contracts/library/Upgradeable.py†L139-L171】。
- 升级完成后 `self.is_initialised = False`，需要重新调用 `initialise` 才能恢复权限【F:contracts/library/Upgradeable.py†L166-L170】。
- **微断言**：恶意用户若能在升级时间到达后提交任意程序且满足哈希检查，即可触发升级并重置初始化标记，导致合约暂时处于无人管理状态。

- 结论 ：
* complete_contract_upgrade 无权限检查属于预期设计，安全性依赖于前置的 schedule_contract_upgrade 流程与 SHA-256 校验。
* is_initialised = False 同样是设计需求，为新版本留出“二次部署”逻辑空间。
* 现实现中主要风险是 DoS（暂停服务），而非资产失控；管理员应在升级生效后及时执行 initialise。
* 如将来子合约增加资产转移逻辑，务必确认相关方法在未初始化状态下不可被调用，或仍有角色/资金双重保护。


### 3. 初始化逻辑依赖子类实现
- `Initialisable.initialise` 仅检查 `is_initialised`，无权限限制【F:contracts/library/Initialisable.py†L46-L59】。
- Library 提供的 `InitialisableWithCreator` 扩展示例显示，子合约应自行校验调用者是否为合约创建者【F:contracts/library/extensions/InitialisableWithCreator.py†L1-L27】。
- **微断言**：若子合约未正确实现调用者校验，在升级后重新初始化时可能被非预期账户执行，造成权限分配错误。

- 结论
“缺少调用者校验”是库的可扩展设计，并非库级漏洞。
但是每一个继承 Initialisable 的子合约都必须被单独审查其 initialise 实现是否包含充分的权限控制；若缺少相关子合约源码，应标注为“依赖代码缺失，无法验证调用者校验逻辑”。

### 4. `_set_role_admin` 无显式权限控制
- `_set_role_admin` 为内部函数，未检查调用者权限【F:contracts/library/AccessControl.py†L132-L142】。
- 测试用合约 `MockAccessControl.set_role_admin` 直接暴露此函数【F:contracts/library/test/MockAccessControl.py†L17-L20】。
- **微断言**：若生产合约以类似方式暴露入口，则任何调用者都可更改角色管理员，破坏权限层次。

结论：
这是库作者的设计选择：将 _set_role_admin 作为不检查权限的内部原语，供派生合约在必要时调用。
只有在派生合约主动对外公开、且未加限制时才会构成安全缺陷。
因此，当前库层面的实现符合预期设计；风险主要取决于后续使用者的暴露方式与权限防护。

