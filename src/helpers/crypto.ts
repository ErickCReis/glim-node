import { createHash } from "node:crypto";

export function md5(data: string) {
  return createHash("MD5").update(data).digest("hex");
}

export function sha1(data: string) {
  return createHash("SHA1").update(data).digest("hex");
}

export function sha256(data: string) {
  return createHash("SHA256").update(data).digest("hex");
}
