import generateRSAKeypair from "keypair";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { IdentifyInfo, RetryCondition } from ".";
import jwt from "jsonwebtoken";

declare global {
  var mockServerKeypair: any;
  var secretsByUserIds: any;
}

globalThis.secretsByUserIds = globalThis.secretsByUserIds || {};
globalThis.mockServerKeypair =
  globalThis.mockServerKeypair || generateRSAKeypair();

export type SecretKey = {
  id: string;
  secret: string;
};

type User = {
  id: string;
  email: string;
  password: string;
};

export class MockKeychain {
  user: User | null;
  id: string;
  signedPublicKey: string;
  privateKey: string;
  serverPublicKey: string;
  url: string;
  constructor() {
    this.id = uuid();
    this.signedPublicKey = "";
    this.privateKey = "";
    this.serverPublicKey = "";
    this.url = "";
    this.deserialize();
  }
  serialize() {
    // console.debug("mock skipping serialization");
    return this;
  }
  deserialize() {
    // console.debug("mock skipping deserialization");
    return this;
  }
  signup(name: string, email: string, password: string): Promise<Response> {
    console.debug("mock signup doesn't do anything");
    console.debug(name, email, password);
    return Promise.resolve(
      new Response("ok", { status: 200, statusText: "ok" })
    );
  }
  login(email: string, password: string): Promise<Response> {
    this.user = { email, id: email, password };
    return Promise.resolve(
      new Response("ok", { status: 200, statusText: "ok" })
    );
  }
  async logout() {
    this.user = null;
  }
  async newKeypair(): Promise<MockKeychain> {
    const keypair = generateRSAKeypair();
    if (!this.user) {
      throw new Error("Not logged in!");
    }
    const publicKey = keypair.public;

    // Skipping security check because this is a mock

    //We don't want to store the sensitive information such as the
    //user password in the token so we pick only the email and id
    const body = {
      id: this.user.id,
      email: this.user.email,
      publicKey,
    };

    //Sign the JWT token and populate the payload with the user email and id
    const token = jwt.sign({ user: body }, mockServerKeypair.private, {
      algorithm: "RS256",
      expiresIn: "365d", //A long expiry combined with frequent key updates should maintain security and availability
    });

    Object.assign(this, {
      signedPublicKey: token,
      serverPublicKey: mockServerKeypair.public,
      privateKey: keypair.private,
    });
    this.serialize();
    return this;
  }
  fetchOrCreateSecret(secretGroup: string, keyId?: string) {
    const userIdsRaw = secretGroup.split(",");
    if (this.user === null) throw new Error("No logged in user");
    if (!userIdsRaw.includes(this.user.id)) return Promise.resolve(false);
    const userIds = userIdsRaw.sort();
    if (keyId) userIds.push(keyId);

    const userIdString = userIds.join(",");
    globalThis.secretsByUserIds[userIdString] =
      globalThis.secretsByUserIds[userIdString] ||
      crypto.randomBytes(16).toString("hex");
    (this as any)[userIdString] = globalThis.secretsByUserIds[userIdString];
    return Promise.resolve((this as any)[userIdString]);
  }
  rotateKeys() {
    this.id = uuid();
    return this.newKeypair();
  }
  getSecretForEncryptionGroup = (
    encryptionGroup: string,
    keyId?: string
  ): SecretKey | RetryCondition | false => {
    const id = keyId || this.id;
    const userIdsRaw = encryptionGroup.split(",");
    if (!this.user) {
      throw new Error("Not logged in!");
    }
    if (!userIdsRaw.includes(this.user.id)) return false;
    const encryptionGroupWithId = [encryptionGroup, id].join(",");

    if (!(this as any)[encryptionGroupWithId]) {
      return {
        error: new Error("no secret exists for encryption group"),
        afterPromise: this.fetchOrCreateSecret(encryptionGroup, id),
      };
    }
    return {
      id,
      secret: (this as any)[encryptionGroupWithId],
    };
  };
  getServerPublicKey() {
    return this.serverPublicKey;
  }
  getPrivateKey() {
    if (!this.privateKey) {
      // TODO: retry things when condition hit
      this.newKeypair();
      return "";
    }
    return this.privateKey;
  }
  getUserInfo() {
    const signedPublicKey = this.getSignedPublicKey();
    if (!signedPublicKey) return null;
    return (JSON.parse(atob(signedPublicKey.split(".")[1])) as IdentifyInfo)
      .user; // FIXME: use jwt for this
  }
  getSignedPublicKey() {
    return this.signedPublicKey;
  }
}

export const createMockKeychain = () => {
  return new MockKeychain();
};
