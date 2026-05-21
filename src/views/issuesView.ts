import * as vscode from "vscode";
import {
  PERSPECTIVES,
  PERSPECTIVE_META,
  type Perspective,
  SEVERITIES,
  SEVERITY_COLOR,
  SEVERITY_ORDER,
  type Severity,
  UNKNOWN_GROUP,
  isPerspective,
  isSeverity,
} from "../constants.js";
import { resolveAll } from "../memdir/resolver.js";
import { scanIssuesDirectoryAt, scanIssuesSubdir } from "../memdir/scanner.js";
import type {
  IssueEntry,
  IssueScanResult,
  ResolvedMemoryDir,
  WrapperDirEntry,
} from "../memdir/types.js";

export type IssuesViewState = {
  groupBy: "severity" | "perspective";
  titleFilter: string;
  severityFilter: Severity | "unknown" | "all";
};

type FolderNode = { kind: "folder"; resolved: ResolvedMemoryDir };
type WrapperNode = { kind: "wrapper"; wrapper: WrapperDirEntry };
type GroupNode = {
  kind: "group";
  groupKey: string;
  issues: IssueEntry[];
};
type IssueNode = { kind: "issue"; issue: IssueEntry };

type IssuesNode = FolderNode | WrapperNode | GroupNode | IssueNode;

export class IssuesTreeDataProvider implements vscode.TreeDataProvider<IssuesNode> {
  private readonly _onDidChange = new vscode.EventEmitter<IssuesNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  state: IssuesViewState = {
    groupBy: "severity",
    titleFilter: "",
    severityFilter: "all",
  };

  reloadConfig(): void {
    const cfg = vscode.workspace.getConfiguration("memdir");
    const groupBy = cfg.get<"severity" | "perspective">("issues.groupBy", "severity");
    this.state.groupBy = groupBy;
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  toggleGroupBy(): void {
    this.state.groupBy = this.state.groupBy === "severity" ? "perspective" : "severity";
    vscode.workspace
      .getConfiguration("memdir")
      .update("issues.groupBy", this.state.groupBy, vscode.ConfigurationTarget.Workspace);
    this.refresh();
  }

  setTitleFilter(value: string): void {
    this.state.titleFilter = value.trim();
    vscode.commands.executeCommand("setContext", "memdir.issues.hasFilter", this.hasFilter());
    this.refresh();
  }

  setSeverityFilter(value: Severity | "unknown" | "all"): void {
    this.state.severityFilter = value;
    vscode.commands.executeCommand("setContext", "memdir.issues.hasFilter", this.hasFilter());
    this.refresh();
  }

  clearFilters(): void {
    this.state.titleFilter = "";
    this.state.severityFilter = "all";
    vscode.commands.executeCommand("setContext", "memdir.issues.hasFilter", false);
    this.refresh();
  }

  private hasFilter(): boolean {
    return this.state.titleFilter.length > 0 || this.state.severityFilter !== "all";
  }

  async getChildren(element?: IssuesNode): Promise<IssuesNode[]> {
    const cfg = vscode.workspace.getConfiguration("memdir");
    const hideEmpty = cfg.get<boolean>("issues.hideEmptyGroups", true);

    if (!element) {
      const resolved = await resolveAll();
      const existing = resolved.filter((r) => r.exists);
      if (existing.length === 0) return [];
      if (existing.length === 1) {
        const scan = await scanIssuesSubdir(existing[0]!.memdirPath);
        return buildLayer(this.state, scan, hideEmpty);
      }
      return existing.map<FolderNode>((r) => ({ kind: "folder", resolved: r }));
    }

    if (element.kind === "folder") {
      const scan = await scanIssuesSubdir(element.resolved.memdirPath);
      return buildLayer(this.state, scan, hideEmpty);
    }

    if (element.kind === "wrapper") {
      const scan = await scanIssuesDirectoryAt(element.wrapper.absolutePath);
      return buildLayer(this.state, scan, hideEmpty);
    }

    if (element.kind === "group") {
      return element.issues
        .slice()
        .sort((a, b) => sortIssue(a, b, this.state.groupBy))
        .map<IssueNode>((issue) => ({ kind: "issue", issue }));
    }

    return [];
  }

  getTreeItem(element: IssuesNode): vscode.TreeItem {
    if (element.kind === "folder") {
      const item = new vscode.TreeItem(
        element.resolved.workspaceFolderName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("folder");
      item.tooltip = element.resolved.memdirPath;
      item.contextValue = "memdir.issues.folder";
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
      item.contextValue = "memdir.issues.wrapper";
      return item;
    }
    if (element.kind === "group") {
      const meta = describeGroup(element.groupKey, this.state.groupBy);
      const item = new vscode.TreeItem(
        meta.label,
        element.issues.length > 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = meta.icon;
      item.description = `${element.issues.length}`;
      item.contextValue = "memdir.issues.group";
      return item;
    }
    const meta = describeIssue(element.issue, this.state.groupBy);
    const item = new vscode.TreeItem(meta.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = meta.icon;
    item.description = meta.description;
    item.tooltip = element.issue.absolutePath;
    item.resourceUri = vscode.Uri.file(element.issue.absolutePath);
    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [item.resourceUri],
    };
    item.contextValue = "memdir.issues.issue";
    return item;
  }
}

function buildLayer(
  state: IssuesViewState,
  scan: IssueScanResult,
  hideEmpty: boolean,
): (GroupNode | WrapperNode)[] {
  const filtered = filterIssues(scan.issues, state);
  const groups = buildGroups(filtered, state.groupBy, hideEmpty);
  const wrappers = scan.wrappers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map<WrapperNode>((wrapper) => ({ kind: "wrapper", wrapper }));
  return [...groups, ...wrappers];
}

function filterIssues(issues: IssueEntry[], state: IssuesViewState): IssueEntry[] {
  const titleNeedle = state.titleFilter.toLowerCase();
  return issues.filter((issue) => {
    if (state.severityFilter !== "all" && issue.severity !== state.severityFilter) {
      return false;
    }
    if (titleNeedle.length > 0 && !issue.title.toLowerCase().includes(titleNeedle)) {
      return false;
    }
    return true;
  });
}

function buildGroups(
  issues: IssueEntry[],
  groupBy: "severity" | "perspective",
  hideEmpty: boolean,
): GroupNode[] {
  const keys = orderedGroupKeys(groupBy);
  const buckets = new Map<string, IssueEntry[]>();
  for (const key of keys) {
    buckets.set(key, []);
  }
  for (const issue of issues) {
    const key = groupBy === "severity" ? issue.severity : issue.perspective;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(issue);
  }
  const groups: GroupNode[] = [];
  for (const [key, list] of buckets.entries()) {
    if (hideEmpty && list.length === 0) {
      continue;
    }
    groups.push({ kind: "group", groupKey: key, issues: list });
  }
  return groups;
}

function orderedGroupKeys(groupBy: "severity" | "perspective"): string[] {
  if (groupBy === "severity") {
    return [...SEVERITIES, UNKNOWN_GROUP];
  }
  return [...PERSPECTIVES, UNKNOWN_GROUP];
}

function sortIssue(a: IssueEntry, b: IssueEntry, groupBy: "severity" | "perspective"): number {
  if (groupBy === "severity") {
    const ap = perspectiveOrder(a.perspective);
    const bp = perspectiveOrder(b.perspective);
    if (ap !== bp) return ap - bp;
  } else {
    const as = severityOrder(a.severity);
    const bs = severityOrder(b.severity);
    if (as !== bs) return as - bs;
  }
  return a.title.localeCompare(b.title);
}

function severityOrder(s: Severity | "unknown"): number {
  if (isSeverity(s)) {
    return SEVERITY_ORDER[s];
  }
  return Number.POSITIVE_INFINITY;
}

function perspectiveOrder(p: Perspective | "unknown"): number {
  const idx = (PERSPECTIVES as readonly string[]).indexOf(p);
  return idx >= 0 ? idx : Number.POSITIVE_INFINITY;
}

function describeGroup(
  key: string,
  groupBy: "severity" | "perspective",
): { label: string; icon: vscode.ThemeIcon } {
  if (groupBy === "severity") {
    if (isSeverity(key)) {
      return {
        label: key,
        icon: new vscode.ThemeIcon(
          "circle-large-filled",
          new vscode.ThemeColor(SEVERITY_COLOR[key]),
        ),
      };
    }
    return { label: "unknown", icon: new vscode.ThemeIcon("question") };
  }
  if (isPerspective(key)) {
    const meta = PERSPECTIVE_META[key];
    return { label: `${key} (${meta.label})`, icon: new vscode.ThemeIcon(meta.icon) };
  }
  return { label: "unknown", icon: new vscode.ThemeIcon("question") };
}

function describeIssue(
  issue: IssueEntry,
  groupBy: "severity" | "perspective",
): { label: string; description: string; icon: vscode.ThemeIcon } {
  const label = issue.title;
  if (groupBy === "severity") {
    const perspIcon = isPerspective(issue.perspective)
      ? PERSPECTIVE_META[issue.perspective].icon
      : "question";
    return {
      label,
      description: issue.perspective,
      icon: new vscode.ThemeIcon(perspIcon),
    };
  }
  const color = isSeverity(issue.severity)
    ? new vscode.ThemeColor(SEVERITY_COLOR[issue.severity])
    : undefined;
  return {
    label,
    description: issue.severity,
    icon: new vscode.ThemeIcon("circle-large-filled", color),
  };
}
