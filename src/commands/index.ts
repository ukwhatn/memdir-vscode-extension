import * as path from "node:path";
import * as vscode from "vscode";
import { SEVERITIES, type Severity } from "../constants.js";
import type { IssuesTreeDataProvider } from "../views/issuesView.js";
import type { MemoryTreeDataProvider } from "../views/memoryView.js";
import type { TasksTreeDataProvider } from "../views/tasksView.js";

type Providers = {
  memory: MemoryTreeDataProvider;
  tasks: TasksTreeDataProvider;
  issues: IssuesTreeDataProvider;
};

export function registerCommands(
  context: vscode.ExtensionContext,
  providers: Providers,
  onResolveChange: () => Promise<void>,
): void {
  const disposables: vscode.Disposable[] = [
    vscode.commands.registerCommand("memdir.refresh", () => {
      providers.memory.refresh();
      providers.tasks.refresh();
      providers.issues.refresh();
    }),
    vscode.commands.registerCommand("memdir.refreshMemory", () => providers.memory.refresh()),
    vscode.commands.registerCommand("memdir.refreshTasks", () => providers.tasks.refresh()),
    vscode.commands.registerCommand("memdir.refreshIssues", () => providers.issues.refresh()),

    vscode.commands.registerCommand("memdir.openSettings", () =>
      vscode.commands.executeCommand("workbench.action.openSettings", "@ext:ukwhatn-local.memdir"),
    ),

    vscode.commands.registerCommand("memdir.revealInOS", (node: unknown) => {
      const uri = extractUri(node);
      if (uri) vscode.commands.executeCommand("revealFileInOS", uri);
    }),

    vscode.commands.registerCommand("memdir.copyPath", async (node: unknown) => {
      const uri = extractUri(node);
      if (uri) {
        await vscode.env.clipboard.writeText(uri.fsPath);
        vscode.window.setStatusBarMessage(`Memdir: copied ${uri.fsPath}`, 2000);
      }
    }),

    vscode.commands.registerCommand("memdir.copyRelativePath", async (node: unknown) => {
      const uri = extractUri(node);
      if (!uri) return;
      const folder = vscode.workspace.getWorkspaceFolder(uri);
      const rel = folder ? path.relative(folder.uri.fsPath, uri.fsPath) : uri.fsPath;
      await vscode.env.clipboard.writeText(rel);
      vscode.window.setStatusBarMessage(`Memdir: copied ${rel}`, 2000);
    }),

    vscode.commands.registerCommand("memdir.issues.toggleGroupBy", () =>
      providers.issues.toggleGroupBy(),
    ),

    vscode.commands.registerCommand("memdir.issues.filter", async () => {
      const value = await vscode.window.showInputBox({
        prompt: "Filter Issues by title (empty to clear)",
        value: "",
      });
      if (value === undefined) return;
      providers.issues.setTitleFilter(value);
    }),

    vscode.commands.registerCommand("memdir.issues.clearFilter", () => {
      providers.issues.clearFilters();
    }),

    vscode.commands.registerCommand("memdir.issues.filterBySeverity", async () => {
      const picks: vscode.QuickPickItem[] = [
        { label: "all" },
        ...SEVERITIES.map<vscode.QuickPickItem>((s) => ({ label: s })),
        { label: "unknown" },
      ];
      const picked = await vscode.window.showQuickPick(picks, {
        placeHolder: "Filter Issues by severity",
      });
      if (!picked) return;
      providers.issues.setSeverityFilter(picked.label as Severity | "unknown" | "all");
    }),

    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("memdir")) {
        providers.issues.reloadConfig();
        await onResolveChange();
        providers.memory.refresh();
        providers.tasks.refresh();
        providers.issues.refresh();
      }
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await onResolveChange();
      providers.memory.refresh();
      providers.tasks.refresh();
      providers.issues.refresh();
    }),
  ];

  for (const d of disposables) context.subscriptions.push(d);
}

function extractUri(node: unknown): vscode.Uri | undefined {
  if (!node) return undefined;
  if (node instanceof vscode.Uri) return node;
  if (typeof node === "object" && node !== null) {
    const anyNode = node as { resourceUri?: vscode.Uri };
    if (anyNode.resourceUri) return anyNode.resourceUri;
  }
  return undefined;
}
