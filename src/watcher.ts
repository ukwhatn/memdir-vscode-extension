import * as vscode from "vscode";
import { SUBDIR_ISSUES, SUBDIR_MEMORY, SUBDIR_TASKS } from "./constants.js";
import { resolveAll } from "./memdir/resolver.js";

type Targets = {
  refreshMemory: () => void;
  refreshTasks: () => void;
  refreshIssues: () => void;
};

const DEBOUNCE_MS = 300;

export class MemdirWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly targets: Targets) {}

  async init(): Promise<void> {
    await this.rebuild();
  }

  async rebuild(): Promise<void> {
    this.disposeWatchers();
    const resolved = await resolveAll();
    for (const r of resolved) {
      this.addWatcher(r.memdirPath, SUBDIR_MEMORY, this.targets.refreshMemory);
      this.addWatcher(r.memdirPath, SUBDIR_TASKS, this.targets.refreshTasks);
      this.addWatcher(r.memdirPath, SUBDIR_ISSUES, this.targets.refreshIssues);
    }
  }

  private addWatcher(memdirPath: string, subdir: string, refresh: () => void): void {
    const pattern = new vscode.RelativePattern(memdirPath, `${subdir}/**/*`);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const key = `${memdirPath}::${subdir}`;
    const trigger = (): void => {
      const existing = this.debounceTimers.get(key);
      if (existing) clearTimeout(existing);
      this.debounceTimers.set(
        key,
        setTimeout(() => {
          this.debounceTimers.delete(key);
          refresh();
        }, DEBOUNCE_MS),
      );
    };
    watcher.onDidCreate(trigger);
    watcher.onDidChange(trigger);
    watcher.onDidDelete(trigger);
    this.watchers.push(watcher);
  }

  private disposeWatchers(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
    for (const t of this.debounceTimers.values()) {
      clearTimeout(t);
    }
    this.debounceTimers.clear();
  }

  dispose(): void {
    this.disposeWatchers();
  }
}
