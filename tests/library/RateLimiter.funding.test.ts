import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import { type Account, type Address, getApplicationAddress } from "algosdk";

import { RateLimiterExposedClient, RateLimiterExposedFactory } from "../../specs/client/RateLimiterExposed.client.ts";
import { getBucketBoxKey } from "../utils/boxes.ts";
import { getRandomBytes } from "../utils/bytes.ts";
import { SECONDS_IN_DAY } from "../utils/time.ts";

describe("RateLimiter - 资金依赖审计测试", () => {
  const localnet = algorandFixture();

  let factory: RateLimiterExposedFactory;
  let client: RateLimiterExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  const limit = BigInt(1000n * 10n ** 18n); // 1000 代币，18位小数
  const duration = SECONDS_IN_DAY;

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

    expect(appId).not.toEqual(0n);
  });

  describe("资金不足场景测试", () => {
    test("验证资金不足时 add_bucket 会失败", async () => {
      console.log("🔍 测试资金不足场景");

      const testBucketId = getRandomBytes(32);
      
      // 故意提供不足的资金 - 远小于正常需要的 154,900 microAlgos
      const INSUFFICIENT_BALANCE = (50_000).microAlgos(); // 约一半的正常资金
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: INSUFFICIENT_BALANCE,
      });

      console.log(`   💰 提供资金: ${INSUFFICIENT_BALANCE.microAlgos} microAlgos (不足)`);

      // 尝试添加桶，预期失败
      await expect(
        client
          .newGroup()
          .addTransaction(fundingTxn)
          .addBucket({
            args: [testBucketId, limit, duration],
            boxReferences: [getBucketBoxKey(testBucketId)],
          })
          .send()
      ).rejects.toThrow();

      console.log("   ✅ 确认：资金不足时交易失败");

      // 验证桶未被创建
      await expect(
        client.getBucket({ args: [testBucketId] })
      ).rejects.toThrow("Unknown bucket");

      console.log("   ✅ 确认：桶未被创建，状态保持一致");
    });

    test("验证零资金时 add_bucket 会失败", async () => {
      console.log("🔍 测试零资金场景");

      const testBucketId = getRandomBytes(32);
      
      // 不提供任何资金，直接尝试添加桶
      await expect(
        client.send.addBucket({
          args: [testBucketId, limit, duration],
          boxReferences: [getBucketBoxKey(testBucketId)],
        })
      ).rejects.toThrow();

      console.log("   ✅ 确认：零资金时交易失败");

      // 验证桶未被创建
      await expect(
        client.getBucket({ args: [testBucketId] })
      ).rejects.toThrow("Unknown bucket");

      console.log("   ✅ 确认：桶未被创建，状态保持一致");
    });

    test("验证充足资金时 add_bucket 成功", async () => {
      console.log("🔍 测试充足资金场景");

      const testBucketId = getRandomBytes(32);
      
      // 提供充足的资金
      const SUFFICIENT_BALANCE = (154_900).microAlgos(); // 正常的资金量
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: SUFFICIENT_BALANCE,
      });

      console.log(`   💰 提供资金: ${SUFFICIENT_BALANCE.microAlgos} microAlgos (充足)`);

      // 添加桶应该成功
      const result = await client
        .newGroup()
        .addTransaction(fundingTxn)
        .addBucket({
          args: [testBucketId, limit, duration],
          boxReferences: [getBucketBoxKey(testBucketId)],
        })
        .send();

      console.log("   ✅ 确认：充足资金时交易成功");

      // 验证桶已被创建
      const bucket = await client.getBucket({ args: [testBucketId] });
      expect(bucket.limit).toEqual(limit);
      expect(bucket.duration).toEqual(duration);
      expect(bucket.currentCapacity).toEqual(limit);

      console.log("   ✅ 确认：桶已正确创建");
    });

    test("验证临界资金量测试", async () => {
      console.log("🔍 测试临界资金量");

      const testBucketId = getRandomBytes(32);
      
      // 测试比正常资金略少的金额
      const BORDERLINE_BALANCE = (154_000).microAlgos(); // 比正常少900 microAlgos
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: BORDERLINE_BALANCE,
      });

      console.log(`   💰 提供资金: ${BORDERLINE_BALANCE.microAlgos} microAlgos (临界)`);

      // 这可能成功也可能失败，取决于具体的最小余额要求
      try {
        await client
          .newGroup()
          .addTransaction(fundingTxn)
          .addBucket({
            args: [testBucketId, limit, duration],
            boxReferences: [getBucketBoxKey(testBucketId)],
          })
          .send();
        
        console.log("   ℹ️  临界资金量：交易成功");
        
        // 验证桶已被创建
        const bucket = await client.getBucket({ args: [testBucketId] });
        expect(bucket.limit).toEqual(limit);
        console.log("   ✅ 确认：桶已正确创建");
      } catch (error) {
        console.log("   ℹ️  临界资金量：交易失败");
        console.log(`   📋 错误信息: ${error}`);
        
        // 验证桶未被创建
        await expect(
          client.getBucket({ args: [testBucketId] })
        ).rejects.toThrow("Unknown bucket");
        console.log("   ✅ 确认：桶未被创建，状态保持一致");
      }
    });
  });

  describe("连续添加桶的资金测试", () => {
    test("验证连续添加多个桶的资金需求", async () => {
      console.log("🔍 测试连续添加多个桶");

      const bucketIds = [
        getRandomBytes(32),
        getRandomBytes(32),
        getRandomBytes(32),
      ];

      // 为每个桶提供资金
      const BALANCE_PER_BUCKET = (154_900).microAlgos();
      
      for (let i = 0; i < bucketIds.length; i++) {
        const fundingTxn = await localnet.algorand.createTransaction.payment({
          sender: creator,
          receiver: getApplicationAddress(appId),
          amount: BALANCE_PER_BUCKET,
        });

        console.log(`   💰 为桶 ${i + 1} 提供资金: ${BALANCE_PER_BUCKET.microAlgos} microAlgos`);

        await client
          .newGroup()
          .addTransaction(fundingTxn)
          .addBucket({
            args: [bucketIds[i], limit, duration],
            boxReferences: [getBucketBoxKey(bucketIds[i])],
          })
          .send();

        // 验证桶已被创建
        const bucket = await client.getBucket({ args: [bucketIds[i]] });
        expect(bucket.limit).toEqual(limit);
        console.log(`   ✅ 桶 ${i + 1} 创建成功`);
      }

      console.log("   ✅ 所有桶创建成功");
    });

    test("验证一次性为多个桶提供资金", async () => {
      console.log("🔍 测试一次性为多个桶提供资金");

      const bucketIds = [
        getRandomBytes(32),
        getRandomBytes(32),
      ];

      // 一次性提供多个桶的资金
      const TOTAL_BALANCE = (154_900 * 2).microAlgos();
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: TOTAL_BALANCE,
      });

      console.log(`   💰 一次性提供资金: ${TOTAL_BALANCE.microAlgos} microAlgos`);

      await client
        .newGroup()
        .addTransaction(fundingTxn)
        .addBucket({
          args: [bucketIds[0], limit, duration],
          boxReferences: [getBucketBoxKey(bucketIds[0])],
        })
        .send();

      console.log("   ✅ 第一个桶创建成功");

      // 第二个桶不需要额外资金，应该可以直接创建
      await client.send.addBucket({
        args: [bucketIds[1], limit, duration],
        boxReferences: [getBucketBoxKey(bucketIds[1])],
      });

      console.log("   ✅ 第二个桶创建成功（使用剩余资金）");

      // 验证两个桶都已创建
      for (let i = 0; i < bucketIds.length; i++) {
        const bucket = await client.getBucket({ args: [bucketIds[i]] });
        expect(bucket.limit).toEqual(limit);
      }

      console.log("   ✅ 所有桶验证成功");
    });
  });
}); 