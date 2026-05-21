import { describe, expect, it } from "vitest";
import {
  extractFirstHeading,
  isMemdirContextDir,
  parseIssueFile,
  parseMemoryDirFromClaudeMd,
  parseMemoryFile,
  parseTaskFile,
} from "../src/memdir/parser.js";

describe("parseMemoryFile", () => {
  it("recognises standard files with order and icon", () => {
    const e = parseMemoryFile("05_log.md", "/abs/05_log.md");
    expect(e.isStandard).toBe(true);
    expect(e.order).toBe(5);
    expect(e.icon).toBe("history");
  });

  it("treats unknown files as non-standard with infinity order", () => {
    const e = parseMemoryFile("memo.md", "/abs/memo.md");
    expect(e.isStandard).toBe(false);
    expect(e.order).toBe(Number.POSITIVE_INFINITY);
    expect(e.icon).toBe("file");
  });
});

describe("parseTaskFile", () => {
  it("pins 00_plan.md at top with order -1", () => {
    const e = parseTaskFile("00_plan.md", "/abs/00_plan.md");
    expect(e.isPlan).toBe(true);
    expect(e.order).toBe(-1);
  });

  it("parses numeric prefix subtasks", () => {
    const e = parseTaskFile("03_frontend-impl.md", "/abs/03_frontend-impl.md");
    expect(e.isPlan).toBe(false);
    expect(e.order).toBe(3);
    expect(e.label).toBe("03: frontend impl");
  });

  it("falls back for non-conforming names", () => {
    const e = parseTaskFile("notes.md", "/abs/notes.md");
    expect(e.isPlan).toBe(false);
    expect(e.order).toBe(Number.POSITIVE_INFINITY);
    expect(e.label).toBe("notes.md");
  });
});

describe("parseIssueFile", () => {
  it("parses well-formed issue name", () => {
    const e = parseIssueFile(
      "critical-sec-ユーザー入力のSQLインジェクション脆弱性.md",
      "/abs/x.md",
      0,
    );
    expect(e.severity).toBe("critical");
    expect(e.perspective).toBe("sec");
    expect(e.title).toBe("ユーザー入力のSQLインジェクション脆弱性");
  });

  it("marks unknown severity as unknown", () => {
    const e = parseIssueFile("blocker-sec-foo.md", "/abs/x.md", 0);
    expect(e.severity).toBe("unknown");
    expect(e.perspective).toBe("sec");
  });

  it("marks unknown perspective as unknown", () => {
    const e = parseIssueFile("major-misc-bar.md", "/abs/x.md", 0);
    expect(e.severity).toBe("major");
    expect(e.perspective).toBe("unknown");
  });

  it("falls back when filename does not match pattern at all", () => {
    const e = parseIssueFile("README.md", "/abs/README.md", 0);
    expect(e.severity).toBe("unknown");
    expect(e.perspective).toBe("unknown");
    expect(e.title).toBe("README");
  });
});

describe("isMemdirContextDir", () => {
  it("accepts YYMMDD_name", () => {
    expect(isMemdirContextDir("260520_memdir-vscode-extension")).toBe(true);
  });

  it("rejects free-form names", () => {
    expect(isMemdirContextDir("some-other-dir")).toBe(false);
    expect(isMemdirContextDir("260520")).toBe(false);
  });
});

describe("extractFirstHeading", () => {
  it("returns first markdown heading text without hash", () => {
    expect(extractFirstHeading("hello\n# Title\nbody")).toBe("Title");
    expect(extractFirstHeading("## Sub\n# Top")).toBe("Sub");
  });

  it("returns undefined when no heading", () => {
    expect(extractFirstHeading("no heading here")).toBeUndefined();
  });
});

describe("parseMemoryDirFromClaudeMd", () => {
  it("parses simple colon form", () => {
    expect(parseMemoryDirFromClaudeMd("MEMORY_DIR: .local")).toBe(".local");
  });

  it("parses bullet bold form", () => {
    const src = "- **MEMORY_DIR**: docs/.memory\nother content";
    expect(parseMemoryDirFromClaudeMd(src)).toBe("docs/.memory");
  });

  it("parses equals form", () => {
    expect(parseMemoryDirFromClaudeMd("MEMORY_DIR=.workspace/mem")).toBe(".workspace/mem");
  });

  it("ignores when not present", () => {
    expect(parseMemoryDirFromClaudeMd("nothing here")).toBeUndefined();
  });

  it("strips wrapping backticks/quotes", () => {
    expect(parseMemoryDirFromClaudeMd("MEMORY_DIR: `.local/`")).toBe(".local/");
  });
});
