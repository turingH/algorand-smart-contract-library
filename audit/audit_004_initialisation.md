# AI 审计方案 - AccessControl 初始化流程

## 已知前提
- `pk.md` 已确认 `RateLimiter` 的数值运算安全，除非有额外交互，此方案无需重复验证。

## 代码审查要点
1. **初始化一次性检查**
   - 在 `MockAccessControl.initialise` 及其他实现中确认 `super().initialise()` 被调用，避免多次初始化。
   - 排查所有对 `_only_initialised` 的引用，确保角色管理接口在初始化前无法调用。
2. **默认管理员写入**
   - 核对 `initialise` 函数传入的管理员地址来源，确认写入 `default_admin_role` 时不会出现零地址或重复赋权。
   - 查看 `_grant_role` 对盒子写入的实现，验证成功后事件是否正常发出。
3. **防止无管理员状态**
   - 若允许撤销或放弃 `default_admin_role`，确认代码是否阻止最后一个管理员被移除，或提供紧急恢复入口。
4. **部署脚本与文档**
   - 浏览部署脚本及说明文档，确保初始化步骤明确且必须执行。
