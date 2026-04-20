import { simpleGit, type SimpleGit, type LogResult } from "simple-git";
import { type CommitEntry } from "../types.js";

let git: SimpleGit;

export function initGit(cwd?: string): SimpleGit {
  git = simpleGit(cwd);
  return git;
}

export function getGit(): SimpleGit {
  if (!git) throw new Error("Git not initialized. Call initGit() first.");
  return git;
}

export async function findRepoRoot(): Promise<string> {
  const g = getGit();
  const root = await g.revparse(["--show-toplevel"]);
  return root.trim();
}

export async function getCurrentBranch(): Promise<string> {
  const g = getGit();
  const branch = await g.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
}

export async function getRemoteUrl(): Promise<string> {
  const g = getGit();
  try {
    const remotes = await g.getRemotes(true);
    const origin = remotes.find((r) => r.name === "origin");
    if (!origin) return "";
    let url = origin.refs.fetch || origin.refs.push || "";
    url = url.replace(/^(git@|https?:\/\/)[\w.]+[:/]/, "");
    url = url.replace(/\.git$/, "");
    return url;
  } catch {
    return "";
  }
}

export async function getCommitLog(maxCount: number = 30): Promise<CommitEntry[]> {
  const g = getGit();
  try {
    const log: LogResult = await g.log({
      maxCount,
      "--stat": null,
    } as any);

    return log.all.map((entry) => ({
      hash: entry.hash.slice(0, 8),
      author: entry.author_name,
      date: entry.date.slice(0, 10),
      message: entry.message,
      filesChanged: (entry as any).diff?.files?.map((f: any) => f.file) || [],
      insertions: (entry as any).diff?.insertions || 0,
      deletions: (entry as any).diff?.deletions || 0,
    }));
  } catch {
    return [];
  }
}

export async function getCommitsSince(hash: string): Promise<number> {
  const g = getGit();
  try {
    const log = await g.log({ from: hash, to: "HEAD" });
    return log.total;
  } catch {
    return 0;
  }
}

export async function getLatestCommitHash(): Promise<string> {
  const g = getGit();
  try {
    const hash = await g.revparse(["HEAD"]);
    return hash.trim().slice(0, 8);
  } catch {
    return "unknown";
  }
}

/**
 * Install git hooks for auto-sync
 */
export async function installHooks(repoRoot: string, hooks: string[]): Promise<string[]> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const hooksDir = path.join(repoRoot, ".git", "hooks");
  const installed: string[] = [];

  const hookScript = `#!/bin/sh
# dev-context: auto-update context
if command -v dev-context > /dev/null 2>&1; then
  dev-context update --silent &
elif command -v devcontext > /dev/null 2>&1; then
  devcontext update --silent &
elif command -v dctx > /dev/null 2>&1; then
  dctx update --silent &
elif command -v npx > /dev/null 2>&1; then
  npx @incals/dev-context update --silent &
fi
`;

  for (const hookName of hooks) {
    const hookPath = path.join(hooksDir, hookName);
    try {
      const existing = await fs.readFile(hookPath, "utf-8").catch(() => "");
      if (existing.includes("dev-context") || existing.includes("devcontext")) continue;

      if (existing) {
        await fs.appendFile(hookPath, "\n" + hookScript);
      } else {
        await fs.writeFile(hookPath, hookScript);
      }
      await fs.chmod(hookPath, 0o755);
      installed.push(hookName);
    } catch {
      // skip
    }
  }
  return installed;
}
