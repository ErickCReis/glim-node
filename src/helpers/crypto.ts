import { createHash } from "node:crypto";

export function md5(data: string) {
  return createHash("MD5").update(data).digest("hex");
}
