import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import { type Account, type Address, getApplicationAddress } from "algosdk";

import { RateLimiterExposedClient, RateLimiterExposedFactory } from "../../specs/client/RateLimiterExposed.client.ts";
import { getBucketBoxKey } from "../utils/boxes.ts";
import { getRandomBytes } from "../utils/bytes.ts";
import { SECONDS_IN_DAY, advancePrevBlockTimestamp, getPrevBlockTimestamp } from "../utils/time.ts";

describe("RateLimiter 详细漏洞分析", () => {
  const localnet = algorandFixture();

  let factory: RateLimiterExposedFactory;
  let client: RateLimiterExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  beforeAll(async () => {
    await localnet.newScope();
    const { algorand, generateAccount } = localnet.context;

    creator = await generateAccount({ initialFunds: (100).algo() });

    factory = algorand.client.getTypedAppFactory(RateLimiterExposedFactory, {
      defaultSender: creator,
      defaultSigner: creator.signer,
    });

    const { appClient, result } = await factory.deploy();
    appId = result.appId;
    client = appClient;

    expect(appId).not.toEqual(0n);
  });

  test("详细分析：零持续时间桶的 _update_capacity 行为", async () => {
    console.log("🔍 详细分析开始");

    const testBucketId = getRandomBytes(32);
    const limit = BigInt(1000n * 10n ** 18n);

    // 步骤 1: 创建零持续时间桶
    console.log("\n📝 步骤 1: 创建零持续时间桶");
    
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
    console.log(`   ✅ 初始状态: duration=${initialBucket.duration}, last_updated=${initialBucket.lastUpdated}`);

    // 步骤 2: 等待时间并多次调用 updateCapacity 验证不会更新 last_updated
    console.log("\n⏰ 步骤 2: 验证零持续时间时 updateCapacity 不更新 last_updated");
    
    await advancePrevBlockTimestamp(localnet, 3600); // 等待1小时
    
    console.log("   🔄 第一次调用 updateCapacity");
    await client.send.updateCapacity({
      args: [testBucketId],
      boxReferences: [getBucketBoxKey(testBucketId)],
    });
    
    const afterFirst = await client.getBucket({ args: [testBucketId] });
    console.log(`   📊 第一次后: last_updated=${afterFirst.lastUpdated} (应该unchanged)`);
    
    await advancePrevBlockTimestamp(localnet, 3600); // 再等待1小时
    
    console.log("   🔄 第二次调用 updateCapacity");
    await client.send.updateCapacity({
      args: [testBucketId],
      boxReferences: [getBucketBoxKey(testBucketId)],
    });
    
    const afterSecond = await client.getBucket({ args: [testBucketId] });
    console.log(`   📊 第二次后: last_updated=${afterSecond.lastUpdated} (应该unchanged)`);

    // 验证 last_updated 确实没有变化
    expect(afterFirst.lastUpdated).toEqual(initialBucket.lastUpdated);
    expect(afterSecond.lastUpdated).toEqual(initialBucket.lastUpdated);
    console.log("   ✅ 确认: updateCapacity 对零持续时间桶不更新 last_updated");

    // 步骤 3: 现在是关键部分 - 精确记录 updateRateDuration 的行为
    console.log("\n🚨 步骤 3: 精确分析 updateRateDuration 的执行");
    
    await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY); // 等待一天
    
    const beforeUpdate = await client.getBucket({ args: [testBucketId] });
    const preUpdateTimestamp = await getPrevBlockTimestamp(localnet);
    
    console.log(`   📊 更新前状态:`);
    console.log(`      - duration: ${beforeUpdate.duration}`);
    console.log(`      - last_updated: ${beforeUpdate.lastUpdated}`);
    console.log(`      - 当前时间戳: ${preUpdateTimestamp}`);
    console.log(`      - 时间差: ${preUpdateTimestamp - beforeUpdate.lastUpdated} 秒`);

    console.log("   🔄 调用 updateRateDuration...");
    const newDuration = SECONDS_IN_DAY / 2n;
    
    await client.send.updateRateDuration({ args: [testBucketId, newDuration] });
    
    const afterUpdate = await client.getBucket({ args: [testBucketId] });
    const postUpdateTimestamp = await getPrevBlockTimestamp(localnet);
    
    console.log(`   📊 更新后状态:`);
    console.log(`      - duration: ${afterUpdate.duration} (预期: ${newDuration})`);
    console.log(`      - last_updated: ${afterUpdate.lastUpdated}`);
    console.log(`      - 当前时间戳: ${postUpdateTimestamp}`);

    // 关键分析点
    console.log("\n🔍 关键分析:");
    console.log(`   📅 更新前 last_updated: ${beforeUpdate.lastUpdated}`);
    console.log(`   📅 更新后 last_updated: ${afterUpdate.lastUpdated}`);
    console.log(`   📅 预期更新时间戳: ${postUpdateTimestamp}`);
    
    const lastUpdatedChanged = afterUpdate.lastUpdated !== beforeUpdate.lastUpdated;
    const lastUpdatedMatchesTimestamp = afterUpdate.lastUpdated === postUpdateTimestamp;
    
    console.log(`   🔄 last_updated 是否变化: ${lastUpdatedChanged}`);
    console.log(`   ⏰ last_updated 是否匹配当前时间戳: ${lastUpdatedMatchesTimestamp}`);

    if (lastUpdatedChanged) {
      console.log("❌ 发现异常: last_updated 被更新了!");
      console.log("💡 这与预期的逻辑不符 - _update_capacity 应该因 duration=0 而立即返回");
      
      if (lastUpdatedMatchesTimestamp) {
        console.log("🤔 last_updated 被更新为当前时间戳，说明某个地方确实调用了更新逻辑");
      } else {
        console.log("⚠️  last_updated 被更新但不是当前时间戳，这很奇怪");
      }
    } else {
      console.log("✅ last_updated 没有变化，符合预期逻辑");
    }

    // 步骤 4: 验证更新后的容量行为
    console.log("\n📈 步骤 4: 验证更新后的容量计算");
    
    // 消耗一些容量
    const consumeAmount = limit / 4n;
    await client.send.consumeAmount({ 
      args: [testBucketId, consumeAmount],
      boxReferences: [getBucketBoxKey(testBucketId)]
    });
    
    const afterConsume = await client.getBucket({ args: [testBucketId] });
    console.log(`   🍽️  消耗后: current_capacity=${afterConsume.currentCapacity}, last_updated=${afterConsume.lastUpdated}`);
    
    // 等待恢复时间
    const waitTime = newDuration / 4n;
    await advancePrevBlockTimestamp(localnet, waitTime);
    
    const finalCapacity = await client.getCurrentCapacity({ args: [testBucketId] });
    const finalTimestamp = await getPrevBlockTimestamp(localnet);
    
    console.log(`   ⏰ 等待 ${waitTime} 秒后:`);
    console.log(`      - 最终容量: ${finalCapacity}`);
    console.log(`      - 当前时间: ${finalTimestamp}`);
    
    // 计算预期恢复
    const timeDelta = finalTimestamp - afterConsume.lastUpdated;
    const expectedRecovery = (limit * timeDelta) / newDuration;
    const expectedCapacity = afterConsume.currentCapacity + expectedRecovery;
    const cappedExpected = expectedCapacity > limit ? limit : expectedCapacity;
    
    console.log(`   🧮 恢复计算:`);
    console.log(`      - 时间差: ${timeDelta} 秒`);
    console.log(`      - 预期恢复: ${expectedRecovery}`);
    console.log(`      - 预期总容量: ${cappedExpected}`);
    console.log(`      - 实际容量: ${finalCapacity}`);
    
    if (finalCapacity === cappedExpected) {
      console.log("✅ 容量恢复计算正确");
    } else {
      console.log("❌ 容量恢复计算异常");
    }

    console.log("\n🎯 详细分析完成");
  });

  test("对比：非零持续时间桶的更新行为", async () => {
    console.log("\n📋 对比测试：非零持续时间桶");

    const testBucketId = getRandomBytes(32);
    const limit = BigInt(1000n * 10n ** 18n);
    const initialDuration = SECONDS_IN_DAY;

    // 创建非零持续时间桶
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
        args: [testBucketId, limit, initialDuration],
        boxReferences: [getBucketBoxKey(testBucketId)],
      })
      .send();

    const initialBucket = await client.getBucket({ args: [testBucketId] });
    console.log(`   📊 初始: duration=${initialBucket.duration}, last_updated=${initialBucket.lastUpdated}`);

    // 等待时间
    await advancePrevBlockTimestamp(localnet, SECONDS_IN_DAY);

    // 更新持续时间
    const newDuration = SECONDS_IN_DAY / 2n;
    const preUpdateTimestamp = await getPrevBlockTimestamp(localnet);
    
    await client.send.updateRateDuration({ args: [testBucketId, newDuration] });
    
    const updatedBucket = await client.getBucket({ args: [testBucketId] });
    const postUpdateTimestamp = await getPrevBlockTimestamp(localnet);
    
    console.log(`   📊 更新后:`);
    console.log(`      - duration: ${updatedBucket.duration}`);
    console.log(`      - last_updated: ${updatedBucket.lastUpdated}`);
    console.log(`      - 预期时间戳: ${postUpdateTimestamp}`);

    // 对于非零持续时间桶，last_updated 应该被正确更新
    expect(updatedBucket.lastUpdated).toEqual(postUpdateTimestamp);
    console.log("   ✅ 非零持续时间桶的 last_updated 被正确更新");
  });
}); 