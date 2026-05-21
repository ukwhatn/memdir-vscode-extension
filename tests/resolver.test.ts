import { describe, expect, it } from "vitest";
import { expandHome, resolveMemdirPath } from "../src/memdir/pathUtils.js";

const HOME = "/Users/test";
const WS = "/Users/test/dev/sol/das";

describe("expandHome", () => {
  it("expands bare tilde", () => {
    expect(expandHome("~", HOME)).toBe(HOME);
  });

  it("expands ~/foo to homedir/foo", () => {
    expect(expandHome("~/foo/bar", HOME)).toBe("/Users/test/foo/bar");
  });

  it("expands ~/ trailing slash", () => {
    expect(expandHome("~/dev/sol/das/.local/", HOME)).toBe("/Users/test/dev/sol/das/.local/");
  });

  it("leaves absolute paths untouched", () => {
    expect(expandHome("/etc/hosts", HOME)).toBe("/etc/hosts");
  });

  it("leaves relative paths untouched", () => {
    expect(expandHome(".local", HOME)).toBe(".local");
  });

  it("does not expand ~user (out of scope)", () => {
    expect(expandHome("~other/foo", HOME)).toBe("~other/foo");
  });
});

describe("resolveMemdirPath", () => {
  it("resolves ~/path against homedir (not workspace)", () => {
    // expandHome runs first; without it this used to become $WS/~/dev/sol/das/.local
    const actual = resolveMemdirPath("~/dev/sol/das/.local/", WS);
    // expandHome uses os.homedir() in production; here we just confirm no ~ remains
    expect(actual.startsWith("~")).toBe(false);
    expect(actual.includes("/~")).toBe(false);
  });

  it("keeps absolute paths absolute", () => {
    expect(resolveMemdirPath("/abs/path", WS)).toBe("/abs/path");
  });

  it("joins relative paths to workspace folder", () => {
    expect(resolveMemdirPath(".local", WS)).toBe(`${WS}/.local`);
  });

  it("normalises redundant separators", () => {
    expect(resolveMemdirPath(".local//memory", WS)).toBe(`${WS}/.local/memory`);
  });
});
