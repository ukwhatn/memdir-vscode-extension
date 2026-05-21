import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isWrapperDirName,
  scanMemoryDirectoryAt,
  scanTasksDirectoryAt,
} from "../src/memdir/scanner.js";

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

describe("scanMemoryDirectoryAt (recursive subdirs under context)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "memdir-scan-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("collects subdirs and direct files under a context", async () => {
    const ctx = path.join(tmpDir, "260122_instant-account");
    await fs.mkdir(path.join(ctx, "phase1"), { recursive: true });
    await fs.mkdir(path.join(ctx, "phase2"), { recursive: true });
    await fs.writeFile(path.join(ctx, "05_log.md"), "log");
    await fs.writeFile(path.join(ctx, "99_history.md"), "hist");
    await fs.writeFile(path.join(ctx, "phase1", "00_spec.md"), "spec");
    await fs.writeFile(path.join(ctx, "phase1", "01_confluence_prd.md"), "prd");
    await fs.writeFile(path.join(ctx, "phase2", "00_spec_confirmed.md"), "spec");

    const result = await scanMemoryDirectoryAt(tmpDir);
    expect(result.memories).toHaveLength(1);
    const mem = result.memories[0]!;
    expect(mem.name).toBe("260122_instant-account");
    expect(mem.files.map((f) => f.fileName).sort()).toEqual(["05_log.md", "99_history.md"]);
    expect(mem.subdirs.map((s) => s.name).sort()).toEqual(["phase1", "phase2"]);

    const phase1 = mem.subdirs.find((s) => s.name === "phase1")!;
    expect(phase1.files.map((f) => f.fileName).sort()).toEqual([
      "00_spec.md",
      "01_confluence_prd.md",
    ]);
    expect(phase1.subdirs).toHaveLength(0);
  });

  it("recurses deeper than one level", async () => {
    const ctx = path.join(tmpDir, "260122_foo");
    await fs.mkdir(path.join(ctx, "phase1", "subphase"), { recursive: true });
    await fs.writeFile(path.join(ctx, "phase1", "subphase", "00_spec.md"), "spec");

    const result = await scanMemoryDirectoryAt(tmpDir);
    const mem = result.memories[0]!;
    expect(mem.subdirs[0]!.name).toBe("phase1");
    expect(mem.subdirs[0]!.subdirs[0]!.name).toBe("subphase");
    expect(mem.subdirs[0]!.subdirs[0]!.files[0]!.fileName).toBe("00_spec.md");
  });

  it("skips hidden subdirs (.git etc)", async () => {
    const ctx = path.join(tmpDir, "260122_foo");
    await fs.mkdir(path.join(ctx, ".git"), { recursive: true });
    await fs.writeFile(path.join(ctx, ".git", "config"), "x");
    await fs.writeFile(path.join(ctx, "05_log.md"), "log");

    const result = await scanMemoryDirectoryAt(tmpDir);
    const mem = result.memories[0]!;
    expect(mem.subdirs).toHaveLength(0);
    expect(mem.files.map((f) => f.fileName)).toEqual(["05_log.md"]);
  });
});

describe("scanTasksDirectoryAt (recursive subdirs under context)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "memdir-scan-tasks-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("collects subdirs and direct files under a task context", async () => {
    const ctx = path.join(tmpDir, "260122_task");
    await fs.mkdir(path.join(ctx, "round1"), { recursive: true });
    await fs.writeFile(path.join(ctx, "00_plan.md"), "plan");
    await fs.writeFile(path.join(ctx, "round1", "01_step.md"), "step");

    const result = await scanTasksDirectoryAt(tmpDir);
    expect(result.tasks).toHaveLength(1);
    const t = result.tasks[0]!;
    expect(t.files).toHaveLength(1);
    expect(t.files[0]!.fileName).toBe("00_plan.md");
    expect(t.files[0]!.isPlan).toBe(true);
    expect(t.subdirs[0]!.name).toBe("round1");
    expect(t.subdirs[0]!.files[0]!.fileName).toBe("01_step.md");
    expect(t.subdirs[0]!.files[0]!.order).toBe(1);
  });
});
