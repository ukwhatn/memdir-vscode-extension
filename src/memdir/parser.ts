import {
  type Perspective,
  STANDARD_MEMORY_FILE_MAP,
  type Severity,
  TASK_PLAN_FILE,
  isPerspective,
  isSeverity,
} from "../constants.js";
import type { IssueEntry, MemoryFileEntry, TaskFileEntry } from "./types.js";

const NUMBERED_FILE_PATTERN = /^(\d+)_(.+)\.md$/;

export function parseMemoryFile(fileName: string, absolutePath: string): MemoryFileEntry {
  const standard = STANDARD_MEMORY_FILE_MAP.get(fileName);
  if (standard) {
    return {
      fileName,
      absolutePath,
      isStandard: true,
      order: standard.order,
      icon: standard.icon,
      label: fileName,
    };
  }
  const match = NUMBERED_FILE_PATTERN.exec(fileName);
  if (match) {
    const num = Number.parseInt(match[1]!, 10);
    const name = match[2]!.replace(/[-_]/g, " ");
    return {
      fileName,
      absolutePath,
      isStandard: false,
      order: num,
      icon: "file",
      label: `${match[1]!.padStart(2, "0")}: ${name}`,
    };
  }
  return {
    fileName,
    absolutePath,
    isStandard: false,
    order: Number.POSITIVE_INFINITY,
    icon: "file",
    label: fileName,
  };
}

const TASK_FILE_PATTERN = NUMBERED_FILE_PATTERN;

export function parseTaskFile(fileName: string, absolutePath: string): TaskFileEntry {
  if (fileName === TASK_PLAN_FILE) {
    return {
      fileName,
      absolutePath,
      isPlan: true,
      order: -1,
      label: fileName,
    };
  }
  const match = TASK_FILE_PATTERN.exec(fileName);
  if (match) {
    const num = Number.parseInt(match[1]!, 10);
    const name = match[2]!.replace(/[-_]/g, " ");
    return {
      fileName,
      absolutePath,
      isPlan: false,
      order: num,
      label: `${match[1]!.padStart(2, "0")}: ${name}`,
    };
  }
  return {
    fileName,
    absolutePath,
    isPlan: false,
    order: Number.POSITIVE_INFINITY,
    label: fileName,
  };
}

const ISSUE_NAME_PATTERN = /^([a-z]+)-([a-z]+)-(.+)\.md$/i;

export function parseIssueFile(fileName: string, absolutePath: string, mtime: number): IssueEntry {
  const match = ISSUE_NAME_PATTERN.exec(fileName);
  if (!match) {
    return {
      fileName,
      absolutePath,
      severity: "unknown",
      perspective: "unknown",
      title: fileName.replace(/\.md$/, ""),
      mtime,
    };
  }
  const sev = match[1]!.toLowerCase();
  const persp = match[2]!.toLowerCase();
  const title = match[3]!;
  const severity: Severity | "unknown" = isSeverity(sev) ? sev : "unknown";
  const perspective: Perspective | "unknown" = isPerspective(persp) ? persp : "unknown";
  return {
    fileName,
    absolutePath,
    severity,
    perspective,
    title,
    mtime,
  };
}

const DIR_NAME_PATTERN = /^(\d{6})_(.+)$/;

export function isMemdirContextDir(name: string): boolean {
  return DIR_NAME_PATTERN.test(name);
}

export function extractFirstHeading(content: string): string | undefined {
  for (const line of content.split(/\r?\n/, 50)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      return trimmed.replace(/^#+\s*/, "");
    }
  }
  return undefined;
}

const MEMORY_DIR_LINE_PATTERN =
  /^[\s>*-]*\*{0,2}\s*MEMORY_DIR\s*\*{0,2}\s*[:=]\s*[`"']?([^\s`"'#]+?)[`"']?\s*$/im;

export function parseMemoryDirFromClaudeMd(content: string): string | undefined {
  const match = MEMORY_DIR_LINE_PATTERN.exec(content);
  if (!match) {
    return undefined;
  }
  return match[1]!.trim();
}
