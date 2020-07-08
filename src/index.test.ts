import { Keychain } from "./createKeychain";
import { createMockKeychain } from "./createMockKeychain";
import {
  createPeerState,
  createEncryptionFilter,
  createAuthFilter,
  Action,
  withRetries,
  isRetryCondition,
} from "./";

type StateTreeType = any;

if (!globalThis.atob) {
  eval(
    "globalThis.atob = (b64Str) => Buffer.from(b64Str, `base64`).toString(`binary`)"
  );
}
if (!globalThis.Response) {
  eval("globalThis.Response = require('node-fetch').Response");
}

type MatchParams = { userId: string; groupId: string; any: string[] };

const peerstateForUser = ({ name }: { name: string }) => {
  const keychain: Keychain = createMockKeychain();
  const { myAuthFilter, myEncryptionFilter } = {
    /**
     * Authorization Filters
     *
     * 1. match a part of the state tree
     * 2. check who is trying to access
     * 3. return true if they are allowed
     */
    myAuthFilter: createAuthFilter<StateTreeType, MatchParams>({
      "/public/:any+": () => true,
      "/users/:userId/:any*": (senderId, state, op, match) =>
        senderId === match.params.userId,
      "/group/:groupId/:any*": (senderId, state, op, match) =>
        match.params.groupId.split(",").includes(senderId),
    }),

    /**
     * Encryption Filters
     *
     * 1. match a part of the state tree
     * 2. return false if there is no need to encrypt
     * 3. to encrypt return a list of user ID's that can see the information
     */
    myEncryptionFilter: createEncryptionFilter<StateTreeType, MatchParams>({
      "/group/:groupId/:any*": (state, action, match) =>
        match.params.groupId.split(","),
    }),
  };
  const { nextState, sign } = withRetries<StateTreeType>(
    createPeerState<StateTreeType>(myAuthFilter, myEncryptionFilter, keychain)
  );
  return { nextState, sign, keychain, name };
};

describe("bob, alice, and eve", () => {
  let bob: any, alice: any, eve: any;
  const dispatch = async (state: any, action: Action) => {
    const r = await Promise.all([
      alice.nextState(state.alice, action),
      bob.nextState(state.bob, action),
      eve.nextState(state.eve, action),
    ]);
    state.alice = r[0];
    state.bob = r[1];
    state.eve = r[2];
    return state;
  };
  beforeAll(async () => {
    bob = peerstateForUser({ name: "bob" });
    alice = peerstateForUser({ name: "alice" });
    eve = peerstateForUser({ name: "eve" });
    await Promise.all([
      bob.keychain.login("bob@example.com", "password1"),
      alice.keychain.login("alice@example.com", "password1"),
      eve.keychain.login("eve@example.com", "password1"),
    ]);
    await bob.keychain.newKeypair();
    await alice.keychain.newKeypair();
    await eve.keychain.newKeypair();
  });

  test("everyone can change the public state", async () => {
    let state = {
      alice: { peerState: { public: {} } },
      bob: { peerState: { public: {} } },
      eve: { peerState: { public: {} } },
    };
    await dispatch(
      state,
      await bob.sign(state.bob, {
        op: "add",
        path: "/public/bob",
        value: "hello from bob",
      })
    );
    ["alice", "bob", "eve"].forEach((name) =>
      expect(state[name]?.peerState?.public?.bob).toEqual("hello from bob")
    );
  });

  test("alice and bob can chat without worrying about eve", async () => {
    let state = {
      alice: { peerState: { group: {} } },
      bob: { peerState: { group: {} } },
      eve: { peerState: { group: {} } },
    };

    const signedAction = await bob.sign(state.bob, {
      op: "add",
      path: "/group/alice@example.com,bob@example.com",
      value: "shh alice this is a secret",
    });
    expect(isRetryCondition(signedAction)).toBeFalsy();
    await dispatch(state, signedAction);
    ["alice", "bob"].forEach((name) =>
      expect(
        state[name]?.peerState?.group["alice@example.com,bob@example.com"]
      ).toEqual("shh alice this is a secret")
    );
    expect(state.eve.peerState.group).toEqual({});
  });
});
