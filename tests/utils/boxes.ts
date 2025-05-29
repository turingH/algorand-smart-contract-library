import { convertNumberToBytes, enc } from "./bytes.ts";

// AccessControl
export function getRoleBoxKey(role: Uint8Array): Uint8Array {
  if (role.length !== 16) throw Error("Role must be 16 bytes");
  return Uint8Array.from([...enc.encode("role_"), ...role]);
}

export function getAddressRolesBoxKey(role: Uint8Array, addressPk: Uint8Array): Uint8Array {
  if (role.length !== 16) throw Error("Role must be 16 bytes");
  if (addressPk.length !== 32) throw Error("Address must be 32 bytes");
  return Uint8Array.from([...enc.encode("address_roles_"), ...role, ...addressPk]);
}

// RateLimiter
export function getBucketBoxKey(bucketId: Uint8Array): Uint8Array {
  if (bucketId.length !== 32) throw Error("Bucket id must be 32 bytes");
  return Uint8Array.from([...enc.encode("rate_limit_buckets_"), ...bucketId]);
}
