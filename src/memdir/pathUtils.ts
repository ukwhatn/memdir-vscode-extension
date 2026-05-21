import * as os from "node:os";
import * as path from "node:path";

export function expandHome(p: string, homeDir: string = os.homedir()): string {
  if (p === "~") {
    return homeDir;
  }
  if (p.startsWith("~/")) {
    return path.join(homeDir, p.slice(2));
  }
  return p;
}

export function resolveMemdirPath(rawInput: string, workspaceFolderPath: string): string {
  const expanded = expandHome(rawInput);
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }
  return path.normalize(path.join(workspaceFolderPath, expanded));
}
