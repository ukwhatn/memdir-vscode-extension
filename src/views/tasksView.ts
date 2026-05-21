import * as vscode from "vscode";
import { resolveAll } from "../memdir/resolver.js";
import { scanTasksDirectoryAt, scanTasksSubdir } from "../memdir/scanner.js";
import type {
  ResolvedMemoryDir,
  TaskEntry,
  TaskFileEntry,
  TaskScanResult,
  WrapperDirEntry,
} from "../memdir/types.js";

type FolderNode = { kind: "folder"; resolved: ResolvedMemoryDir };
type WrapperNode = { kind: "wrapper"; wrapper: WrapperDirEntry };
type TaskContextNode = { kind: "context"; entry: TaskEntry };
type TaskFileNode = { kind: "file"; entry: TaskEntry; file: TaskFileEntry };

type TaskNode = FolderNode | WrapperNode | TaskContextNode | TaskFileNode;

export class TasksTreeDataProvider implements vscode.TreeDataProvider<TaskNode> {
  private readonly _onDidChange = new vscode.EventEmitter<TaskNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire();
  }

  async getChildren(element?: TaskNode): Promise<TaskNode[]> {
    const sortMode = vscode.workspace
      .getConfiguration("memdir")
      .get<"updated" | "name">("sort.directories", "updated");

    if (!element) {
      const resolved = await resolveAll();
      const existing = resolved.filter((r) => r.exists);
      if (existing.length === 0) return [];
      if (existing.length === 1) {
        const scan = await scanTasksSubdir(existing[0]!.memdirPath);
        return buildContextLayer(scan, sortMode);
      }
      return existing.map<FolderNode>((r) => ({ kind: "folder", resolved: r }));
    }

    if (element.kind === "folder") {
      const scan = await scanTasksSubdir(element.resolved.memdirPath);
      return buildContextLayer(scan, sortMode);
    }

    if (element.kind === "wrapper") {
      const scan = await scanTasksDirectoryAt(element.wrapper.absolutePath);
      return buildContextLayer(scan, sortMode);
    }

    if (element.kind === "context") {
      const sorted = [...element.entry.files].sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a.fileName.localeCompare(b.fileName);
      });
      return sorted.map<TaskFileNode>((file) => ({ kind: "file", entry: element.entry, file }));
    }

    return [];
  }

  getTreeItem(element: TaskNode): vscode.TreeItem {
    if (element.kind === "folder") {
      const item = new vscode.TreeItem(
        element.resolved.workspaceFolderName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("folder");
      item.tooltip = element.resolved.memdirPath;
      item.description = `(${element.resolved.source})`;
      item.contextValue = "memdir.tasks.folder";
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
      item.contextValue = "memdir.tasks.wrapper";
      return item;
    }
    if (element.kind === "context") {
      const item = new vscode.TreeItem(
        element.entry.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = new vscode.ThemeIcon("rocket");
      item.description = `${element.entry.files.length} files`;
      item.tooltip = element.entry.absolutePath;
      item.resourceUri = vscode.Uri.file(element.entry.absolutePath);
      item.contextValue = "memdir.tasks.context";
      return item;
    }
    const item = new vscode.TreeItem(element.file.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(element.file.isPlan ? "list-tree" : "tasklist");
    item.resourceUri = vscode.Uri.file(element.file.absolutePath);
    item.tooltip = element.file.absolutePath;
    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [item.resourceUri],
    };
    item.contextValue = "memdir.tasks.file";
    return item;
  }
}

function buildContextLayer(
  scan: TaskScanResult,
  sortMode: "updated" | "name",
): (TaskContextNode | WrapperNode)[] {
  const sortedTasks =
    sortMode === "name"
      ? [...scan.tasks].sort((a, b) => b.name.localeCompare(a.name))
      : [...scan.tasks].sort((a, b) => b.mtime - a.mtime);
  const contexts = sortedTasks.map<TaskContextNode>((entry) => ({ kind: "context", entry }));
  const wrappers = scan.wrappers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map<WrapperNode>((wrapper) => ({ kind: "wrapper", wrapper }));
  return [...contexts, ...wrappers];
}
