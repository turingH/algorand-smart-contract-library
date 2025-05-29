import { sha256 } from "@noble/hashes/sha2";

import { enc } from "./bytes.ts";

export const PAGE_SIZE = 4096;

export function calculateProgramSha256(approvalProgram: Uint8Array, clearStateProgram: Uint8Array): Uint8Array {
  // build
  let program = enc.encode("approval");
  for (let i = 0; i < approvalProgram.length; i += PAGE_SIZE) {
    program = Uint8Array.from([...program, ...sha256(approvalProgram.slice(i, i + PAGE_SIZE))]);
  }
  program = Uint8Array.from([...program, ...enc.encode("clear")]);
  for (let i = 0; i < clearStateProgram.length; i += PAGE_SIZE) {
    program = Uint8Array.from([...program, ...sha256(clearStateProgram.slice(i, i + PAGE_SIZE))]);
  }

  // hash result
  return sha256(program);
}
