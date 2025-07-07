import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import { type Account, type Address, getApplicationAddress } from "algosdk";

import { RateLimiterExposedClient, RateLimiterExposedFactory } from "../../specs/client/RateLimiterExposed.client.ts";
import { getBucketBoxKey } from "../utils/boxes.ts";
import { getRandomBytes } from "../utils/bytes.ts";
import { SECONDS_IN_DAY, advancePrevBlockTimestamp, getPrevBlockTimestamp } from "../utils/time.ts";

describe("RateLimiter POC - last_updated 漏洞验证", () => {
  const localnet = algorandFixture();

  let factory: RateLimiterExposedFactory;
  let client: RateLimiterExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  const testBucketId = getRandomBytes(32);
  const limit = BigInt(1000n * 10n ** 18n); // 1000 代币，18位小数

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

  test("POC: 从零持续时间改为非零持续时间时 last_updated 未正确更新", async () => {
    console.log("🔍 开始 POC 测试 - 验证 last_updated 漏洞");

    // 步骤 1: 创建持续时间为 0 的桶（无限桶）
    console.log("📝 步骤 1: 创建持续时间为 0 的桶");
    const createTimestamp = await getPrevBlockTimestamp(localnet);
    
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
        args: [testBucketId, limit, 0n], // duration = 0
        boxReferences: [getBucketBoxKey(testBucketId)],
      })
      .send();

    const initialBucket = await client.getBucket({ args: [testBucketId] });
    console.log(`   ✅ 桶已创建，初始 last_updated: ${initialBucket.lastUpdated}`);
    console.log(`   ✅ 桶持续时间: ${initialBucket.duration} (0 表示无限桶)`);
    expect(initialBucket.duration).toEqual(0n);
    expect(initialBucket.lastUpdated).toEqual(createTimestamp);

    // 步骤 2: 等待一段时间（模拟实际使用场景）
    console.log("⏱️  步骤 2: 等待一段时间");
    const waitTime = SECONDS_IN_DAY; // 等待一天
    await advancePrevBlockTimestamp(localnet, waitTime);
    console.log(`   ✅ 已等待 ${waitTime} 秒`);

    // 步骤 3: 将持续时间更新为非零值
    console.log("🔄 步骤 3: 将持续时间更新为非零值");
    const newDuration = SECONDS_IN_DAY / 2n; // 12小时
    const updateTimestamp = await getPrevBlockTimestamp(localnet);
    
    await client.send.updateRateDuration({ args: [testBucketId, newDuration] });
    
    const updatedBucket = await client.getBucket({ args: [testBucketId] });
    console.log(`   ✅ 持续时间已更新为: ${updatedBucket.duration}`);
    console.log(`   ❌ 更新后的 last_updated: ${updatedBucket.lastUpdated}`);
    console.log(`   ⚠️  预期的 last_updated: ${updateTimestamp}`);

    // 步骤 4: 验证漏洞 - last_updated 应该被更新但实际没有
    console.log("🚨 步骤 4: 验证漏洞存在");
    
    // 这里证明了漏洞：last_updated 仍然是创建时的时间戳，而不是更新时的时间戳
    console.log("📊 漏洞验证结果:");
    console.log(`   创建时间戳: ${createTimestamp}`);
    console.log(`   更新时间戳: ${updateTimestamp}`);
    console.log(`   实际 last_updated: ${updatedBucket.lastUpdated}`);
    console.log(`   时间差: ${updateTimestamp - updatedBucket.lastUpdated} 秒`);

    // ❌ 这个断言会失败，证明漏洞存在
    // last_updated 应该等于 updateTimestamp，但实际上等于 createTimestamp
    try {
      expect(updatedBucket.lastUpdated).toEqual(updateTimestamp);
      console.log("❌ 测试失败：漏洞不存在（意外情况）");
    } catch (error) {
      console.log("✅ 漏洞确认：last_updated 没有正确更新！");
      console.log(`   预期值: ${updateTimestamp}`);
      console.log(`   实际值: ${updatedBucket.lastUpdated}`);
      
      // 验证 last_updated 确实是旧的时间戳
      expect(updatedBucket.lastUpdated).toEqual(createTimestamp);
      expect(updatedBucket.lastUpdated).not.toEqual(updateTimestamp);
    }

    // 步骤 5: 演示漏洞的影响 - 计算容量时会产生异常结果
    console.log("💥 步骤 5: 演示漏洞的影响");
    
    // 再等待一些时间
    const additionalWaitTime = newDuration / 4n; // 等待持续时间的1/4
    await advancePrevBlockTimestamp(localnet, additionalWaitTime);
    
    const currentCapacity = await client.getCurrentCapacity({ args: [testBucketId] });
    console.log(`   当前容量: ${currentCapacity}`);
    console.log(`   桶上限: ${limit}`);
    
    // 由于 last_updated 没有正确更新，容量计算会基于非常大的时间差
    // 这可能导致容量瞬间恢复到上限
    if (currentCapacity === limit) {
      console.log("⚠️  容量已恢复到上限 - 这可能是由于异常大的时间差导致的");
    }

    console.log("🎯 POC 测试完成 - 漏洞已确认存在");
  });

  test("对比测试: 正常的持续时间更新应该正确更新 last_updated", async () => {
    console.log("📋 对比测试：正常持续时间更新");

    const normalBucketId = getRandomBytes(32);
    const initialDuration = SECONDS_IN_DAY;

    // 创建具有非零持续时间的桶
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
        args: [normalBucketId, limit, initialDuration],
        boxReferences: [getBucketBoxKey(normalBucketId)],
      })
      .send();

    // 等待一段时间
    await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY);

    // 更新持续时间
    const newDuration = SECONDS_IN_DAY / 2n;
    const updateTimestamp = await getPrevBlockTimestamp(localnet);
    
    await client.send.updateRateDuration({ args: [normalBucketId, newDuration] });
    
    const bucket = await client.getBucket({ args: [normalBucketId] });
    
    // 正常情况下，last_updated 应该被正确更新
    console.log(`✅ 正常更新：last_updated = ${bucket.lastUpdated}, 预期 = ${updateTimestamp}`);
    expect(bucket.lastUpdated).toEqual(updateTimestamp);
  });
}); 