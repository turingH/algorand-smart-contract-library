# AI 审计方案 - AccessControl 接口调用限制

## 已知前提
- `pk.md` 验证了 `RateLimiter` 的内部安全，本方案专注于 `AccessControl` 初始化前后的访问控制。

## 代码审查要点
1. **初始化检查**
   - 检查 `grant_role`、`revoke_role`、`renounce_role` 等接口是否都在函数开头调用 `_only_initialised`。
   - 审阅继承 `AccessControl` 的合约（如 `MockAccessControl`、`Upgradeable`），确认其新增的公开函数也遵循相同的初始化保护。
2. **部署流程审阅**
   - 查看部署脚本和文档，确认初始化步骤在部署后立刻执行，且不会被跳过。
3. **潜在绕过路径**
   - 搜索代码中是否存在可在初始化前调用的内部函数，或通过直接写 box/全局状态的方式绕过检查。
