/* THE PLAN

[x] 1. Create reducer that uses JSON patch standard
[x] 2. Create client/server key exchanger (treat cookie authenticated https as secure channel)
  [x] a. generate an asymmetric key on the client and share public key
  [x] b. use JWT on the server to sign public keys
  [x] c. generate and send a shared secret with the server, store per user on the server
[x] 3. Create authorization filter that uses rules to short circuit patches
  [x] a. rules only need to be for writing and just need to map paths (path-to-regexp) to some validator function
  [x] b. create middleware that verifies signature of payload and includes sender info
  [x] c. make sure sender info is passed into validator function as first argument
[ ] 4. Plug in p2p database
[x] 5. Create mask filter that encrypts data with a shared secret
  [x] a. rules need to map paths to receiver or receiving group
  [x] b. shared secrets must be established between all parties
[x] 6. Create private key exchanger action
  [x] a. this action initiates a key exchange between requesting parties through the server
[x] 7. Expire keys and handle key rotation
[ ] 8. Make sure sequence key is included to prevent reorder attacks
[ ] 9. Refactor and open source
*/

import { Operation } from "fast-json-patch";
import { SecretKey } from "./createKeychain";
export { createPeerState } from "./createPeerState";
export { createAuthFilter } from "./createAuthFilter";
export { jsonPatchReducer } from "./jsonPatchReducer";
export { authenticateAction } from "./authenticateAction";
export { createEncryptionFilter } from "./createEncryptionFilter";
export { createKeychain, Keychain } from "./createKeychain";

export type Action = {
  senderToken: string;
  encryptionGroup?: string;
  iv?: string;
  secretKeyId?: string;
  operationToken: string;
};

type IdentityInfoUser = {
  id: string;
  publicKey: string;
};
export type IdentifyInfo = {
  user: IdentityInfoUser;
};

export type AuthFilter<T> = (
  state: T,
  action: Action,
  serverPublicKey: string,
  secretForEncryptionGroup: GetSecret
) => Operation | false;

export type EncryptionFilter<T> = (
  state: T,
  action: Action,
  operation: Operation,
  senderId: string,
  secretForEncryptionGroup: GetSecret
) => Action;

export type GetSecret = (
  encryptionGroup: string,
  secretKeyId?: string
) => SecretKey | null;
