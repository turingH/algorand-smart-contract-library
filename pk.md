# Verified Knowledge - RateLimiter 

The following aspects of `contracts/library/RateLimiter.py` have been audited and confirmed as safe. Future audit plans can skip re-validating these points unless code changes are introduced.

1. `_update_capacity()` uses `ARC4UInt256` and `ARC4UInt64` types which are safe for 256-bit and 64-bit operations.
2. Multiplication `(limit * time_delta)` relies on algopy `BigUInt` operations which handle up to 512-bit results, preventing overflow when `limit` and `time_delta` are at their maximums.
3. Division by `duration` ensures the result cannot exceed `limit * time_delta`, and the final capacity is clamped to `limit`.
4. Existing tests (`tests/library/RateLimiter.test.ts`) exercise extreme values (e.g., `MAX_UINT256` and `MAX_INT64`) and pass without overflow errors.
5. The function contains logical guards such as early return on zero duration and capping capacity to `limit`.
6. All entry points that call `_update_capacity()` first verify bucket existence through `_get_bucket()`.
7. No numeric overflow vulnerabilities were found under current implementation and type guarantees.
8. A bucket with duration `0` effectively has infinite capacity. When its duration is later updated to a non-zero value, `_update_capacity()` clamps `current_capacity` to the bucket's `limit`. The `last_updated` timestamp may remain unchanged, but this has no effect on capacity calculations because `current_capacity` cannot exceed `limit`.


9. `RateLimiterExposed` in `contracts/library/test` exposes internal bucket-management methods only for unit testing and is not part of the production API. It should not be used as an example of a real deployment.

## Additional Verified Assertions

10. **TRUE**: `_update_rate_limit` always clamps capacity to the new `limit`; earlier reports of exceeding the limit were false.
11. **TRUE**: Switching a bucket from infinite to finite duration correctly limits capacity, refuting previous overflow concerns.
12. **TRUE**: Alleged permission gaps in `AccessControl` and `Upgradeable` stem from intended design and are not library vulnerabilities.
13. **TRUE**: The minimum upgrade delay logic cannot be bypassed via `delay_0`/`delay_1` switching.
14. **TRUE**: RateLimiter bucket creation has high storage cost but the interface is not publicly exposed, so DoS via bucket spam is unlikely.
15. **TRUE**: `Initialisable` prevents reinitialisation; transactions execute sequentially ensuring `initialise` succeeds only once.
16. **TRUE**: `UInt64SetLib` operates safely with up to 511 items without stack or fee issues.
17. **TRUE**: Upgradeable contract hash validation correctly concatenates pages, preventing tampered upgrades.
18. **TRUE**: Timestamp overflow during upgrade scheduling is practically impossible under 64‑bit limits.
19. **TRUE**: Role identifiers truncated from `keccak256` have negligible collision probability.
20. **TRUE**: Recreating a deleted rate-limit bucket restores full capacity but the function is not exposed externally.
21. **TRUE**: `InitialisableWithCreator` protects against upgrade initialisation races.
22. **TRUE**: Rescheduling upgrades must satisfy the current minimum delay and cannot accelerate execution.
23. **TRUE**: Creator-limited initialisation checks are adequate; only documentation and tests were advised.
24. **TRUE**: Old roles persist after upgrades, which may require manual cleanup but is not an intrinsic vulnerability.
25. **TRUE**: Boxes and global variables remain after upgrades unless explicitly cleared, consuming minimum balance.
26. **TRUE**: During pre-initialisation of an upgrade, old roles can still grant or revoke permissions; operational procedures must account for this.

## Recent Audit Conclusions – No Vulnerabilities Found

27. **TRUE**: `AccessControl` and `RateLimiter` use unique `BoxMap` prefixes, ensuring state isolation; upgrades do not remove old prefixes automatically.
28. **TRUE**: The upgrade process lacks schema compatibility checks; developers must handle state migrations manually.
29. **TRUE**: Looping over program pages in upgrades relies on transaction-supplied counts, but protocol size limits prevent DoS.
30. **TRUE**: The `default_admin_role` constant cannot be abused via ID collisions; only existing holders may grant or revoke it.

## Potential Risks Without Direct Exploit

31. **TRUE**: Roles granted before an upgrade remain valid afterwards and may not match new role definitions.
32. **TRUE**: The upgrade mechanism permits deploying older program versions, enabling unintended rollbacks if misused.
33. **TRUE**: Exposing internal bucket or role management functions could allow attackers to exhaust application balance.
34. **TRUE**: If every holder renounces `default_admin_role`, the contract becomes unmanageable.
35. **TRUE**: Granting roles requires sufficient application balance; insufficient funds cause transaction failure without partial writes.
36. **TRUE**: Changing `BoxMap` struct layouts without clearing existing data leads to misinterpreted values in new versions.
37. **TRUE**: Algopy implicitly persists attributes like `is_initialised` and `version` to global state; this behavior lacks documentation.

## Awaiting Manual Verification

38. **TRUE**: Cyclic administrator relationships can lock role assignment when no account holds `default_admin_role`.
39. **TRUE**: Altering `upgradable_admin_role` across upgrades invalidates old roles; developers must manage this transition themselves.
