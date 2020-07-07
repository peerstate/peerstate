import jwt from "jsonwebtoken";
import {
  AuthFilter,
  EncryptionFilter,
  jsonPatchReducer,
  Keychain,
  Action,
  isRetryCondition,
  RetryCondition,
  Operation,
} from "./";

export type PeerStateClient<T> = {
  nextState: (
    state: InternalState<T>,
    action: Action | RetryCondition | false
  ) => InternalState<T>;
  sign: (
    state: InternalState<T>,
    op: Operation
  ) => Action | RetryCondition | false;
};

export type InternalState<T> = {
  peerState: T;
  keys: Keychain;
  retryCondition?: RetryCondition;
};

// TODO: handle case where token expires
export const createPeerState = function <StateTreeType>(
  authFilter: AuthFilter<StateTreeType>,
  encryptionFilter: EncryptionFilter<StateTreeType>,
  keychain: Keychain
): PeerStateClient<StateTreeType> {
  const nextState = function (
    state: InternalState<StateTreeType>,
    action: Action | RetryCondition | false
  ): InternalState<StateTreeType> {
    if (action === false) {
      return state;
    }
    if (isRetryCondition(action)) {
      return { ...state, retryCondition: action };
    }
    const serverPublicKey = keychain.getServerPublicKey();
    const operation = authFilter(
      state.peerState,
      action,
      serverPublicKey,
      keychain.getSecretForEncryptionGroup
    );
    if (isRetryCondition(operation)) {
      return {
        ...state,
        retryCondition: operation,
      };
    }
    if (!operation) {
      return state;
    }
    return {
      ...state,
      peerState: jsonPatchReducer<StateTreeType>(state.peerState, operation),
    };
  };
  const sign = (
    state: InternalState<StateTreeType>,
    op: Operation
  ): Action | RetryCondition | false => {
    if (typeof keychain.getSignedPublicKey() !== "string") {
      throw new Error("signed public key is not available, try again later");
    }
    const senderId = keychain.getUserInfo()?.id;
    if (!senderId) {
      throw new Error("problem getting user from signed public key");
    }
    return encryptionFilter(
      state.peerState,
      {
        senderToken: keychain.getSignedPublicKey(),
        operationToken: jwt.sign(op, keychain.getPrivateKey(), {
          algorithm: "RS256",
        }),
      },
      op,
      senderId,
      keychain.getSecretForEncryptionGroup
    );
  };
  return { nextState, sign };
};
