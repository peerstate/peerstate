import generateRSAKeypair from "keypair";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { IdentifyInfo, RetryCondition } from ".";

const SERIALIZATION_KEY = "peerStateKeychain";

export type SecretKey = {
  id: string;
  secret: string;
};

type SharedSecretResponse = {
  key: string;
  secret: string;
};

export class Keychain {
  id: string;
  signedPublicKey: string;
  privateKey: string;
  serverPublicKey: string;
  url: string;
  constructor(url: string) {
    this.id = uuid();
    this.signedPublicKey = "";
    this.privateKey = "";
    this.serverPublicKey = "";
    this.url = url;
    this.deserialize();
  }
  serialize() {
    window.localStorage.setItem(SERIALIZATION_KEY, JSON.stringify(this));
    return this;
  }
  deserialize() {
    try {
      const storedData = JSON.parse(
        window.localStorage.getItem(SERIALIZATION_KEY) || "{}"
      );
      Object.assign(this, storedData);
    } catch (e) {
      console.error("bad keychain stored");
    }
    return this;
  }
  signup(name: string, email: string, password: string) {
    return fetch(`${this.url}/signup`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        name,
        password,
      }),
    });
  }
  login(email: string, password: string) {
    return fetch(`${this.url}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
      }),
    });
  }
  logout() {
    return fetch(`${this.url}/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
    }).then(() => window.localStorage.setItem(SERIALIZATION_KEY, "{}"));
  }
  newKeypair() {
    const keypair = generateRSAKeypair();
    return fetch(`${this.url}/registerPublicKey`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicKey: keypair.public,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        Object.assign(this, {
          signedPublicKey: res.token,
          serverPublicKey: res.serverPublicKey,
          privateKey: keypair.private,
        });
        this.serialize();
        return this;
      });
  }
  fetchOrCreateSecret(secretGroup: string, keyId?: string) {
    const userIdsRaw = secretGroup.split(",");
    return fetch(`${this.url}/sharedSecret`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userIds: userIdsRaw,
        keyId: keyId || this.id,
        secret: crypto.randomBytes(16).toString("hex"),
      }),
    })
      .then((res) => res.json())
      .then(
        (res: SharedSecretResponse) => (
          ((this as any)[res.key] = res.secret), this.serialize(), res.secret
        )
      );
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

export const createKeychain = (url: string) => {
  return new Keychain(url);
};
