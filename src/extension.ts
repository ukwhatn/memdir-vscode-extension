import * as vscode from "vscode";
import { registerCommands } from "./commands/index.js";
import { IssuesTreeDataProvider } from "./views/issuesView.js";
import { MemoryTreeDataProvider } from "./views/memoryView.js";
import { TasksTreeDataProvider } from "./views/tasksView.js";
import { MemdirWatcher } from "./watcher.js";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const memory = new MemoryTreeDataProvider();
  const tasks = new TasksTreeDataProvider();
  const issues = new IssuesTreeDataProvider();
  issues.reloadConfig();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("memdir.memoryView", memory),
    vscode.window.registerTreeDataProvider("memdir.tasksView", tasks),
    vscode.window.registerTreeDataProvider("memdir.issuesView", issues),
  );

  const watcher = new MemdirWatcher({
    refreshMemory: () => memory.refresh(),
    refreshTasks: () => tasks.refresh(),
    refreshIssues: () => issues.refresh(),
  });
  context.subscriptions.push(watcher);
  await watcher.init();

  registerCommands(context, { memory, tasks, issues }, async () => {
    await watcher.rebuild();
  });

  await vscode.commands.executeCommand("setContext", "memdir.issues.hasFilter", false);
}

export function deactivate(): void {
  // disposables are tracked via context.subscriptions
}
