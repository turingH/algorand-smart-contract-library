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
