import { Operation } from "fast-json-patch";
import { match, MatchFunction, MatchResult } from "path-to-regexp";
import crypto from "crypto";
import { Action, EncryptionFilter, GetSecret } from "./";

type EncryptionRules<T> = {
  [key: string]: (
    state: T,
    action: Operation,
    params: MatchResult
  ) => undefined | null | string[];
};
export const createEncryptionFilter = function <T>(
  rules: EncryptionRules<T>
): EncryptionFilter<T> {
  const compiledRules = Object.entries(rules).map(([path, filterFn]): [
    MatchFunction,
    typeof filterFn
  ] => [match(path, { decode: decodeURIComponent }), filterFn]);
  return function encryptionFilter(
    state: T,
    action: Action,
    operation: Operation,
    senderId: string,
    secretForEncryptionGroup: GetSecret
  ): Action {
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

      if (!secretKey) {
        // FIXME: retry action on failure
        throw new Error("secret key not available");
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
