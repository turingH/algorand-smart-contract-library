## AccessControl.__init__

📌 微断言：
A: 创建 `roles` BoxMap
B: 创建 `addresses_roles` BoxMap

🎯 路径组合：
G1 := A ∧ B

## AccessControl.grant_role

📌 微断言：
A: 调用 `get_role_admin(role)` 得到管理员角色
B: 调用 `_check_sender_role(admin_role)`
C: 调用 `_grant_role(role, account)`

🎯 路径组合：
G1 := A ∧ B ∧ C

## AccessControl.revoke_role

📌 微断言：
A: 调用 `get_role_admin(role)` 得到管理员角色
B: 调用 `_check_sender_role(admin_role)`
C: 调用 `_revoke_role(role, account)`

🎯 路径组合：
G1 := A ∧ B ∧ C

## AccessControl.renounce_role

📌 微断言：
A: 构造调用者地址 `Address(Txn.sender)`
B: 调用 `_revoke_role(role, caller_address)`

🎯 路径组合：
G1 := A ∧ B

## AccessControl.default_admin_role

📌 微断言：
A: 返回 16 字节的全零值

🎯 路径组合：
G1 := A

## AccessControl.has_role

📌 微断言：
A: 生成键 `address_role_key = _address_role_key(role, account)`
B: 判断键是否在 `addresses_roles`
C: 若存在则返回 `addresses_roles[address_role_key]`
D: 若不存在则返回 `Bool(False)`

🎯 路径组合：
G1 := A ∧ B ∧ C        (存在)
G2 := A ∧ ¬B ∧ D       (不存在)

## AccessControl.get_role_admin

📌 微断言：
A: 判断 `role` 是否在 `roles`
B: 若不在则返回 `default_admin_role()`
C: 若在则返回 `roles[role]`

🎯 路径组合：
G1 := A ∧ B        (未知角色)
G2 := A ∧ C        (已存在角色)

## AccessControl._set_role_admin

📌 微断言：
A: 调用 `get_role_admin(role)` 获取先前管理员角色
B: 设置 `roles[role] = admin_role.copy()`
C: 触发事件 `RoleAdminChanged`

🎯 路径组合：
G1 := A ∧ B ∧ C

## AccessControl._address_role_key

📌 微断言：
A: 返回结构 `AddressRoleKey(role.copy(), account)`

🎯 路径组合：
G1 := A

## AccessControl._check_sender_role

📌 微断言：
A: 取 `Address(Txn.sender)` 作为调用者地址
B: 调用 `_check_role(role, caller_address)`

🎯 路径组合：
G1 := A ∧ B

## AccessControl._check_role

📌 微断言：
A: 调用 `has_role(role, account)`
B: 断言结果为真，否则报错

🎯 路径组合：
G1 := A ∧ B

## AccessControl._grant_role

📌 微断言：
A: 判断 `role` 是否在 `roles`
B: 若不存在则设置 `roles[role] = default_admin_role()`
C: 判断 `has_role(role, account)`
D: 若无该角色则生成键并写入 `addresses_roles`
E: 触发事件 `RoleGranted`
F: 返回 `Bool(True)`
G: 若已有该角色则直接返回 `Bool(False)`

🎯 路径组合：
G1 := A ∧ ¬B ∧ C ∧ ¬D ∧ D ∧ E ∧ F   (新角色且账户没有角色)
G2 := A ∧ ¬B ∧ C ∧ D                (新角色但已拥有角色 -> 返回 False)
G3 := A ∧ B ∧ C ∧ ¬D ∧ D ∧ E ∧ F    (已存在角色且账户没有角色)
G4 := A ∧ B ∧ C ∧ D                 (已存在角色且账户已有角色)

## AccessControl._revoke_role

📌 微断言：
A: 调用 `has_role(role, account)`
B: 若有该角色则删除对应键
C: 触发事件 `RoleRevoked`
D: 返回 `Bool(True)`
E: 若无该角色则返回 `Bool(False)`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D      (成功撤销)
G2 := A ∧ ¬B ∧ E         (无需操作)

## Initialisable.__init__

📌 微断言：
A: 设置 `is_initialised = False`

🎯 路径组合：
G1 := A

## Initialisable.initialise

📌 微断言：
A: 判断 `not is_initialised`
B: 若条件满足则设置 `is_initialised = True`

🎯 路径组合：
G1 := A ∧ B        (第一次初始化)
G2 := ¬A           (已初始化，触发断言)

## Initialisable._only_initialised

📌 微断言：
A: 断言 `is_initialised` 为真

🎯 路径组合：
G1 := A

## InitialisableWithCreator.__init__

📌 微断言：
A: 调用 `Initialisable.__init__()`

🎯 路径组合：
G1 := A

## InitialisableWithCreator.initialise

📌 微断言：
A: 判断 `Txn.sender == Global.creator_address`
B: 调用 `Initialisable.initialise(self)`

🎯 路径组合：
G1 := A ∧ B       (由创建者调用)
G2 := ¬A          (非创建者调用，触发断言)

## RateLimiter.__init__

📌 微断言：
A: 创建 `rate_limit_buckets` BoxMap

🎯 路径组合：
G1 := A

## RateLimiter.get_current_capacity

📌 微断言：
A: 调用 `_update_capacity(bucket_id)`
B: 返回 `rate_limit_buckets[bucket_id].current_capacity`

🎯 路径组合：
G1 := A ∧ B

## RateLimiter.has_capacity

📌 微断言：
A: 调用 `_update_capacity(bucket_id)`
B: 取得 `rate_limit_bucket = _get_bucket(bucket_id)`
C: 判断 `rate_limit_bucket.duration.native == 0`
D: 若为零返回 `Bool(True)`
E: 否则比较 `amount <= rate_limit_bucket.current_capacity`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D                     (无限容量)
G2 := A ∧ B ∧ ¬C ∧ E                   (有限容量)

## RateLimiter.get_rate_limit

📌 微断言：
A: 调用 `_check_bucket_known(bucket_id)`
B: 返回 `rate_limit_buckets[bucket_id].limit`

🎯 路径组合：
G1 := A ∧ B

## RateLimiter.get_rate_duration

📌 微断言：
A: 调用 `_check_bucket_known(bucket_id)`
B: 返回 `rate_limit_buckets[bucket_id].duration.native`

🎯 路径组合：
G1 := A ∧ B

## RateLimiter._add_bucket

📌 微断言：
A: 断言 `bucket_id` 不在 `rate_limit_buckets`
B: 创建 `RateLimitBucket` 并存入映射
C: 触发事件 `BucketAdded`

🎯 路径组合：
G1 := A ∧ B ∧ C

## RateLimiter._remove_bucket

📌 微断言：
A: 调用 `_check_bucket_known(bucket_id)`
B: 删除 `rate_limit_buckets[bucket_id]`
C: 触发事件 `BucketRemoved`

🎯 路径组合：
G1 := A ∧ B ∧ C

## RateLimiter._update_rate_limit

📌 微断言：
A: 调用 `_update_capacity(bucket_id)`
B: 获取 `rate_limit_bucket = _get_bucket(bucket_id)`
C: 判断 `new_limit.native < rate_limit_bucket.limit.native`
D: 若减少限额计算差值并更新容量不低于零
E: 若增加限额计算差值并增加容量
F: 设置 `current_capacity`
G: 更新 `limit`
H: 触发事件 `BucketRateLimitUpdated`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D ∧ F ∧ G ∧ H        (减小限额)
G2 := A ∧ B ∧ ¬C ∧ E ∧ F ∧ G ∧ H       (增加限额)

## RateLimiter._update_rate_duration

📌 微断言：
A: 调用 `_update_capacity(bucket_id)`
B: 更新 `duration` 为 `new_duration`
C: 触发事件 `BucketRateDurationUpdated`

🎯 路径组合：
G1 := A ∧ B ∧ C

## RateLimiter._consume_amount

📌 微断言：
A: 调用 `_update_capacity(bucket_id)`
B: 获取 `rate_limit_bucket = _get_bucket(bucket_id)`
C: 判断 `rate_limit_bucket.duration.native == 0`
D: 若为零直接返回
E: 判断 `amount <= rate_limit_bucket.current_capacity`
F: 计算 `new_capacity = current_capacity - amount`
G: 更新 `current_capacity`
H: 触发事件 `BucketConsumed`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D                         (无限桶直接结束)
G2 := A ∧ B ∧ ¬C ∧ E ∧ F ∧ G ∧ H            (正常消耗)

## RateLimiter._fill_amount

📌 微断言：
A: 调用 `_update_capacity(bucket_id)`
B: 获取 `rate_limit_bucket = _get_bucket(bucket_id)`
C: 判断 `rate_limit_bucket.duration.native == 0`
D: 若为零直接返回
E: 计算 `max_fill_amount = limit - current_capacity`
F: 计算 `fill_amount = min(amount, max_fill_amount)`
G: 更新 `current_capacity = current_capacity + fill_amount`
H: 触发事件 `BucketFilled`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D                             (无限桶)
G2 := A ∧ B ∧ ¬C ∧ E ∧ F ∧ G ∧ H                (正常填充)

## RateLimiter._update_capacity

📌 微断言：
A: 获取 `rate_limit_bucket = _get_bucket(bucket_id)`
B: 判断 `rate_limit_bucket.duration.native == 0`
C: 若为零直接返回
D: 计算 `time_delta = Global.latest_timestamp - last_updated`
E: 计算 `new_capacity_without_max = current_capacity + (limit * time_delta) // duration`
F: 若结果大于 `limit` 则设为 `limit` 否则用计算值
G: 更新 `last_updated = Global.latest_timestamp`

🎯 路径组合：
G1 := A ∧ B ∧ C                              (无限桶)
G2 := A ∧ ¬B ∧ D ∧ E ∧ F ∧ G                 (正常更新)

## RateLimiter._check_bucket_known

📌 微断言：
A: 断言 `bucket_id in rate_limit_buckets`

🎯 路径组合：
G1 := A

## RateLimiter._get_bucket

📌 微断言：
A: 调用 `_check_bucket_known(bucket_id)`
B: 返回 `rate_limit_buckets[bucket_id]`

🎯 路径组合：
G1 := A ∧ B

## Upgradeable.__init__

📌 微断言：
A: 调用 `AccessControl.__init__()`
B: 调用 `Initialisable.__init__()`
C: 创建 `min_upgrade_delay` 全局状态
D: 创建 `scheduled_contract_upgrade` 全局状态
E: 设置 `version = UInt64(1)`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D ∧ E

## Upgradeable.create

📌 微断言：
A: 设置 `min_upgrade_delay.value` 为 `(0, min_upgrade_delay, 0)`

🎯 路径组合：
G1 := A

## Upgradeable.update_min_upgrade_delay

📌 微断言：
A: 调用 `_only_initialised()`
B: 调用 `_check_sender_role(upgradable_admin_role())`
C: 调用 `_check_schedule_timestamp(timestamp)`
D: 判断 `Global.latest_timestamp >= min_upgrade_delay.value.timestamp`
E: 若满足则 `delay_0 = delay_1`
F: 设置 `delay_1 = min_upgrade_delay`
G: 设置 `timestamp` 字段
H: 触发事件 `MinimumUpgradeDelayChange`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D ∧ E ∧ F ∧ G ∧ H        (已激活延迟)
G2 := A ∧ B ∧ C ∧ ¬D ∧ F ∧ G ∧ H           (未激活延迟)

## Upgradeable.schedule_contract_upgrade

📌 微断言：
A: 调用 `_only_initialised()`
B: 调用 `_check_sender_role(upgradable_admin_role())`
C: 调用 `_check_schedule_timestamp(timestamp)`
D: 设置 `scheduled_contract_upgrade.value` 为 `(program_sha256.copy(), timestamp)`
E: 触发事件 `UpgradeScheduled`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D ∧ E

## Upgradeable.cancel_contract_upgrade

📌 微断言：
A: 调用 `_only_initialised()`
B: 调用 `_check_sender_role(upgradable_admin_role())`
C: 调用 `_check_upgrade_scheduled()`
D: 删除 `scheduled_contract_upgrade.value`
E: 触发事件 `UpgradeCancelled`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D ∧ E

## Upgradeable.complete_contract_upgrade

📌 微断言：
A: 调用 `_only_initialised()`
B: 调用 `_check_upgrade_scheduled()`
C: 取得 `scheduled_contract_upgrade` 副本
D: 断言 `Global.latest_timestamp >= scheduled_contract_upgrade.timestamp`
E: 构造当前程序的哈希 `program_sha256`
F: 断言 `scheduled_contract_upgrade.program_sha256 == program_sha256`
G: 删除 `scheduled_contract_upgrade.value`
H: `version += 1`
I: 设置 `is_initialised = False`
J: 触发事件 `UpgradeCompleted`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D ∧ E ∧ F ∧ G ∧ H ∧ I ∧ J

## Upgradeable.upgradable_admin_role

📌 微断言：
A: 返回 `Bytes16` 值为 `keccak256("UPGRADEABLE_ADMIN")` 的前 16 字节

🎯 路径组合：
G1 := A

## Upgradeable.get_active_min_upgrade_delay

📌 微断言：
A: 复制 `min_upgrade_delay` 为局部变量
B: 判断 `Global.latest_timestamp >= min_upgrade_delay.timestamp`
C: 若满足返回 `delay_1.native`
D: 否则返回 `delay_0.native`

🎯 路径组合：
G1 := A ∧ B ∧ C           (已生效)
G2 := A ∧ ¬B ∧ D          (未生效)

## Upgradeable._check_schedule_timestamp

📌 微断言：
A: 计算 `Global.latest_timestamp + get_active_min_upgrade_delay()`
B: 断言 `timestamp >= 计算结果`

🎯 路径组合：
G1 := A ∧ B

## Upgradeable._check_upgrade_scheduled

📌 微断言：
A: 调用 `scheduled_contract_upgrade.maybe()` 取存在标志
B: 断言存在标志为真

🎯 路径组合：
G1 := A ∧ B

## UInt64SetLib.has_item

📌 微断言：
A: 遍历 `items`
B: 若存在 `item.native == to_search` 则返回 `Bool(True)`
C: 循环结束后返回 `Bool(False)`

🎯 路径组合：
G1 := A ∧ B      (找到)
G2 := A ∧ C      (未找到)

## UInt64SetLib.add_item

📌 微断言：
A: 遍历 `items` 检查是否已存在 `to_add`
B: 若已存在则返回 `(Bool(False), items.copy())`
C: 若不存在则 `items.append(ARC4UInt64(to_add))`
D: 返回 `(Bool(True), items.copy())`

🎯 路径组合：
G1 := A ∧ B             (已存在)
G2 := A ∧ ¬B ∧ C ∧ D    (新增)

## UInt64SetLib.remove_item

📌 微断言：
A: 计算 `last_idx = items.length - 1`
B: 遍历 `uenumerate(items)`
C: 若 `item.native == to_remove` 则弹出最后元素
D: 若索引不等于 `last_idx` 则用弹出的元素替换当前位置
E: 返回 `(Bool(True), items.copy())`
F: 循环结束后返回 `(Bool(False), items.copy())`

🎯 路径组合：
G1 := A ∧ B ∧ C ∧ D ∧ E     (找到并删除)
G2 := A ∧ B ∧ F             (未找到)
