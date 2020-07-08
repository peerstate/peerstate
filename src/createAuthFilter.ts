import { match, MatchFunction, MatchResult } from "path-to-regexp";
import {
  authenticateAction,
  Action,
  AuthFilter,
  GetSecret,
  isRetryCondition,
  RetryCondition,
  Operation,
} from "./";

type AuthorizationRules<T, R extends object = object> = {
  [key: string]: (
    senderId: string,
    state: T,
    action: Operation,
    params: MatchResult<R>
  ) => boolean;
};
// TODO: wrap operation with something that has positional info
// TODO: handle case where token expires
export const createAuthFilter = function <T, R extends object = object>(
  rules: AuthorizationRules<T, R>
): AuthFilter<T> {
  const compiledRules = Object.entries(rules).map(([path, filterFn]): [
    MatchFunction<R>,
    typeof filterFn
  ] => [match<R>(path, { decode: decodeURIComponent }), filterFn]);
  return function authFilter(
    state: T,
    action: Action,
    serverPublicKey: string,
    secretForEncryptionGroup: GetSecret
  ): Operation | RetryCondition | false {
    try {
      const authenticationResult = authenticateAction(
        action,
        serverPublicKey,
        secretForEncryptionGroup
      );
      if (authenticationResult === false) {
        return false;
      }
      if (isRetryCondition(authenticationResult)) {
        return authenticationResult;
      }
      const { senderId, operation } = authenticationResult;

      const result =
        (compiledRules.reduce(
          (
            result: boolean | undefined,
            [pathMatcher, filterFn]
          ): boolean | undefined => {
            // block copy and move until we permission check "from"
            if (["copy", "move"].includes(operation.op)) return false;
            const pathMatchResult = pathMatcher(operation.path);
            if (result !== undefined || !pathMatchResult) return result;
            return filterFn(senderId, state, operation, pathMatchResult);
          },
          undefined
        ) ||
          false) &&
        operation;
      if (result === false) {
        console.warn(`UNAUTHORIZED: action was blocked`, { action });
      }
      return result;
    } catch (e) {
      console.error(e);
      return false;
    }
  };
};
