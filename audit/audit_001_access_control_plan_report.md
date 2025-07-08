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

### 2. 升级流程权限缺失
- `complete_contract_upgrade` 标记 `allow_actions=["UpdateApplication"]`，内部未调用任何权限检查【F:contracts/library/Upgradeable.py†L139-L171】。
- 升级完成后 `self.is_initialised = False`，需要重新调用 `initialise` 才能恢复权限【F:contracts/library/Upgradeable.py†L166-L170】。
- **微断言**：恶意用户若能在升级时间到达后提交任意程序且满足哈希检查，即可触发升级并重置初始化标记，导致合约暂时处于无人管理状态。

### 3. 初始化逻辑依赖子类实现
- `Initialisable.initialise` 仅检查 `is_initialised`，无权限限制【F:contracts/library/Initialisable.py†L46-L59】。
- Library 提供的 `InitialisableWithCreator` 扩展示例显示，子合约应自行校验调用者是否为合约创建者【F:contracts/library/extensions/InitialisableWithCreator.py†L1-L27】。
- **微断言**：若子合约未正确实现调用者校验，在升级后重新初始化时可能被非预期账户执行，造成权限分配错误。

### 4. `_set_role_admin` 无显式权限控制
- `_set_role_admin` 为内部函数，未检查调用者权限【F:contracts/library/AccessControl.py†L132-L142】。
- 测试用合约 `MockAccessControl.set_role_admin` 直接暴露此函数【F:contracts/library/test/MockAccessControl.py†L17-L20】。
- **微断言**：若生产合约以类似方式暴露入口，则任何调用者都可更改角色管理员，破坏权限层次。

## 攻击场景概述

1. **管理员权限丢失**：所有默认管理员放弃角色后，任何权限管理操作均无法执行，合约永久失去控制权。
2. **升级时权限真空**：攻击者等待合法升级时间到达，调用 `complete_contract_upgrade` 重置 `is_initialised`，在开发者重新初始化前对合约实施进一步操作或阻止重新初始化。
3. **恶意初始化**：若子合约在升级后自动调用 `initialise` 且未限制发送者，攻击者可在升级完成后立刻重新初始化，自行赋予管理员权限。

## 修复建议

1. **关键角色保护**：在 `renounce_role` 中对 `default_admin_role` 增加剩余管理员检查，或引入多签机制确保至少一名管理员存在。
2. **升级权限校验**：在 `complete_contract_upgrade` 增加仅允许 `upgradable_admin_role` 调用的检查，并在升级完成后自动恢复管理员角色。
3. **初始化限制**：官方文档中强调在子合约 `initialise` 方法内校验发送者，应提供库级别的强制检查或模板实现，减少实现错误。
4. **限制 `_set_role_admin` 使用**：在文档中明确此函数仅供内部使用，并建议所有可变更管理员的接口都进行权限检查。

## 测试情况

执行 `npm run test` 时，由于环境缺少 `jest` 依赖，测试未能运行成功【ccd82e†L1-L5】。

Codex couldn't run certain commands due to environment limitations. Consider configuring a setup script or internet access in your Codex environment to install dependencies.

