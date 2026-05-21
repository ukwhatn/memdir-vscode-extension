import type { Perspective, Severity } from "../constants.js";

export type MemoryEntry = {
  name: string;
  absolutePath: string;
  mtime: number;
  files: MemoryFileEntry[];
};

export type MemoryFileEntry = {
  fileName: string;
  absolutePath: string;
  isStandard: boolean;
  order: number;
  icon: string;
  label: string;
};

export type TaskEntry = {
  name: string;
  absolutePath: string;
  mtime: number;
  files: TaskFileEntry[];
};

export type TaskFileEntry = {
  fileName: string;
  absolutePath: string;
  isPlan: boolean;
  order: number;
  label: string;
};

export type IssueEntry = {
  fileName: string;
  absolutePath: string;
  severity: Severity | "unknown";
  perspective: Perspective | "unknown";
  title: string;
  mtime: number;
};

export type WrapperDirEntry = {
  name: string;
  absolutePath: string;
};

export type MemoryScanResult = {
  memories: MemoryEntry[];
  wrappers: WrapperDirEntry[];
};

export type TaskScanResult = {
  tasks: TaskEntry[];
  wrappers: WrapperDirEntry[];
};

export type IssueScanResult = {
  issues: IssueEntry[];
  wrappers: WrapperDirEntry[];
};

export type ResolvedMemoryDir = {
  workspaceFolderName: string;
  workspaceFolderPath: string;
  memdirPath: string;
  source: "setting" | "claude-md" | "default";
  exists: boolean;
};
