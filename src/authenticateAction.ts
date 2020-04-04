import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Operation } from "fast-json-patch";
import { Action, IdentifyInfo, GetSecret } from "./";

export const authenticateAction = function (
  action: Action,
  serverPublicKey: string,
  secretForEncryptionGroup: GetSecret
): { senderId: string; operation: Operation } {
  const senderInfo = jwt.verify(action.senderToken, serverPublicKey, {
    algorithms: ["RS256"], // TODO: use more secure keys
  }) as IdentifyInfo;
  const {
    user: { id: senderId, publicKey: senderPublicKey },
  } = senderInfo;
  let operationToken = action.operationToken;
  if (action.encryptionGroup && action.iv) {
    // decrypt operation token
    const secret = secretForEncryptionGroup(
      action.encryptionGroup,
      action.secretKeyId
    );
    if (!secret) {
      // FIXME: make sure this properly retries
      throw new Error("secret is not available");
    }
    const cipher = crypto.createDecipheriv(
      "aes-128-ofb",
      Buffer.from(secret.secret, "hex"),
      Buffer.from(action.iv, "hex")
    );
    let result = "";
    result += cipher.update(operationToken, "hex", "utf8");
    result += cipher.final("utf8");
    operationToken = result;
  }
  const operation = jwt.verify(operationToken, senderPublicKey, {
    algorithms: ["RS256"],
  }) as Operation;
  return { senderId, operation };
};
