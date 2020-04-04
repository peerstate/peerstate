import { Operation } from "fast-json-patch";
import { match, MatchFunction, MatchResult } from "path-to-regexp";
import { authenticateAction, Action, AuthFilter, GetSecret } from "./";

type AuthorizationRules<T> = {
  [key: string]: (
    senderId: string,
    state: T,
    action: Operation,
    params: MatchResult
  ) => boolean;
};
// TODO: wrap operation with something that has positional info
// TODO: handle case where token expires
export const createAuthFilter = function<T>(
  rules: AuthorizationRules<T>
): AuthFilter<T> {
  const compiledRules = Object.entries(rules).map(([path, filterFn]): [
    MatchFunction,
    typeof filterFn
  ] => [match(path, { decode: decodeURIComponent }), filterFn]);
  return function authFilter(
    state: T,
    action: Action,
    serverPublicKey: string,
    secretForEncryptionGroup: GetSecret
  ): Operation | false {
    try {
      const { senderId, operation } = authenticateAction(
        action,
        serverPublicKey,
        secretForEncryptionGroup
      );
      return (
        (compiledRules.reduce(
          (
            result: boolean | undefined,
            [pathMatcher, filterFn]
          ): boolean | undefined => {
            const pathMatchResult = pathMatcher(operation.path);
            if (result !== undefined || !pathMatchResult) return result;
            return filterFn(senderId, state, operation, pathMatchResult);
          },
          undefined
        ) ||
          false) &&
        operation
      );
    } catch (e) {
      console.error(e);
      return false;
    }
  };
};
