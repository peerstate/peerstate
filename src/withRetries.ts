import { InternalState, PeerStateClient } from "./createPeerState";
import { Action, RetryCondition, isRetryCondition } from ".";
import { Operation } from "fast-json-patch";

export type AsyncPeerStateClient<T> = {
  nextState: (
    state: InternalState<T>,
    action: Action
  ) => Promise<InternalState<T>>;
  sign: (state: InternalState<T>, op: Operation) => Promise<Action>;
};

export const withRetries = function <T>(
  client: PeerStateClient<T>,
  maxRetries: number = 5
): AsyncPeerStateClient<T> {
  const nextState = async (state: InternalState<T>, action: Action) => {
    let result = state;
    for (var i = 0; i < maxRetries + 1; i++) {
      delete result.retryCondition;
      result = client.nextState(state, action);
      if (result.retryCondition && isRetryCondition(result.retryCondition)) {
        await result.retryCondition.afterPromise;
      } else {
        break;
      }
    }
    if (result.retryCondition && isRetryCondition(result.retryCondition)) {
      console.error(result.retryCondition.error);
      throw new Error("max retries exceeded");
    }
    return result;
  };
  const sign = async (
    state: InternalState<T>,
    op: Operation
  ): Promise<Action> => {
    let i = -1;
    let response;
    do {
      i++;
      response = client.sign(state, op);
      if (isRetryCondition(response)) {
        await response.afterPromise;
      } else {
        break;
      }
    } while (i < maxRetries);
    if (isRetryCondition(response)) {
      console.error(response.error);
      throw new Error("max retries exceeded");
    }
    return response;
  };
  return { sign, nextState };
};
