import { describe, expect, it } from "vitest";
import { isWrapperDirName } from "../src/memdir/scanner.js";

describe("isWrapperDirName", () => {
  it("treats underscore-prefixed names as wrappers", () => {
    expect(isWrapperDirName("_archive")).toBe(true);
    expect(isWrapperDirName("_closed")).toBe(true);
    expect(isWrapperDirName("_v1")).toBe(true);
  });

  it("treats arbitrary non-conforming names as wrappers", () => {
    expect(isWrapperDirName("draft")).toBe(true);
    expect(isWrapperDirName("WIP")).toBe(true);
  });

  it("rejects hidden directories", () => {
    expect(isWrapperDirName(".git")).toBe(false);
    expect(isWrapperDirName(".cache")).toBe(false);
  });

  it("rejects YYMMDD_<name> context directories", () => {
    expect(isWrapperDirName("260520_memdir-vscode-extension")).toBe(false);
    expect(isWrapperDirName("251111_pp2025-ph2-data-insert")).toBe(false);
  });

  it("rejects short numeric names without prefix", () => {
    // not YYMMDD pattern, so still treated as wrapper
    expect(isWrapperDirName("260520")).toBe(true);
  });
});
