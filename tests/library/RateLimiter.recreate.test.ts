import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import { type Account, type Address, getApplicationAddress } from "algosdk";

import { RateLimiterExposedClient, RateLimiterExposedFactory } from "../../specs/client/RateLimiterExposed.client.ts";
import { getBucketBoxKey } from "../utils/boxes.ts";
import { getRandomBytes } from "../utils/bytes.ts";
import { SECONDS_IN_DAY } from "../utils/time.ts";

/**
 * Regression test for deleting and recreating a bucket.
 * Removing then adding again should reset capacity and timestamp.
 */
describe("RateLimiter - remove and recreate bucket", () => {
  const localnet = algorandFixture();

  let factory: RateLimiterExposedFactory;
  let client: RateLimiterExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  const bucketId = getRandomBytes(32);
  const limit = BigInt(1000n * 10n ** 18n);
  const duration = SECONDS_IN_DAY;

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

  test("recreate bucket resets capacity", async () => {
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
        args: [bucketId, limit, duration],
        boxReferences: [getBucketBoxKey(bucketId)],
      })
      .send();

    await client.send.consumeAmount({
      args: [bucketId, limit / 2n],
      boxReferences: [getBucketBoxKey(bucketId)],
    });
    const halfCapacity = await client.getCurrentCapacity({ args: [bucketId] });
    expect(halfCapacity).toEqual(limit / 2n);

    await client.send.removeBucket({
      args: [bucketId],
      boxReferences: [getBucketBoxKey(bucketId)],
    });

    const fundingTxn2 = await localnet.algorand.createTransaction.payment({
      sender: creator,
      receiver: getApplicationAddress(appId),
      amount: APP_MIN_BALANCE,
    });
    const res = await client
      .newGroup()
      .addTransaction(fundingTxn2)
      .addBucket({
        args: [bucketId, limit, duration],
        boxReferences: [getBucketBoxKey(bucketId)],
      })
      .send();

    expect(res.confirmations[1].logs).toBeDefined();
    const current = await client.getCurrentCapacity({ args: [bucketId] });
    expect(current).toEqual(limit);
  });
});
