import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { Account, Address } from "algosdk";

import {
  MockInitialisableWithCreatorClient,
  MockInitialisableWithCreatorFactory,
} from "../../../specs/client/MockInitialisableWithCreator.client.ts";

describe("InitialisableWithCreator", () => {
  const localnet = algorandFixture();

  let factory: MockInitialisableWithCreatorFactory;
  let client: MockInitialisableWithCreatorClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;
  let user: Address & Account & TransactionSignerAccount;

  beforeAll(async () => {
    await localnet.newScope();
    const { algorand, generateAccount } = localnet.context;

    creator = await generateAccount({ initialFunds: (100).algo() });
    user = await generateAccount({ initialFunds: (100).algo() });

    factory = algorand.client.getTypedAppFactory(MockInitialisableWithCreatorFactory, {
      defaultSender: creator,
      defaultSigner: creator.signer,
    });
  });

  test("deploys with correct state", async () => {
    const { appClient, result } = await factory.deploy();
    appId = result.appId;
    client = appClient;

    expect(appId).not.toEqual(0n);
    expect(await client.state.global.isInitialised()).toBeFalsy();
  });

  describe("initialise", () => {
    test("fails when caller is not creator", async () => {
      await expect(client.send.initialise({ sender: user, args: [] })).rejects.toThrow(
        "Caller must be the contract creator",
      );
    });

    test("succeeds and sets initialised state", async () => {
      await client.send.initialise({ args: [] });
      expect(await client.state.global.isInitialised()).toBeTruthy();
    });
  });
});
