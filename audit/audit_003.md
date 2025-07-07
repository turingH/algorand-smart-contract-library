# AI 审计方案 - AccessControl 角色管理

## 已知前提
- `pk.md` 已审计 `RateLimiter` 的数值安全，本方案聚焦 `AccessControl` 自身的权限管理，不再重复数值检查。

## 审计思路
1. **初始化流程**
   - 确认 `initialise` 只允许调用一次并写入 `default_admin_role`，避免合约无管理员。
2. **管理员权限变更**
   - `_set_role_admin` 应仅在具有当前管理员权限的上下文中调用，并记录 `RoleAdminChanged` 事件。
3. **角色撤销与放弃**
   - `_revoke_role` 与 `renounce_role` 需防止最后一个管理员被移除，并确保事件触发一致。
4. **存储与费用管理**
   - 评估 `BoxMap` 存储开销及大规模操作对最低余额的影响，检查异常情况下是否会残留数据。
5. **角色 ID 设计**
   - 审查 16 字节哈希截断的碰撞概率以及代码中可能的重复角色定义。
6. **接口调用限制**
   - 所有公开接口应在调用前检查初始化状态，防止部署到初始化之间的滥用。

## 代码审查步骤
- 逐行阅读 `contracts/library/AccessControl.py` 与 `contracts/library/test/MockAccessControl.py`，按照上述思路记录潜在问题或改进点。
- 同时检查 `Upgradeable` 等继承模块是否正确使用 `AccessControl` 提供的接口。
