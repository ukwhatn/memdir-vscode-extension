import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { DEFAULT_MEMORY_DIR } from "../constants.js";
import { parseMemoryDirFromClaudeMd } from "./parser.js";
import { resolveMemdirPath } from "./pathUtils.js";
import type { ResolvedMemoryDir } from "./types.js";

export async function resolveAll(): Promise<ResolvedMemoryDir[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return [];
  }
  const results: ResolvedMemoryDir[] = [];
  for (const folder of folders) {
    results.push(await resolveForFolder(folder));
  }
  return results;
}

async function resolveForFolder(folder: vscode.WorkspaceFolder): Promise<ResolvedMemoryDir> {
  const folderPath = folder.uri.fsPath;
  const config = vscode.workspace.getConfiguration("memdir", folder.uri);
  const settingRaw = config.get<string>("directoryPath", "").trim();

  let memdirPath: string;
  let source: ResolvedMemoryDir["source"];

  if (settingRaw.length > 0) {
    memdirPath = resolveMemdirPath(settingRaw, folderPath);
    source = "setting";
  } else {
    const fromClaudeMd = await tryReadMemoryDirFromClaudeMd(folderPath);
    if (fromClaudeMd) {
      memdirPath = resolveMemdirPath(fromClaudeMd, folderPath);
      source = "claude-md";
    } else {
      memdirPath = path.join(folderPath, DEFAULT_MEMORY_DIR);
      source = "default";
    }
  }

  const exists = await pathExists(memdirPath);

  return {
    workspaceFolderName: folder.name,
    workspaceFolderPath: folderPath,
    memdirPath,
    source,
    exists,
  };
}

async function tryReadMemoryDirFromClaudeMd(folderPath: string): Promise<string | undefined> {
  const claudeMdPath = path.join(folderPath, "CLAUDE.md");
  try {
    const content = await fs.readFile(claudeMdPath, "utf8");
    return parseMemoryDirFromClaudeMd(content);
  } catch {
    return undefined;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
