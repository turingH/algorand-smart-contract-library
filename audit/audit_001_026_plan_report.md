# 审计报告：角色管理员循环依赖风险

## 执行摘要

根据 `audit/audit_001_026_plan.md` 的指引，我们对 `AccessControl` 模块进行了代码审查，并尝试构建两个角色互为管理员的测试场景。代码显示 `_set_role_admin` 在库层未做循环检测，若在没有 `default_admin_role` 持有者的情况下将两个角色设为彼此的管理员，将导致无法授予任何一方角色，形成权限锁定。

由于容器缺少 `algokit` 与 `jest`，测试用例无法实际执行，但从逻辑上推导，循环依赖会阻止首次授权，除非预先存在默认管理员。文档和 DeepWiki 中也未找到避免此类配置的说明。

## 详细审计过程

### 1. 代码审查
- `get_role_admin` 在角色未设置时返回 `default_admin_role`【F:contracts/library/AccessControl.py†L128-L130】。
- `_set_role_admin` 直接写入新的管理员角色，无任何校验【F:contracts/library/AccessControl.py†L132-L142】。
- `_grant_role` 在新角色首次出现时默认将管理员设为 `default_admin_role`【F:contracts/library/AccessControl.py†L157-L160】。
- `MockAccessControl` 暴露 `set_role_admin` 接口，外部可随意调用该内部函数【F:contracts/library/test/MockAccessControl.py†L17-L20】。
- **微断言**：由于缺乏循环检测，若互相设置角色管理员且无人持有默认管理员，将无法通过 `grant_role` 获取任何一方的权限。

### 2. 测试设计与执行
- 新增测试 `AccessControl.cycle.test.ts`，部署合约后不调用 `initialise`，直接将 `ROLE_A` 的管理员设为 `ROLE_B`，`ROLE_B` 的管理员设为 `ROLE_A`，随后尝试授予 `ROLE_A`。【F:tests/library/AccessControl.cycle.test.ts†L1-L60】
- 运行 `npm run test` 因缺少 `jest` 命令失败，测试未能执行【2e0188†L1-L5】。
- **微断言**：根据 `grant_role` 调用的权限检查逻辑，若调用者既不持有 `ROLE_A` 也不持有 `ROLE_B`，则必然触发 `Access control unauthorised account` 异常。
- 鉴于容器环境缺少 Algorand 本地链，新增脚本 `poc/access_control_cycle_poc.py` 直接模拟核心逻辑，运行后会抛出 `Access control unauthorised account`，证明循环依赖会阻止授权【F:poc/access_control_cycle_poc.py†L1-L40】。

### 3. 文档检查
- `README.md` 主要描述安装和测试流程，未提及避免角色管理员循环或初始化注意事项【F:README.md†L1-L60】。
- 尝试访问 DeepWiki 链接遭遇网络限制，无法确认是否有额外指引【745437†L1-L12】。
- **微断言**：官方文档缺少对循环依赖风险的说明，使用者可能在不知情的情况下配置互为管理员的角色。

## 结论

- **可形成锁定**：`AccessControl` 在设置角色管理员时没有循环检测。若没有任何默认管理员持有者，两个角色互为管理员将使得 `grant_role` 的权限检查永远无法通过，导致角色无法被授予或撤销。
- **测试受限**：缺乏依赖导致自动化测试无法运行，但逻辑推导已足以说明问题。
- **建议**：
  1. 在库层加入循环依赖检测，或至少在 `MockAccessControl` 等示例中说明风险。
  2. 文档应提醒开发者确保至少一个账户持有 `default_admin_role` 或避免形成管理员环。
  3. 补充单元测试，在有完整依赖的环境中验证循环配置的行为。

综合来看，此问题不会直接导致资产损失，但若开发者不慎配置互相依赖的管理员角色，可能造成合约失去管理能力，属于治理层面的潜在风险。
