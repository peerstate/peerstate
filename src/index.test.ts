import { Keychain } from "./createKeychain";
import { createMockKeychain } from "./createMockKeychain";
import {
  createPeerState,
  createEncryptionFilter,
  createAuthFilter,
  Action,
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

const peerstateForUser = ({ name }: { name: string }) => {
  const keychain: Keychain = createMockKeychain();
  // let userId: string | undefined = keychain.getUserInfo()?.id;
  const { myAuthFilter, myEncryptionFilter } = {
    /**
     * Authorization Filters
     *
     * 1. match a part of the state tree
     * 2. check who is trying to access
     * 3. return true if they are allowed
     */
    myAuthFilter: createAuthFilter<StateTreeType>({
      "/public/:any+": () => true,
      "/users/:userId": (...args) => (console.log(args), true),
      "/group/:groupId": (...args) => (console.log(args), true),
    }),

    /**
     * Encryption Filters
     *
     * 1. match a part of the state tree
     * 2. return false if there is no need to encrypt
     * 3. to encrypt return a list of user ID's that can see the information
     */
    myEncryptionFilter: createEncryptionFilter<StateTreeType>({
      "/group/:groupId": (...args) => (console.log(args), ["2"]),
    }),
  };
  const { nextState, sign } = createPeerState<StateTreeType>(
    myAuthFilter,
    myEncryptionFilter,
    keychain
  );
  return { nextState, sign, keychain, name };
};

describe("bob, alice, and eve", () => {
  let bob: any, alice: any, eve: any;
  const dispatch = (state: any, action: Action) => {
    state.alice = alice.nextState(state.alice, action);
    state.bob = bob.nextState(state.bob, action);
    state.eve = eve.nextState(state.eve, action);
  };
  beforeAll(async () => {
    bob = peerstateForUser({ name: "bob" });
    alice = peerstateForUser({ name: "alice" });
    eve = peerstateForUser({ name: "eve" });
    await bob.keychain.login("bob@example.com", "password1");
    await alice.keychain.login("alice@example.com", "password1");
    await eve.keychain.login("eve@example.com", "password1");
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
});
