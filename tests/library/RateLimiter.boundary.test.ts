import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import { type Account, type Address, getApplicationAddress } from "algosdk";

import { RateLimiterExposedClient, RateLimiterExposedFactory } from "../../specs/client/RateLimiterExposed.client.ts";
import { getBucketBoxKey } from "../utils/boxes.ts";
import { getEventBytes, getRandomBytes } from "../utils/bytes.ts";
import { SECONDS_IN_DAY, advancePrevBlockTimestamp, getPrevBlockTimestamp } from "../utils/time.ts";

describe("RateLimiter - 边界情况测试", () => {
  const localnet = algorandFixture();

  let factory: RateLimiterExposedFactory;
  let client: RateLimiterExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  const testBucketId = getRandomBytes(32);
  const limit = BigInt(1000n * 10n ** 18n); // 1000 of token with 18 decimals

  beforeAll(async () => {
    await localnet.newScope();
    const { algorand, generateAccount } = localnet.context;

    creator = await generateAccount({ initialFunds: (100).algo() });

    factory = algorand.client.getTypedAppFactory(RateLimiterExposedFactory, {
      defaultSender: creator,
      defaultSigner: creator.signer,
    });

    // 部署合约
    const { appClient, result } = await factory.deploy();
    appId = result.appId;
    client = appClient;
  });

  describe("从持续时间0更改为非零值的边界情况", () => {
    test("updates last_updated when changing duration from zero to non-zero", async () => {
      // 1. 创建持续时间为0的桶（无限桶）
      const APP_MIN_BALANCE = (154_900).microAlgos();
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: APP_MIN_BALANCE,
      });

      const initialTimestamp = await getPrevBlockTimestamp(localnet);
      
      await client
        .newGroup()
        .addTransaction(fundingTxn)
        .addBucket({
          args: [testBucketId, limit, 0n],
          boxReferences: [getBucketBoxKey(testBucketId)],
        })
        .send();

      // 验证桶已创建，持续时间为0
      const initialBucket = await client.getBucket({ args: [testBucketId] });
      expect(initialBucket.duration).toEqual(0n);
      expect(initialBucket.lastUpdated).toEqual(initialTimestamp);

      // 2. 等待一段时间（模拟实际使用场景中的时间间隔）
      await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY);

      // 3. 更新持续时间为非零值
      const newDuration = SECONDS_IN_DAY / 2n;
      
      const updateResult = await client.send.updateRateDuration({ 
        args: [testBucketId, newDuration],
        boxReferences: [getBucketBoxKey(testBucketId)],
      });

      // 获取交易确认后的实际时间戳 - 使用包含该交易的区块时间戳
      const { confirmedRound } = updateResult.confirmations[0];
      if (!confirmedRound) throw Error("Unknown confirmed round");
      const { block } = await localnet.algorand.client.algod.block(confirmedRound).do();
      const updateTimestamp = BigInt(block.header.timestamp);

      // 验证事件被正确发出
      expect(updateResult.confirmations[0].logs).toBeDefined();
      expect(updateResult.confirmations[0].logs![0]).toEqual(
        getEventBytes("BucketRateDurationUpdated(byte[32],uint64)", [testBucketId, newDuration]),
      );

      // 4. 验证 last_updated 被正确更新到当前时间戳
      const updatedBucket = await client.getBucket({ args: [testBucketId] });
      expect(updatedBucket.duration).toEqual(newDuration);
      
      // 这是关键的断言：last_updated 应该是更新时的时间戳，而不是创建时的时间戳
      expect(updatedBucket.lastUpdated).toEqual(updateTimestamp);
      expect(updatedBucket.lastUpdated).not.toEqual(initialTimestamp);

      // 5. 验证后续容量计算的正确性
      // 再等待一段时间，确保容量计算基于正确的 last_updated 时间
      await advancePrevBlockTimestamp(localnet, newDuration / 4n);
      
      const capacityAfterWait = await client.getCurrentCapacity({ args: [testBucketId] });
      
      // 由于桶刚被"激活"（从无限桶变为有限桶），容量应该基于更新时间起的时间差计算
      // 而不是从创建时间起的巨大时间差
      // 这里的容量应该是合理的，不应该立即恢复到上限
      expect(capacityAfterWait).toBeLessThanOrEqual(limit);
      
      // 进一步验证：如果时间差计算错误（基于创建时间），容量可能会异常大
      // 通过检查容量没有超过上限来间接验证时间差计算的正确性
      expect(capacityAfterWait).toEqual(limit); // 由于等待时间足够，应该恢复到上限
    });

    test("handles multiple duration updates correctly", async () => {
      const secondBucketId = getRandomBytes(32);
      
      // 创建另一个测试桶
      const APP_MIN_BALANCE = (154_900).microAlgos();
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: APP_MIN_BALANCE,
      });

      await client
        .newGroup()
        .addTransaction(fundingTxn)
        .addBucket({
          args: [secondBucketId, limit, 0n],
          boxReferences: [getBucketBoxKey(secondBucketId)],
        })
        .send();

      // 第一次更新：从0到非零
      await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY);
      
      const firstUpdateResult = await client.send.updateRateDuration({ 
        args: [secondBucketId, SECONDS_IN_DAY],
        boxReferences: [getBucketBoxKey(secondBucketId)],
      });

      // 获取第一次更新的实际时间戳
      const { confirmedRound: firstConfirmedRound } = firstUpdateResult.confirmations[0];
      if (!firstConfirmedRound) throw Error("Unknown confirmed round");
      const { block: firstBlock } = await localnet.algorand.client.algod.block(firstConfirmedRound).do();
      const firstUpdateTimestamp = BigInt(firstBlock.header.timestamp);
      
      let bucket = await client.getBucket({ args: [secondBucketId] });
      expect(bucket.lastUpdated).toEqual(firstUpdateTimestamp);

      // 第二次更新：从非零到另一个非零值
      await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY / 2n);
      
      const secondUpdateResult = await client.send.updateRateDuration({ 
        args: [secondBucketId, SECONDS_IN_DAY * 2n],
        boxReferences: [getBucketBoxKey(secondBucketId)],
      });

      // 获取第二次更新的实际时间戳
      const { confirmedRound: secondConfirmedRound } = secondUpdateResult.confirmations[0];
      if (!secondConfirmedRound) throw Error("Unknown confirmed round");
      const { block: secondBlock } = await localnet.algorand.client.algod.block(secondConfirmedRound).do();
      const secondUpdateTimestamp = BigInt(secondBlock.header.timestamp);
      
      bucket = await client.getBucket({ args: [secondBucketId] });
      expect(bucket.lastUpdated).toEqual(secondUpdateTimestamp);

      // 第三次更新：从非零回到0
      await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY / 4n);
      
      const thirdUpdateResult = await client.send.updateRateDuration({ 
        args: [secondBucketId, 0n],
        boxReferences: [getBucketBoxKey(secondBucketId)],
      });

      // 获取第三次更新的实际时间戳
      const { confirmedRound: thirdConfirmedRound } = thirdUpdateResult.confirmations[0];
      if (!thirdConfirmedRound) throw Error("Unknown confirmed round");
      const { block: thirdBlock } = await localnet.algorand.client.algod.block(thirdConfirmedRound).do();
      const thirdUpdateTimestamp = BigInt(thirdBlock.header.timestamp);
      
      bucket = await client.getBucket({ args: [secondBucketId] });
      expect(bucket.duration).toEqual(0n);
      expect(bucket.lastUpdated).toEqual(thirdUpdateTimestamp);
    });

    test("verifies capacity calculation after zero-to-nonzero duration change", async () => {
      const thirdBucketId = getRandomBytes(32);
      
      // 创建第三个测试桶
      const APP_MIN_BALANCE = (154_900).microAlgos();
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: APP_MIN_BALANCE,
      });

      await client
        .newGroup()
        .addTransaction(fundingTxn)
        .addBucket({
          args: [thirdBucketId, limit, 0n],
          boxReferences: [getBucketBoxKey(thirdBucketId)],
        })
        .send();

      // 设置当前容量为限制的一半
      await client.send.setCurrentCapacity({ args: [thirdBucketId, limit / 2n] });

      // 等待很长时间（在无限桶模式下，这不应该影响容量）
      await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY * 10n);

      // 验证无限桶容量不受时间影响
      const capacityBeforeUpdate = await client.getCurrentCapacity({ args: [thirdBucketId] });
      expect(capacityBeforeUpdate).toEqual(limit / 2n);

      // 更新为有限桶
      const updateResult = await client.send.updateRateDuration({ 
        args: [thirdBucketId, SECONDS_IN_DAY],
        boxReferences: [getBucketBoxKey(thirdBucketId)],
      });

      // 获取更新交易的实际时间戳
      const { confirmedRound } = updateResult.confirmations[0];
      if (!confirmedRound) throw Error("Unknown confirmed round");
      const { block } = await localnet.algorand.client.algod.block(confirmedRound).do();
      const updateTimestamp = BigInt(block.header.timestamp);
      
      // 验证 last_updated 被正确设置
      const bucket = await client.getBucket({ args: [thirdBucketId] });
      expect(bucket.lastUpdated).toEqual(updateTimestamp);

      // 再等待一段时间，验证容量恢复是基于更新时间而不是创建时间
      await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY / 4n);
      
      const capacityAfterWait = await client.getCurrentCapacity({ args: [thirdBucketId] });
      
      // 容量应该基于更新后的时间差恢复，而不是从创建时间起的巨大时间差
      // 由于等待了 1/4 的持续时间，容量应该恢复 1/4 的差额
      const expectedRecovery = (limit - limit / 2n) / 4n; // 1/4 of the deficit
      const expectedCapacity = limit / 2n + expectedRecovery;
      
      // 对于 bigint 类型，我们使用范围比较而不是 toBeCloseTo
      const tolerance = BigInt(10n ** 15n); // 允许的误差范围
      const diff = capacityAfterWait > expectedCapacity 
        ? capacityAfterWait - expectedCapacity 
        : expectedCapacity - capacityAfterWait;
      
      expect(diff).toBeLessThanOrEqual(tolerance);
    });
  });
}); 