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

  test("POC: 验证从零持续时间改为非零持续时间时的边界情况", async () => {
    console.log("🔍 开始精确的 POC 测试");

    // 步骤 1: 创建持续时间为 0 的桶
    console.log("📝 步骤 1: 创建持续时间为 0 的桶");
    
    const APP_MIN_BALANCE = (154_900).microAlgos();
    const fundingTxn = await localnet.algorand.createTransaction.payment({
      sender: creator,
      receiver: getApplicationAddress(appId),
      amount: APP_MIN_BALANCE,
    });
    
    const createTimestamp = await getPrevBlockTimestamp(localnet);
    console.log(`   🕐 创建前时间戳: ${createTimestamp}`);
    
    await client
      .newGroup()
      .addTransaction(fundingTxn)
      .addBucket({
        args: [testBucketId, limit, 0n], // duration = 0
        boxReferences: [getBucketBoxKey(testBucketId)],
      })
      .send();

    const afterCreateTimestamp = await getPrevBlockTimestamp(localnet);
    const initialBucket = await client.getBucket({ args: [testBucketId] });
    console.log(`   🕐 创建后时间戳: ${afterCreateTimestamp}`);
    console.log(`   ✅ 桶已创建，last_updated: ${initialBucket.lastUpdated}`);
    console.log(`   ✅ 桶持续时间: ${initialBucket.duration} (0 表示无限桶)`);
    console.log(`   ✅ 桶容量: ${initialBucket.currentCapacity}`);

    // 步骤 2: 等待一段时间，模拟实际场景
    console.log("\n⏱️  步骤 2: 等待一段时间");
    const waitTime = SECONDS_IN_DAY; // 等待一天
    await advancePrevBlockTimestamp(localnet, waitTime);
    const afterWaitTimestamp = await getPrevBlockTimestamp(localnet);
    console.log(`   🕐 等待后时间戳: ${afterWaitTimestamp}`);
    console.log(`   ⏰ 总等待时间: ${afterWaitTimestamp - afterCreateTimestamp} 秒`);

    // 步骤 3: 检查更新前的状态
    console.log("\n🔍 步骤 3: 更新前最后检查");
    const preUpdateBucket = await client.getBucket({ args: [testBucketId] });
    console.log(`   📊 更新前桶状态:`);
    console.log(`      - duration: ${preUpdateBucket.duration}`);
    console.log(`      - last_updated: ${preUpdateBucket.lastUpdated}`);
    console.log(`      - current_capacity: ${preUpdateBucket.currentCapacity}`);

    // 步骤 4: 更新持续时间
    console.log("\n🔄 步骤 4: 更新持续时间为非零值");
    const newDuration = SECONDS_IN_DAY / 2n; // 12小时
    
    const preUpdateTimestamp = await getPrevBlockTimestamp(localnet);
    console.log(`   🕐 更新前时间戳: ${preUpdateTimestamp}`);
    
    await client.send.updateRateDuration({ args: [testBucketId, newDuration] });
    
    const postUpdateTimestamp = await getPrevBlockTimestamp(localnet);
    console.log(`   🕐 更新后时间戳: ${postUpdateTimestamp}`);

    // 步骤 5: 检查更新后的状态
    console.log("\n📊 步骤 5: 验证更新结果");
    const updatedBucket = await client.getBucket({ args: [testBucketId] });
    console.log(`   📈 更新后桶状态:`);
    console.log(`      - duration: ${updatedBucket.duration} (预期: ${newDuration})`);
    console.log(`      - last_updated: ${updatedBucket.lastUpdated}`);
    console.log(`      - current_capacity: ${updatedBucket.currentCapacity}`);

    // 关键验证点
    console.log("\n🚨 关键验证：last_updated 时间戳分析");
    console.log(`   📅 创建时的 last_updated: ${initialBucket.lastUpdated}`);
    console.log(`   📅 更新后的 last_updated: ${updatedBucket.lastUpdated}`);
    console.log(`   📅 预期的 last_updated: ${postUpdateTimestamp}`);
    console.log(`   ⏰ 时间差分析:`);
    console.log(`      - 更新前后时间差: ${postUpdateTimestamp - preUpdateTimestamp}`);
    console.log(`      - last_updated 与创建时间差: ${updatedBucket.lastUpdated - initialBucket.lastUpdated}`);
    console.log(`      - last_updated 与更新时间差: ${updatedBucket.lastUpdated - postUpdateTimestamp}`);

    // 漏洞验证
    if (updatedBucket.lastUpdated === initialBucket.lastUpdated) {
      console.log("❌ 漏洞确认存在: last_updated 没有被更新！");
      console.log("💥 这意味着下次容量计算会基于异常大的时间差");
    } else if (updatedBucket.lastUpdated === postUpdateTimestamp) {
      console.log("✅ last_updated 被正确更新为当前时间戳");
      console.log("🤔 漏洞可能已被修复或测试场景不正确");
    } else {
      console.log("⚠️  last_updated 被更新但不是预期值");
      console.log("🔍 需要进一步分析");
    }

    // 步骤 6: 验证容量计算影响
    console.log("\n💥 步骤 6: 验证容量计算的影响");
    
    // 先消耗一些容量
    const consumeAmount = limit / 4n;
    await client.send.consumeAmount({ 
      args: [testBucketId, consumeAmount],
      boxReferences: [getBucketBoxKey(testBucketId)]
    });
    
    const afterConsumeTimestamp = await getPrevBlockTimestamp(localnet);
    const afterConsumeBucket = await client.getBucket({ args: [testBucketId] });
    console.log(`   🍽️  消耗 ${consumeAmount} 后:`);
    console.log(`      - current_capacity: ${afterConsumeBucket.currentCapacity}`);
    console.log(`      - last_updated: ${afterConsumeBucket.lastUpdated}`);
    
    // 等待一段时间再检查容量恢复
    const waitForRecovery = newDuration / 4n; // 等待1/4恢复时间
    await advancePrevBlockTimestamp(localnet, waitForRecovery);
    
    const finalCapacity = await client.getCurrentCapacity({ args: [testBucketId] });
    const finalTimestamp = await getPrevBlockTimestamp(localnet);
    console.log(`   ⏰ 等待 ${waitForRecovery} 秒后:`);
    console.log(`      - 最终容量: ${finalCapacity}`);
    console.log(`      - 当前时间: ${finalTimestamp}`);
    
    // 计算预期容量恢复
    const timeSinceUpdate = finalTimestamp - afterConsumeBucket.lastUpdated;
    const expectedRecovery = (limit * timeSinceUpdate) / newDuration;
    const expectedCapacity = afterConsumeBucket.currentCapacity + expectedRecovery;
    const cappedExpectedCapacity = expectedCapacity > limit ? limit : expectedCapacity;
    
    console.log(`   🧮 容量恢复计算:`);
    console.log(`      - 时间差: ${timeSinceUpdate} 秒`);
    console.log(`      - 预期恢复量: ${expectedRecovery}`);
    console.log(`      - 预期总容量: ${cappedExpectedCapacity}`);
    console.log(`      - 实际容量: ${finalCapacity}`);
    
    if (finalCapacity === limit && afterConsumeBucket.currentCapacity < limit) {
      console.log("⚠️  容量异常恢复到上限 - 可能存在时间计算问题");
    }

    console.log("\n🎯 POC 测试完成");
  });

  test("对比测试: 验证直接更新 last_updated 的行为", async () => {
    console.log("\n📋 对比测试：手动验证 _update_capacity 行为");

    const testBucketId2 = getRandomBytes(32);

    // 创建零持续时间桶
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
        args: [testBucketId2, limit, 0n],
        boxReferences: [getBucketBoxKey(testBucketId2)],
      })
      .send();

    const initialBucket = await client.getBucket({ args: [testBucketId2] });
    console.log(`   初始状态: duration=${initialBucket.duration}, last_updated=${initialBucket.lastUpdated}`);

    // 等待时间
    await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY);

    // 直接调用 updateCapacity (这应该会因为 duration=0 而不更新 last_updated)
    await client.send.updateCapacity({
      args: [testBucketId2],
      boxReferences: [getBucketBoxKey(testBucketId2)],
    });

    const afterUpdateCapacityBucket = await client.getBucket({ args: [testBucketId2] });
    console.log(`   调用 updateCapacity 后: last_updated=${afterUpdateCapacityBucket.lastUpdated}`);
    
    if (afterUpdateCapacityBucket.lastUpdated === initialBucket.lastUpdated) {
      console.log("✅ 确认: updateCapacity 对零持续时间桶不更新 last_updated");
    } else {
      console.log("❌ 意外: updateCapacity 更新了零持续时间桶的 last_updated");
    }
  });
}); 