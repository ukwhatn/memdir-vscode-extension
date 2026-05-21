import * as fs from "node:fs/promises";
import * as path from "node:path";
import { SUBDIR_ISSUES, SUBDIR_MEMORY, SUBDIR_TASKS } from "../constants.js";
import { isMemdirContextDir, parseIssueFile, parseMemoryFile, parseTaskFile } from "./parser.js";
import type {
  IssueScanResult,
  MemoryEntry,
  MemoryScanResult,
  TaskEntry,
  TaskScanResult,
  WrapperDirEntry,
} from "./types.js";

export function isWrapperDirName(name: string): boolean {
  if (name.startsWith(".")) return false;
  if (isMemdirContextDir(name)) return false;
  return true;
}

export async function scanMemorySubdir(memdirPath: string): Promise<MemoryScanResult> {
  return scanMemoryDirectoryAt(path.join(memdirPath, SUBDIR_MEMORY));
}

export async function scanTasksSubdir(memdirPath: string): Promise<TaskScanResult> {
  return scanTasksDirectoryAt(path.join(memdirPath, SUBDIR_TASKS));
}

export async function scanIssuesSubdir(memdirPath: string): Promise<IssueScanResult> {
  return scanIssuesDirectoryAt(path.join(memdirPath, SUBDIR_ISSUES));
}

export async function scanMemoryDirectoryAt(dirPath: string): Promise<MemoryScanResult> {
  const { dirs, wrappers } = await splitDirEntries(dirPath);
  const memories: MemoryEntry[] = [];
  for (const d of dirs) {
    const files = await listFiles(d.absolutePath);
    const stat = await safeStat(d.absolutePath);
    memories.push({
      name: d.name,
      absolutePath: d.absolutePath,
      mtime: stat?.mtimeMs ?? 0,
      files: files.map((f) => parseMemoryFile(f.name, f.absolutePath)),
    });
  }
  return { memories, wrappers };
}

export async function scanTasksDirectoryAt(dirPath: string): Promise<TaskScanResult> {
  const { dirs, wrappers } = await splitDirEntries(dirPath);
  const tasks: TaskEntry[] = [];
  for (const d of dirs) {
    const files = await listFiles(d.absolutePath);
    const stat = await safeStat(d.absolutePath);
    tasks.push({
      name: d.name,
      absolutePath: d.absolutePath,
      mtime: stat?.mtimeMs ?? 0,
      files: files.map((f) => parseTaskFile(f.name, f.absolutePath)),
    });
  }
  return { tasks, wrappers };
}

export async function scanIssuesDirectoryAt(dirPath: string): Promise<IssueScanResult> {
  let dirents: import("node:fs").Dirent[];
  try {
    dirents = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return { issues: [], wrappers: [] };
  }
  const issues = [];
  const wrappers: WrapperDirEntry[] = [];
  for (const d of dirents) {
    const abs = path.join(dirPath, d.name);
    if (d.isDirectory()) {
      if (isWrapperDirName(d.name)) {
        wrappers.push({ name: d.name, absolutePath: abs });
      }
      continue;
    }
    if (!d.isFile() || !d.name.endsWith(".md")) continue;
    const stat = await safeStat(abs);
    issues.push(parseIssueFile(d.name, abs, stat?.mtimeMs ?? 0));
  }
  return { issues, wrappers };
}

async function splitDirEntries(
  rootDir: string,
): Promise<{ dirs: WrapperDirEntry[]; wrappers: WrapperDirEntry[] }> {
  let dirents: import("node:fs").Dirent[];
  try {
    dirents = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    return { dirs: [], wrappers: [] };
  }
  const dirs: WrapperDirEntry[] = [];
  const wrappers: WrapperDirEntry[] = [];
  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const abs = path.join(rootDir, d.name);
    if (isMemdirContextDir(d.name)) {
      dirs.push({ name: d.name, absolutePath: abs });
    } else if (isWrapperDirName(d.name)) {
      wrappers.push({ name: d.name, absolutePath: abs });
    }
  }
  return { dirs, wrappers };
}

async function listFiles(dir: string): Promise<{ name: string; absolutePath: string }[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files: { name: string; absolutePath: string }[] = [];
  for (const d of dirents) {
    if (d.isFile()) {
      files.push({ name: d.name, absolutePath: path.join(dir, d.name) });
    }
  }
  return files;
}

async function safeStat(p: string): Promise<import("node:fs").Stats | undefined> {
  try {
    return await fs.stat(p);
  } catch {
    return undefined;
  }
}
