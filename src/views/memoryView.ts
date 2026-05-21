import * as path from "node:path";
import * as vscode from "vscode";
import { resolveAll } from "../memdir/resolver.js";
import { scanMemoryDirectoryAt, scanMemorySubdir } from "../memdir/scanner.js";
import type {
  MemoryEntry,
  MemoryFileEntry,
  MemoryScanResult,
  ResolvedMemoryDir,
  WrapperDirEntry,
} from "../memdir/types.js";

type FolderNode = { kind: "folder"; resolved: ResolvedMemoryDir };
type WrapperNode = { kind: "wrapper"; wrapper: WrapperDirEntry };
type ContextNode = { kind: "context"; entry: MemoryEntry };
type OtherGroupNode = { kind: "othergroup"; entry: MemoryEntry };
type FileNode = { kind: "file"; entry: MemoryEntry; file: MemoryFileEntry };

type MemoryNode = FolderNode | WrapperNode | ContextNode | OtherGroupNode | FileNode;

export class MemoryTreeDataProvider implements vscode.TreeDataProvider<MemoryNode> {
  private readonly _onDidChange = new vscode.EventEmitter<MemoryNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire();
  }

  async getChildren(element?: MemoryNode): Promise<MemoryNode[]> {
    const sortMode = getDirSortMode();

    if (!element) {
      const resolved = await resolveAll();
      const existing = resolved.filter((r) => r.exists);
      if (existing.length === 0) return [];
      if (existing.length === 1) {
        const scan = await scanMemorySubdir(existing[0]!.memdirPath);
        return buildContextLayer(scan, sortMode);
      }
      return existing.map<FolderNode>((r) => ({ kind: "folder", resolved: r }));
    }

    if (element.kind === "folder") {
      const scan = await scanMemorySubdir(element.resolved.memdirPath);
      return buildContextLayer(scan, sortMode);
    }

    if (element.kind === "wrapper") {
      const scan = await scanMemoryDirectoryAt(element.wrapper.absolutePath);
      return buildContextLayer(scan, sortMode);
    }

    if (element.kind === "context") {
      const standardFiles = element.entry.files
        .filter((f) => f.isStandard)
        .sort((a, b) => a.order - b.order);
      const otherFiles = element.entry.files.filter((f) => !f.isStandard);

      const children: MemoryNode[] = standardFiles.map((file) => ({
        kind: "file",
        entry: element.entry,
        file,
      }));
      if (otherFiles.length > 0) {
        children.push({ kind: "othergroup", entry: element.entry });
      }
      return children;
    }

    if (element.kind === "othergroup") {
      return element.entry.files
        .filter((f) => !f.isStandard)
        .sort((a, b) => a.fileName.localeCompare(b.fileName))
        .map<FileNode>((file) => ({ kind: "file", entry: element.entry, file }));
    }

    return [];
  }

  getTreeItem(element: MemoryNode): vscode.TreeItem {
    if (element.kind === "folder") {
      const item = new vscode.TreeItem(
        element.resolved.workspaceFolderName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("folder");
      item.tooltip = element.resolved.memdirPath;
      item.description = `(${element.resolved.source})`;
      item.contextValue = "memdir.memory.folder";
      return item;
    }
    if (element.kind === "wrapper") {
      const item = new vscode.TreeItem(
        element.wrapper.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = new vscode.ThemeIcon("archive");
      item.tooltip = element.wrapper.absolutePath;
      item.resourceUri = vscode.Uri.file(element.wrapper.absolutePath);
      item.contextValue = "memdir.memory.wrapper";
      return item;
    }
    if (element.kind === "context") {
      const item = new vscode.TreeItem(
        element.entry.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = new vscode.ThemeIcon("calendar");
      item.tooltip = buildContextTooltip(element.entry);
      item.description = `${element.entry.files.length} files`;
      item.resourceUri = vscode.Uri.file(element.entry.absolutePath);
      item.contextValue = "memdir.memory.context";
      return item;
    }
    if (element.kind === "othergroup") {
      const item = new vscode.TreeItem("[other]", vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscode.ThemeIcon("ellipsis");
      item.contextValue = "memdir.memory.othergroup";
      return item;
    }
    const item = new vscode.TreeItem(element.file.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(element.file.icon);
    item.resourceUri = vscode.Uri.file(element.file.absolutePath);
    item.tooltip = element.file.absolutePath;
    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [item.resourceUri],
    };
    item.contextValue = "memdir.memory.file";
    return item;
  }
}

function buildContextLayer(
  scan: MemoryScanResult,
  sortMode: "updated" | "name",
): (ContextNode | WrapperNode)[] {
  const contexts = sortEntries(scan.memories, sortMode).map<ContextNode>((entry) => ({
    kind: "context",
    entry,
  }));
  const wrappers = scan.wrappers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map<WrapperNode>((wrapper) => ({ kind: "wrapper", wrapper }));
  return [...contexts, ...wrappers];
}

function sortEntries(entries: MemoryEntry[], mode: "updated" | "name"): MemoryEntry[] {
  if (mode === "name") {
    return [...entries].sort((a, b) => b.name.localeCompare(a.name));
  }
  return [...entries].sort((a, b) => b.mtime - a.mtime);
}

function getDirSortMode(): "updated" | "name" {
  return vscode.workspace
    .getConfiguration("memdir")
    .get<"updated" | "name">("sort.directories", "updated");
}

function buildContextTooltip(entry: MemoryEntry): string {
  const last = new Date(entry.mtime).toISOString().replace(/\..+$/, "");
  return `${entry.absolutePath}\nfiles: ${entry.files.length}\nupdated: ${last}\nrelative: ${path.basename(entry.absolutePath)}`;
}
