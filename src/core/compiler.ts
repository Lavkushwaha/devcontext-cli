import fs from "fs/promises";
import path from "path";
import {
  type DevContextConfig,
  type ScanResult,
  type StackInfo,
  type CommitEntry,
  type ContextSnapshot,
  type TimeMachineEntry,
  CONTEXT_DIR,
  CONTEXT_FILE,
  SYSTEM_FILE,
  CHANGES_FILE,
  CONFIG_FILE,
  TIMEMACHINE_DIR,
} from "../types.js";
import { countTokens } from "../utils/tokens.js";
import { extractFilePurpose } from "./scanner.js";

// ─── Context Generation ─────────────────────────────────────────────────────

function generateOverview(
  repoRoot: string,
  scan: ScanResult,
  stack: StackInfo,
  branch: string,
  remote: string
): string {
  const name = path.basename(repoRoot);
  const lines: string[] = [];

  lines.push(`# ${name}`);
  if (remote) lines.push(`Repo: ${remote} | Branch: ${branch}`);
  lines.push("");

  // Stack
  const sortedLangs = Object.entries(scan.langStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (sortedLangs.length) {
    lines.push("## Stack");
    lines.push(`Languages: ${sortedLangs.map(([l, c]) => `${l} (${c})`).join(", ")}`);
  }
  if (stack.frameworks.length) {
    lines.push(`Frameworks: ${stack.frameworks.join(", ")}`);
  }
  if (stack.tools.length) {
    lines.push(`Tools: ${stack.tools.join(", ")}`);
  }
  lines.push("");

  // Structure
  lines.push("## Structure");
  const dirs = Object.entries(scan.dirStats).slice(0, 15);
  for (const [dir, count] of dirs) {
    lines.push(`  ${dir}/ (${count} files)`);
  }
  lines.push("");

  return lines.join("\n");
}

function generateHotZones(commits: CommitEntry[]): string {
  const freq: Record<string, number> = {};
  for (const c of commits) {
    for (const f of c.filesChanged) {
      freq[f] = (freq[f] || 0) + 1;
    }
  }

  const hot = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .filter(([, count]) => count >= 2);

  if (!hot.length) return "";

  const lines = ["## Hot zones (frequently changed)"];
  for (const [file, count] of hot) {
    lines.push(`  ${file} (${count} commits)`);
  }
  lines.push("");
  return lines.join("\n");
}

function generateRecentChanges(commits: CommitEntry[]): string {
  const lines = ["## Recent changes"];

  if (!commits.length) {
    lines.push("  No commits found.");
    return lines.join("\n");
  }

  // Group by date
  const byDate = new Map<string, CommitEntry[]>();
  for (const c of commits) {
    const existing = byDate.get(c.date) || [];
    existing.push(c);
    byDate.set(c.date, existing);
  }

  const dates = [...byDate.keys()].sort().reverse().slice(0, 10);
  for (const date of dates) {
    lines.push(`  [${date}]`);
    for (const c of byDate.get(date)!) {
      let filesHint = "";
      if (c.filesChanged.length) {
        const shown = c.filesChanged.slice(0, 3);
        const remaining = c.filesChanged.length - 3;
        filesHint = ` (${shown.join(", ")}`;
        if (remaining > 0) filesHint += ` +${remaining} more`;
        filesHint += ")";
      }
      lines.push(`    ${c.hash} ${c.message}${filesHint}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function generateFileMap(
  repoRoot: string,
  scan: ScanResult,
  config: DevContextConfig
): Promise<string> {
  const lines = ["## Key files"];

  // Priority files first
  for (const pf of config.priorityFiles) {
    const fullPath = path.join(repoRoot, pf);
    try {
      await fs.access(fullPath);
      const purpose = (await extractFilePurpose(fullPath)) || "Project config";
      lines.push(`  ${pf} — ${purpose}`);
    } catch {
      // not found
    }
  }

  // Group remaining by directory
  const byDir = new Map<string, Array<[string, number]>>();
  for (const [rel, entry] of scan.files) {
    if (config.priorityFiles.includes(rel)) continue;
    const existing = byDir.get(entry.dir) || [];
    existing.push([rel, entry.size]);
    byDir.set(entry.dir, existing);
  }

  let count = 0;
  const maxEntries = config.maxFileMapEntries;

  for (const dir of [...byDir.keys()].sort()) {
    const files = byDir.get(dir)!;
    files.sort(([, a], [, b]) => b - a); // largest first

    for (const [rel] of files.slice(0, 5)) {
      if (count >= maxEntries) break;
      const purpose = await extractFilePurpose(path.join(repoRoot, rel));
      if (purpose) {
        lines.push(`  ${rel} — ${purpose}`);
        count++;
      }
    }
    if (count >= maxEntries) break;
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Compile all sections into a single context.md, respecting token budget
 */
export async function compileContext(
  repoRoot: string,
  config: DevContextConfig,
  scan: ScanResult,
  stack: StackInfo,
  commits: CommitEntry[],
  branch: string,
  remote: string
): Promise<string> {
  const overview = generateOverview(repoRoot, scan, stack, branch, remote);
  const hotZones = generateHotZones(commits);
  const changes = generateRecentChanges(commits);
  const fileMap = await generateFileMap(repoRoot, scan, config);

  let sections = [overview, hotZones, changes, fileMap].filter(Boolean);
  let full = sections.join("\n");
  let tokens = countTokens(full);

  // Trim file map if over budget
  if (tokens > config.tokenBudget) {
    const fileMapLines = fileMap.split("\n");
    while (tokens > config.tokenBudget && fileMapLines.length > 3) {
      fileMapLines.splice(-2, 1);
      const trimmedMap = fileMapLines.join("\n");
      full = [overview, hotZones, changes, trimmedMap].filter(Boolean).join("\n");
      tokens = countTokens(full);
    }
  }

  const ts = new Date().toISOString().replace("T", " ").slice(0, 16);
  const header = `<!-- devcontext | ${ts} | ${tokens} tokens -->\n`;
  return header + full;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function ctxDir(root: string): string {
  return path.join(root, CONTEXT_DIR);
}

function tmDir(root: string): string {
  return path.join(ctxDir(root), TIMEMACHINE_DIR);
}

export async function ensureContextDir(root: string): Promise<void> {
  await fs.mkdir(ctxDir(root), { recursive: true });
  await fs.mkdir(tmDir(root), { recursive: true });
}

export async function saveJson(root: string, filename: string, data: any): Promise<void> {
  await ensureContextDir(root);
  await fs.writeFile(
    path.join(ctxDir(root), filename),
    JSON.stringify(data, null, 2)
  );
}

export async function loadJson<T>(root: string, filename: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(ctxDir(root), filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveContext(root: string, content: string): Promise<string> {
  await ensureContextDir(root);
  const outputPath = path.join(ctxDir(root), CONTEXT_FILE);
  await fs.writeFile(outputPath, content);
  return outputPath;
}

export async function readContext(root: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(ctxDir(root), CONTEXT_FILE), "utf-8");
  } catch {
    return null;
  }
}

// ─── Time Machine ────────────────────────────────────────────────────────────

/**
 * Save a snapshot to the time machine
 */
export async function saveSnapshot(
  root: string,
  content: string,
  commitHash: string,
  commitMessage: string
): Promise<void> {
  await ensureContextDir(root);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ctx_${ts}_${commitHash}.md`;
  await fs.writeFile(path.join(tmDir(root), filename), content);

  // Prune old snapshots (keep last 50)
  const entries = await listSnapshots(root);
  if (entries.length > 50) {
    const toDelete = entries.slice(50);
    for (const entry of toDelete) {
      try {
        await fs.unlink(path.join(tmDir(root), entry.filename));
      } catch {
        // skip
      }
    }
  }
}

/**
 * List all time machine snapshots, newest first
 */
export async function listSnapshots(root: string): Promise<TimeMachineEntry[]> {
  try {
    const dir = tmDir(root);
    const files = await fs.readdir(dir);
    const entries: TimeMachineEntry[] = [];

    for (const filename of files.filter((f) => f.endsWith(".md"))) {
      // Parse filename: ctx_2026-04-15T14-30-00_a3f2b1c4.md
      const match = filename.match(/^ctx_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})_(\w+)\.md$/);
      if (!match) continue;

      const content = await fs.readFile(path.join(dir, filename), "utf-8");
      const tokens = countTokens(content);

      entries.push({
        filename,
        timestamp: match[1].replace(/-/g, (m, i) => (i > 9 ? ":" : m)).replace("T", " "),
        commitHash: match[2],
        commitMessage: "", // could parse from content header
        tokenCount: tokens,
      });
    }

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

/**
 * Read a specific snapshot by filename
 */
export async function readSnapshot(root: string, filename: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(tmDir(root), filename), "utf-8");
  } catch {
    return null;
  }
}

/**
 * Restore a snapshot as the current context
 */
export async function restoreSnapshot(root: string, filename: string): Promise<boolean> {
  const content = await readSnapshot(root, filename);
  if (!content) return false;
  await saveContext(root, content);
  return true;
}

// ─── Gitignore ───────────────────────────────────────────────────────────────

export async function updateGitignore(root: string): Promise<void> {
  const gitignorePath = path.join(root, ".gitignore");
  try {
    const content = await fs.readFile(gitignorePath, "utf-8");
    if (!content.includes(CONTEXT_DIR)) {
      await fs.appendFile(gitignorePath, `\n# devcontext\n${CONTEXT_DIR}/\n`);
    }
  } catch {
    await fs.writeFile(gitignorePath, `# devcontext\n${CONTEXT_DIR}/\n`);
  }
}

/**
 * Create .contextignore if it doesn't exist
 */
export async function createContextIgnore(root: string): Promise<boolean> {
  const ignorePath = path.join(root, ".contextignore");
  try {
    await fs.access(ignorePath);
    return false; // already exists
  } catch {
    const defaultContent = [
      "# devcontext ignore patterns",
      "# Files listed here won't be included in context generation.",
      "# Uses glob syntax, same as .gitignore.",
      "",
      "# Build outputs",
      "build/",
      "dist/",
      ".next/",
      "target/",
      "",
      "# Dependencies",
      "node_modules/",
      "__pycache__/",
      "",
      "# Generated code",
      "*.g.dart",
      "*.freezed.dart",
      "*.min.js",
      "",
      "# Media",
      "*.png",
      "*.jpg",
      "*.svg",
      "*.mp4",
      "",
      "# Lock files",
      "package-lock.json",
      "yarn.lock",
      "pubspec.lock",
    ].join("\n");
    await fs.writeFile(ignorePath, defaultContent);
    return true;
  }
}
