import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { Account, Address } from "algosdk";

import { MockAccessControlClient, MockAccessControlFactory } from "../../specs/client/MockAccessControl.client.ts";
import { getAddressRolesBoxKey, getRoleBoxKey } from "../utils/boxes.ts";
import { getRandomBytes } from "../utils/bytes.ts";

describe("AccessControl cyclic admin", () => {
  const localnet = algorandFixture();

  const ROLE_A = getRandomBytes(16);
  const ROLE_B = getRandomBytes(16);

  let factory: MockAccessControlFactory;
  let client: MockAccessControlClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;
  let user: Address & Account & TransactionSignerAccount;

  beforeAll(async () => {
    await localnet.newScope();
    const { algorand, generateAccount } = localnet.context;

    creator = await generateAccount({ initialFunds: (100).algo() });
    user = await generateAccount({ initialFunds: (100).algo() });

    factory = algorand.client.getTypedAppFactory(MockAccessControlFactory, {
      defaultSender: creator,
      defaultSigner: creator.signer,
    });
  });

  test("cannot grant role when admins form cycle and no default admin", async () => {
    const { appClient, result } = await factory.deploy();
    appId = result.appId;
    client = appClient;

    // set admins without assigning any default admin role
    await client.send.setRoleAdmin({
      sender: creator,
      args: [ROLE_A, ROLE_B],
      boxReferences: [getRoleBoxKey(ROLE_A)],
    });
    await client.send.setRoleAdmin({
      sender: creator,
      args: [ROLE_B, ROLE_A],
      boxReferences: [getRoleBoxKey(ROLE_B)],
    });

    // try to grant ROLE_A to user
    await expect(
      client.send.grantRole({
        sender: creator,
        args: [ROLE_A, user.toString()],
        boxReferences: [
          getRoleBoxKey(ROLE_A),
          getAddressRolesBoxKey(ROLE_B, creator.publicKey),
        ],
      })
    ).rejects.toThrow("Access control unauthorised account");
  });
});
