import { match, MatchFunction, MatchResult } from "path-to-regexp";
import crypto from "crypto";
import {
  Action,
  EncryptionFilter,
  GetSecret,
  isRetryCondition,
  RetryCondition,
  Operation,
} from "./";

type EncryptionRules<T, R extends object = object> = {
  [key: string]: (
    state: T,
    action: Operation,
    params: MatchResult<R>
  ) => undefined | null | string[];
};
export const createEncryptionFilter = function <T, R extends object = object>(
  rules: EncryptionRules<T, R>
): EncryptionFilter<T> {
  const compiledRules = Object.entries(rules).map(([path, filterFn]): [
    MatchFunction<R>,
    typeof filterFn
  ] => [match<R>(path, { decode: decodeURIComponent }), filterFn]);
  return function encryptionFilter(
    state: T,
    action: Action,
    operation: Operation,
    senderId: string,
    secretForEncryptionGroup: GetSecret
  ): Action | RetryCondition | false {
    const encryptionGroupIds = compiledRules.reduce(
      (result: string[], [pathMatcher, filterFn]): string[] => {
        const pathMatchResult = pathMatcher(operation.path);
        if (!pathMatchResult || result.length > 0) return result;
        return filterFn(state, operation, pathMatchResult) || [];
      },
      []
    );
    if (encryptionGroupIds.length > 0) {
      const encryptionGroup = [
        ...encryptionGroupIds.filter((uid) => uid !== senderId),
        senderId,
      ]
        .sort()
        .join(",");
      const secretKey = secretForEncryptionGroup(encryptionGroup);
      if (secretKey === false) {
        return false;
      }
      if (isRetryCondition(secretKey)) {
        return secretKey;
      }
      const { id: secretKeyId, secret } = secretKey;
      const iv = crypto.randomBytes(16).toString("hex");
      const { operationToken, ...rest } = action;
      const cipher = crypto.createCipheriv(
        "aes-128-ofb", // TODO: use more secure keys
        Buffer.from(secret, "hex"),
        Buffer.from(iv, "hex")
      );
      let newOperationToken = "";
      newOperationToken += cipher.update(operationToken, "utf8", "hex");
      newOperationToken += cipher.final("hex");
      return {
        operationToken: newOperationToken,
        iv,
        secretKeyId,
        encryptionGroup,
        ...rest,
      };
    } else {
      return action;
    }
  };
};
