// src/index.ts
import chalk2 from "chalk";

// src/types.ts
var DEFAULT_CONFIG = {
  tokenBudget: 4e3,
  maxCommits: 30,
  syncDepth: "recent",
  syncCommitCount: 500,
  recentDays: 14,
  maxFileMapEntries: 150,
  ignorePatterns: [
    "*.lock",
    "*.sum",
    "*.min.js",
    "*.min.css",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "pubspec.lock",
    "*.g.dart",
    "*.freezed.dart",
    "*.gen.dart",
    "*.pb.dart",
    "*.pbjson.dart",
    "build/",
    "dist/",
    ".dart_tool/",
    "node_modules/",
    ".gradle/",
    "__pycache__/",
    ".next/",
    "target/",
    ".context/",
    ".git/",
    ".svn/",
    ".hg/",
    "*.pyc",
    "*.class",
    "*.o",
    "*.so",
    "*.dylib",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.ico",
    "*.svg",
    "*.webp",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.eot",
    "*.mp3",
    "*.mp4",
    "*.wav",
    "*.avi",
    "*.mov",
    "*.zip",
    "*.tar",
    "*.gz",
    "*.rar",
    "*.db",
    "*.sqlite",
    "*.sqlite3",
    "coverage/",
    ".nyc_output/",
    ".cache/"
  ],
  priorityFiles: [
    "README.md",
    "README.rst",
    "README.txt",
    "pubspec.yaml",
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "go.mod",
    "Makefile",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Gemfile",
    "build.gradle",
    "build.gradle.kts",
    "pom.xml",
    ".env.example",
    "tsconfig.json",
    "vite.config.ts"
  ],
  autoSync: {
    onCommit: true,
    onPull: true,
    onPush: false,
    onCheckout: true,
    onProjectOpen: true
  },
  ide: {
    autoInjectContext: false,
    askBeforeInject: true
  }
};
var LANG_MAP = {
  ".py": "Python",
  ".dart": "Dart/Flutter",
  ".js": "JavaScript",
  ".ts": "TypeScript",
  ".jsx": "React",
  ".tsx": "React/TS",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".rb": "Ruby",
  ".php": "PHP",
  ".c": "C",
  ".cpp": "C++",
  ".cs": "C#",
  ".scala": "Scala",
  ".mq5": "MQL5",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "SASS",
  ".less": "LESS",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".json": "JSON",
  ".sql": "SQL",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".dockerfile": "Docker",
  ".tf": "Terraform",
  ".proto": "Protobuf",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
  ".md": "Markdown",
  ".mdx": "MDX",
  ".lua": "Lua",
  ".r": "R",
  ".jl": "Julia",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",
  ".zig": "Zig",
  ".nim": "Nim",
  ".v": "V"
};
var CONTEXT_DIR = ".context";
var CONTEXT_FILE = "context.md";
var SYSTEM_FILE = "system.json";
var CONFIG_FILE = "config.json";
var CHANGES_FILE = "changes.json";
var TIMEMACHINE_DIR = "timemachine";

// src/core/git.ts
import { simpleGit } from "simple-git";
var git;
function initGit(cwd) {
  git = simpleGit(cwd);
  return git;
}
function getGit() {
  if (!git) throw new Error("Git not initialized. Call initGit() first.");
  return git;
}
async function findRepoRoot() {
  const g = getGit();
  const root = await g.revparse(["--show-toplevel"]);
  return root.trim();
}
async function getCurrentBranch() {
  const g = getGit();
  const branch = await g.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
}
async function getRemoteUrl() {
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
async function getCommitLog(maxCount = 30) {
  const g = getGit();
  try {
    const log = await g.log({
      maxCount,
      "--stat": null
    });
    return log.all.map((entry) => ({
      hash: entry.hash.slice(0, 8),
      author: entry.author_name,
      date: entry.date.slice(0, 10),
      message: entry.message,
      filesChanged: entry.diff?.files?.map((f) => f.file) || [],
      insertions: entry.diff?.insertions || 0,
      deletions: entry.diff?.deletions || 0
    }));
  } catch {
    return [];
  }
}
async function getLatestCommitHash() {
  const g = getGit();
  try {
    const hash = await g.revparse(["HEAD"]);
    return hash.trim().slice(0, 8);
  } catch {
    return "unknown";
  }
}
async function installHooks(repoRoot, hooks) {
  const fs3 = await import("fs/promises");
  const path3 = await import("path");
  const hooksDir = path3.join(repoRoot, ".git", "hooks");
  const installed = [];
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
    const hookPath = path3.join(hooksDir, hookName);
    try {
      const existing = await fs3.readFile(hookPath, "utf-8").catch(() => "");
      if (existing.includes("dev-context") || existing.includes("devcontext")) continue;
      if (existing) {
        await fs3.appendFile(hookPath, "\n" + hookScript);
      } else {
        await fs3.writeFile(hookPath, hookScript);
      }
      await fs3.chmod(hookPath, 493);
      installed.push(hookName);
    } catch {
    }
  }
  return installed;
}

// src/core/scanner.ts
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
async function loadContextIgnore(root) {
  try {
    const content = await fs.readFile(path.join(root, ".contextignore"), "utf-8");
    return content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}
async function scanRepo(root, ignorePatterns) {
  const files = /* @__PURE__ */ new Map();
  const langStats = {};
  const dirStats = {};
  const contextIgnore = await loadContextIgnore(root);
  const ignore = [
    "**/node_modules/**",
    "**/.git/**",
    "**/build/**",
    "**/dist/**",
    "**/.dart_tool/**",
    "**/__pycache__/**",
    "**/.next/**",
    "**/target/**",
    "**/.gradle/**",
    "**/coverage/**",
    "**/.context/**",
    "**/venv/**",
    "**/.venv/**",
    ...ignorePatterns.map((p) => p.endsWith("/") ? `**/${p}**` : `**/${p}`),
    ...contextIgnore.map((p) => p.endsWith("/") ? `**/${p}**` : `**/${p}`)
  ];
  const matches = await glob("**/*", {
    cwd: root,
    nodir: true,
    dot: false,
    ignore
  });
  for (const relPath of matches) {
    const ext = path.extname(relPath).toLowerCase();
    const lang = LANG_MAP[ext] || null;
    const dir = path.dirname(relPath);
    const topDir = relPath.includes(path.sep) ? relPath.split(path.sep)[0] : ".";
    if (lang) {
      langStats[lang] = (langStats[lang] || 0) + 1;
    }
    dirStats[topDir] = (dirStats[topDir] || 0) + 1;
    let size = 0;
    try {
      const stat = await fs.stat(path.join(root, relPath));
      size = stat.size;
    } catch {
    }
    files.set(relPath, {
      path: relPath,
      ext,
      lang,
      size,
      dir,
      purpose: null
      // populated lazily
    });
  }
  return {
    files,
    langStats,
    dirStats: Object.fromEntries(
      Object.entries(dirStats).sort(([, a], [, b]) => b - a).slice(0, 20)
    ),
    totalFiles: files.size
  };
}
async function detectStack(root) {
  const stack = {
    languages: [],
    frameworks: [],
    tools: [],
    packageManager: null
  };
  const checks = [
    ["pubspec.yaml", "Flutter/Dart", "pub"],
    ["package.json", "Node.js", "npm"],
    ["Cargo.toml", "Rust", "cargo"],
    ["go.mod", "Go", "go mod"],
    ["pyproject.toml", "Python", "pip/poetry"],
    ["setup.py", "Python", "pip"],
    ["requirements.txt", "Python", "pip"],
    ["Gemfile", "Ruby", "bundler"],
    ["build.gradle", "Gradle/Android", "gradle"],
    ["build.gradle.kts", "Gradle/Kotlin", "gradle"],
    ["pom.xml", "Java/Maven", "maven"],
    ["Makefile", "Make", null],
    ["Dockerfile", "Docker", null],
    ["docker-compose.yml", "Docker Compose", null],
    ["docker-compose.yaml", "Docker Compose", null]
  ];
  for (const [file, framework, pm] of checks) {
    try {
      await fs.access(path.join(root, file));
      stack.frameworks.push(framework);
      if (pm && !stack.packageManager) stack.packageManager = pm;
    } catch {
    }
  }
  try {
    const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.react) stack.frameworks.push("React");
    if (deps.next) stack.frameworks.push("Next.js");
    if (deps.vue) stack.frameworks.push("Vue");
    if (deps.svelte) stack.frameworks.push("Svelte");
    if (deps.express) stack.frameworks.push("Express");
    if (deps.fastify) stack.frameworks.push("Fastify");
    if (deps.nestjs || deps["@nestjs/core"]) stack.frameworks.push("NestJS");
    if (deps.tailwindcss || deps["@tailwindcss/postcss"]) stack.tools.push("Tailwind CSS");
    if (deps.typescript) stack.tools.push("TypeScript");
    if (deps.prisma || deps["@prisma/client"]) stack.tools.push("Prisma");
    if (deps.drizzle || deps["drizzle-orm"]) stack.tools.push("Drizzle");
    try {
      await fs.access(path.join(root, "pnpm-lock.yaml"));
      stack.packageManager = "pnpm";
    } catch {
      try {
        await fs.access(path.join(root, "yarn.lock"));
        stack.packageManager = "yarn";
      } catch {
      }
    }
  } catch {
  }
  try {
    const content = await fs.readFile(path.join(root, "pubspec.yaml"), "utf-8");
    if (content.includes("flutter:")) stack.frameworks.push("Flutter");
    if (/\bget:/.test(content) || content.includes("get_it:")) stack.tools.push("GetX/GetIt");
    if (content.includes("riverpod")) stack.tools.push("Riverpod");
    if (content.includes("bloc")) stack.tools.push("BLoC");
    if (content.includes("firebase")) stack.tools.push("Firebase");
  } catch {
  }
  stack.frameworks = [...new Set(stack.frameworks)];
  stack.tools = [...new Set(stack.tools)];
  return stack;
}
async function extractFilePurpose(filePath) {
  try {
    const fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(1024);
    await fd.read(buf, 0, 1024, 0);
    await fd.close();
    const head = buf.toString("utf-8").split("\n").slice(0, 8);
    for (const line of head) {
      const trimmed = line.trim();
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        const content = trimmed.replace(/^['"]+|['"]+$/g, "").trim();
        if (content.length > 10) return content.slice(0, 120);
      }
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("///")) {
        const content = trimmed.replace(/^[/#!]+\s*/, "").trim();
        if (content.length > 10 && !content.startsWith("!") && !content.toLowerCase().includes("copyright") && !content.toLowerCase().includes("generated") && !content.startsWith("eslint") && !content.startsWith("@ts")) {
          return content.slice(0, 120);
        }
      }
    }
  } catch {
  }
  return null;
}

// src/core/compiler.ts
import fs2 from "fs/promises";
import path2 from "path";

// src/utils/tokens.ts
var encoder = null;
var useHeuristic = false;
async function initEncoder() {
  try {
    const { get_encoding } = await import("tiktoken");
    encoder = get_encoding("cl100k_base");
  } catch {
    useHeuristic = true;
  }
}
function countTokens(text) {
  if (encoder && !useHeuristic) {
    try {
      return encoder.encode(text).length;
    } catch {
    }
  }
  return Math.ceil(text.length / 3.5);
}
function freeEncoder() {
  if (encoder?.free) {
    encoder.free();
    encoder = null;
  }
}

// src/core/compiler.ts
function generateOverview(repoRoot, scan, stack, branch, remote) {
  const name = path2.basename(repoRoot);
  const lines = [];
  lines.push(`# ${name}`);
  if (remote) lines.push(`Repo: ${remote} | Branch: ${branch}`);
  lines.push("");
  const sortedLangs = Object.entries(scan.langStats).sort(([, a], [, b]) => b - a).slice(0, 5);
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
  lines.push("## Structure");
  const dirs = Object.entries(scan.dirStats).slice(0, 15);
  for (const [dir, count] of dirs) {
    lines.push(`  ${dir}/ (${count} files)`);
  }
  lines.push("");
  return lines.join("\n");
}
function generateHotZones(commits) {
  const freq = {};
  for (const c of commits) {
    for (const f of c.filesChanged) {
      freq[f] = (freq[f] || 0) + 1;
    }
  }
  const hot = Object.entries(freq).sort(([, a], [, b]) => b - a).slice(0, 10).filter(([, count]) => count >= 2);
  if (!hot.length) return "";
  const lines = ["## Hot zones (frequently changed)"];
  for (const [file, count] of hot) {
    lines.push(`  ${file} (${count} commits)`);
  }
  lines.push("");
  return lines.join("\n");
}
function generateRecentChanges(commits) {
  const lines = ["## Recent changes"];
  if (!commits.length) {
    lines.push("  No commits found.");
    return lines.join("\n");
  }
  const byDate = /* @__PURE__ */ new Map();
  for (const c of commits) {
    const existing = byDate.get(c.date) || [];
    existing.push(c);
    byDate.set(c.date, existing);
  }
  const dates = [...byDate.keys()].sort().reverse().slice(0, 10);
  for (const date of dates) {
    lines.push(`  [${date}]`);
    for (const c of byDate.get(date)) {
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
async function generateFileMap(repoRoot, scan, config) {
  const lines = ["## Key files"];
  for (const pf of config.priorityFiles) {
    const fullPath = path2.join(repoRoot, pf);
    try {
      await fs2.access(fullPath);
      const purpose = await extractFilePurpose(fullPath) || "Project config";
      lines.push(`  ${pf} \u2014 ${purpose}`);
    } catch {
    }
  }
  const byDir = /* @__PURE__ */ new Map();
  for (const [rel, entry] of scan.files) {
    if (config.priorityFiles.includes(rel)) continue;
    const existing = byDir.get(entry.dir) || [];
    existing.push([rel, entry.size]);
    byDir.set(entry.dir, existing);
  }
  let count = 0;
  const maxEntries = config.maxFileMapEntries;
  for (const dir of [...byDir.keys()].sort()) {
    const files = byDir.get(dir);
    files.sort(([, a], [, b]) => b - a);
    for (const [rel] of files.slice(0, 5)) {
      if (count >= maxEntries) break;
      const purpose = await extractFilePurpose(path2.join(repoRoot, rel));
      if (purpose) {
        lines.push(`  ${rel} \u2014 ${purpose}`);
        count++;
      }
    }
    if (count >= maxEntries) break;
  }
  lines.push("");
  return lines.join("\n");
}
async function compileContext(repoRoot, config, scan, stack, commits, branch, remote) {
  const overview = generateOverview(repoRoot, scan, stack, branch, remote);
  const hotZones = generateHotZones(commits);
  const changes = generateRecentChanges(commits);
  const fileMap = await generateFileMap(repoRoot, scan, config);
  let sections = [overview, hotZones, changes, fileMap].filter(Boolean);
  let full = sections.join("\n");
  let tokens = countTokens(full);
  if (tokens > config.tokenBudget) {
    const fileMapLines = fileMap.split("\n");
    while (tokens > config.tokenBudget && fileMapLines.length > 3) {
      fileMapLines.splice(-2, 1);
      const trimmedMap = fileMapLines.join("\n");
      full = [overview, hotZones, changes, trimmedMap].filter(Boolean).join("\n");
      tokens = countTokens(full);
    }
  }
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 16);
  const header = `<!-- dev-context | ${ts} | ${tokens} tokens -->
`;
  return header + full;
}
function ctxDir(root) {
  return path2.join(root, CONTEXT_DIR);
}
function tmDir(root) {
  return path2.join(ctxDir(root), TIMEMACHINE_DIR);
}
async function ensureContextDir(root) {
  await fs2.mkdir(ctxDir(root), { recursive: true });
  await fs2.mkdir(tmDir(root), { recursive: true });
}
async function saveJson(root, filename, data) {
  await ensureContextDir(root);
  await fs2.writeFile(
    path2.join(ctxDir(root), filename),
    JSON.stringify(data, null, 2)
  );
}
async function loadJson(root, filename) {
  try {
    const raw = await fs2.readFile(path2.join(ctxDir(root), filename), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function saveContext(root, content) {
  await ensureContextDir(root);
  const outputPath = path2.join(ctxDir(root), CONTEXT_FILE);
  await fs2.writeFile(outputPath, content);
  return outputPath;
}
async function readContext(root) {
  try {
    return await fs2.readFile(path2.join(ctxDir(root), CONTEXT_FILE), "utf-8");
  } catch {
    return null;
  }
}
async function saveSnapshot(root, content, commitHash, commitMessage) {
  await ensureContextDir(root);
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ctx_${ts}_${commitHash}.md`;
  await fs2.writeFile(path2.join(tmDir(root), filename), content);
  const entries = await listSnapshots(root);
  if (entries.length > 50) {
    const toDelete = entries.slice(50);
    for (const entry of toDelete) {
      try {
        await fs2.unlink(path2.join(tmDir(root), entry.filename));
      } catch {
      }
    }
  }
}
async function listSnapshots(root) {
  try {
    const dir = tmDir(root);
    const files = await fs2.readdir(dir);
    const entries = [];
    for (const filename of files.filter((f) => f.endsWith(".md"))) {
      const match = filename.match(/^ctx_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})_(\w+)\.md$/);
      if (!match) continue;
      const content = await fs2.readFile(path2.join(dir, filename), "utf-8");
      const tokens = countTokens(content);
      entries.push({
        filename,
        timestamp: match[1].replace(/-/g, (m, i) => i > 9 ? ":" : m).replace("T", " "),
        commitHash: match[2],
        commitMessage: "",
        // could parse from content header
        tokenCount: tokens
      });
    }
    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}
async function readSnapshot(root, filename) {
  try {
    return await fs2.readFile(path2.join(tmDir(root), filename), "utf-8");
  } catch {
    return null;
  }
}
async function restoreSnapshot(root, filename) {
  const content = await readSnapshot(root, filename);
  if (!content) return false;
  await saveContext(root, content);
  return true;
}
async function updateGitignore(root) {
  const gitignorePath = path2.join(root, ".gitignore");
  try {
    const content = await fs2.readFile(gitignorePath, "utf-8");
    if (!content.includes(CONTEXT_DIR)) {
      await fs2.appendFile(gitignorePath, `
# dev-context
${CONTEXT_DIR}/
`);
    }
  } catch {
    await fs2.writeFile(gitignorePath, `# dev-context
${CONTEXT_DIR}/
`);
  }
}
async function createContextIgnore(root) {
  const ignorePath = path2.join(root, ".contextignore");
  try {
    await fs2.access(ignorePath);
    return false;
  } catch {
    const defaultContent = [
      "# dev-context ignore patterns",
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
      "pubspec.lock"
    ].join("\n");
    await fs2.writeFile(ignorePath, defaultContent);
    return true;
  }
}

// src/utils/ui.ts
import chalk from "chalk";
import ora from "ora";
import gradientString from "gradient-string";
var BRAND = {
  primary: "#6C5CE7",
  secondary: "#A29BFE",
  accent: "#00CEC9",
  warm: "#FD79A8",
  success: "#00B894",
  warning: "#FDCB6E",
  error: "#D63031",
  muted: "#636E72"
};
var ctxGradient = gradientString([BRAND.primary, BRAND.accent]);
var warmGradient = gradientString([BRAND.warm, BRAND.secondary]);
var BANNER = `
     \u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557
     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557 \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u255A\u2588\u2588\u2557\u2588\u2588\u2554\u255D
     \u2588\u2588\u2551  \u2588\u2588\u2551 \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551        \u2588\u2588\u2551    \u255A\u2588\u2588\u2588\u2554\u255D 
     \u2588\u2588\u2551  \u2588\u2588\u2551 \u2588\u2588\u2554\u2550\u2550\u255D  \u255A\u2588\u2588\u2557 \u2588\u2588\u2554\u255D\u2588\u2588\u2551        \u2588\u2588\u2551    \u2588\u2588\u2554\u2588\u2588\u2557 
     \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u255A\u2588\u2588\u2588\u2588\u2554\u255D \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2554\u255D \u2588\u2588\u2557
     \u255A\u2550\u2550\u2550\u2550\u2550\u255D  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D  \u255A\u2550\u2550\u2550\u255D   \u255A\u2550\u2550\u2550\u2550\u2550\u255D   \u255A\u2550\u255D   \u255A\u2550\u255D  \u255A\u2550\u255D
`;
function showBanner() {
  console.log(ctxGradient(BANNER));
  console.log(
    chalk.dim("     git-aware AI context \xB7 v0.1.0\n")
  );
}
function showMiniBanner() {
  console.log(
    ctxGradient("  \u25B2 dev-context") + chalk.dim(" \xB7 context is everything\n")
  );
}
function createSpinner(text) {
  return ora({
    text: chalk.dim(text),
    spinner: "dots12",
    color: "cyan"
  });
}
function heading(text) {
  console.log(`
${chalk.hex(BRAND.primary).bold("  \u25C6")} ${chalk.bold(text)}`);
}
function info(label, value) {
  console.log(
    `  ${chalk.hex(BRAND.accent)("\u2502")} ${chalk.dim(label.padEnd(18))} ${value}`
  );
}
function success(text) {
  console.log(`
  ${chalk.hex(BRAND.success)("\u2713")} ${chalk.green(text)}`);
}
function warn(text) {
  console.log(`  ${chalk.hex(BRAND.warning)("\u26A0")} ${chalk.yellow(text)}`);
}
function error(text) {
  console.log(`  ${chalk.hex(BRAND.error)("\u2717")} ${chalk.red(text)}`);
}
function hint(text) {
  console.log(`  ${chalk.dim(text)}`);
}
function tokenBadge(tokens, budget) {
  const pct = Math.round(tokens / budget * 100);
  const bar = "\u2588".repeat(Math.round(pct / 5)) + "\u2591".repeat(20 - Math.round(pct / 5));
  const color = pct < 70 ? chalk.hex(BRAND.success) : pct < 90 ? chalk.hex(BRAND.warning) : chalk.hex(BRAND.error);
  return `${color(bar)} ${tokens}/${budget} tokens (${pct}%)`;
}
function table(rows) {
  const maxLabel = Math.max(...rows.map(([l]) => l.length));
  for (const [label, value] of rows) {
    console.log(
      `  ${chalk.hex(BRAND.accent)("\u2502")} ${chalk.dim(label.padEnd(maxLabel + 2))} ${value}`
    );
  }
}

// src/index.ts
async function cmdInit(options) {
  if (!options.silent) showBanner();
  const spinner = createSpinner("Initializing dev-context...");
  spinner.start();
  try {
    initGit();
    await initEncoder();
    const root = await findRepoRoot();
    const branch = await getCurrentBranch();
    const remote = await getRemoteUrl();
    const config = {
      ...DEFAULT_CONFIG,
      ...options.budget ? { tokenBudget: options.budget } : {},
      ...options.depth ? { syncDepth: options.depth } : {},
      ...options.commits ? { syncCommitCount: options.commits } : {}
    };
    const maxCommits = config.syncDepth === "inception" ? config.syncCommitCount : config.maxCommits;
    spinner.text = chalk2.dim("Scanning repository...");
    const scan = await scanRepo(root, config.ignorePatterns);
    spinner.text = chalk2.dim("Detecting tech stack...");
    const stack = await detectStack(root);
    spinner.text = chalk2.dim(`Parsing git history (${maxCommits} commits)...`);
    const commits = await getCommitLog(maxCommits);
    spinner.text = chalk2.dim("Compiling context...");
    const context = await compileContext(root, config, scan, stack, commits, branch, remote);
    const tokens = countTokens(context);
    spinner.text = chalk2.dim("Saving...");
    await ensureContextDir(root);
    await saveJson(root, CONFIG_FILE, config);
    await saveJson(root, SYSTEM_FILE, {
      stack,
      scanSummary: {
        totalFiles: scan.totalFiles,
        langStats: scan.langStats,
        dirStats: scan.dirStats
      }
    });
    await saveJson(root, CHANGES_FILE, {
      commits,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const outputPath = await saveContext(root, context);
    const latestHash = await getLatestCommitHash();
    await saveSnapshot(root, context, latestHash, commits[0]?.message || "init");
    await updateGitignore(root);
    await createContextIgnore(root);
    const hookNames = [];
    if (config.autoSync.onCommit) hookNames.push("post-commit");
    if (config.autoSync.onPull) hookNames.push("post-merge");
    if (config.autoSync.onCheckout) hookNames.push("post-checkout");
    if (hookNames.length) {
      spinner.text = chalk2.dim("Installing git hooks...");
      await installHooks(root, hookNames);
    }
    spinner.stop();
    if (!options.silent) {
      heading("dev-context initialized");
      console.log();
      table([
        ["Files scanned", String(scan.totalFiles)],
        ["Commits parsed", String(commits.length)],
        ["Tokens", tokenBadge(tokens, config.tokenBudget)],
        ["Output", outputPath],
        ["Hooks", hookNames.length ? hookNames.join(", ") : "none"]
      ]);
      console.log();
      hint("  Paste .context/context.md into any AI chat.");
      hint("  Run `dev-context show` to print context to stdout.");
      hint("  Run `dev-context update` after making changes.\n");
    }
    freeEncoder();
  } catch (err) {
    spinner.stop();
    error(err.message || "Failed to initialize");
    process.exit(1);
  }
}
async function cmdUpdate(options) {
  if (!options.silent) showMiniBanner();
  const spinner = createSpinner("Updating context...");
  if (!options.silent) spinner.start();
  try {
    initGit();
    await initEncoder();
    const root = await findRepoRoot();
    const config = await loadJson(root, CONFIG_FILE);
    if (!config) {
      spinner.stop();
      warn("Not initialized. Run `dev-context init` first.");
      return;
    }
    const branch = await getCurrentBranch();
    const remote = await getRemoteUrl();
    const scan = await scanRepo(root, config.ignorePatterns);
    const stack = await detectStack(root);
    const commits = await getCommitLog(config.maxCommits);
    const context = await compileContext(root, config, scan, stack, commits, branch, remote);
    const tokens = countTokens(context);
    await saveJson(root, CHANGES_FILE, {
      commits,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await saveJson(root, SYSTEM_FILE, {
      stack,
      scanSummary: {
        totalFiles: scan.totalFiles,
        langStats: scan.langStats,
        dirStats: scan.dirStats
      }
    });
    await saveContext(root, context);
    const latestHash = await getLatestCommitHash();
    await saveSnapshot(root, context, latestHash, commits[0]?.message || "update");
    if (!options.silent) {
      spinner.stop();
      success(
        `Context updated \xB7 ${scan.totalFiles} files \xB7 ${commits.length} commits \xB7 ${tokens}/${config.tokenBudget} tokens`
      );
      console.log();
    }
    freeEncoder();
  } catch (err) {
    spinner.stop();
    error(err.message || "Failed to update");
  }
}
async function cmdStatus() {
  showMiniBanner();
  try {
    initGit();
    await initEncoder();
    const root = await findRepoRoot();
    const config = await loadJson(root, CONFIG_FILE);
    if (!config) {
      warn("Not initialized. Run `dev-context init` first.");
      return;
    }
    const content = await readContext(root);
    if (!content) {
      warn("No context.md found. Run `dev-context init`.");
      return;
    }
    const tokens = countTokens(content);
    const branch = await getCurrentBranch();
    const snapshots = await listSnapshots(root);
    const system = await loadJson(root, SYSTEM_FILE);
    heading("Status");
    console.log();
    table([
      ["Repository", root],
      ["Branch", branch],
      ["Tokens", tokenBadge(tokens, config.tokenBudget)],
      ["Snapshots", String(snapshots.length)],
      ["Total files", String(system?.scanSummary?.totalFiles || "?")]
    ]);
    if (system?.scanSummary?.langStats) {
      const langs = Object.entries(system.scanSummary.langStats).sort(([, a], [, b]) => b - a).slice(0, 4).map(([l, c]) => `${l} (${c})`).join(", ");
      info("Languages", langs);
    }
    console.log();
    freeEncoder();
  } catch (err) {
    error(err.message);
  }
}
async function cmdShow() {
  try {
    initGit();
    const root = await findRepoRoot();
    const content = await readContext(root);
    if (!content) {
      console.error(chalk2.yellow("No context.md. Run `dev-context init` first."));
      process.exit(1);
    }
    process.stdout.write(content);
  } catch (err) {
    console.error(chalk2.red(err.message));
    process.exit(1);
  }
}
async function cmdConfig(options) {
  showMiniBanner();
  try {
    initGit();
    const root = await findRepoRoot();
    const config = await loadJson(root, CONFIG_FILE);
    if (!config) {
      warn("Not initialized. Run `dev-context init` first.");
      return;
    }
    let changed = false;
    if (options.budget !== void 0) {
      config.tokenBudget = options.budget;
      changed = true;
    }
    if (options.maxCommits !== void 0) {
      config.maxCommits = options.maxCommits;
      changed = true;
    }
    if (options.recentDays !== void 0) {
      config.recentDays = options.recentDays;
      changed = true;
    }
    if (options.syncDepth !== void 0) {
      config.syncDepth = options.syncDepth;
      changed = true;
    }
    if (options.syncCommits !== void 0) {
      config.syncCommitCount = options.syncCommits;
      changed = true;
    }
    if (options.autoInject !== void 0) {
      config.ide.autoInjectContext = options.autoInject;
      changed = true;
    }
    if (options.askBefore !== void 0) {
      config.ide.askBeforeInject = options.askBefore;
      changed = true;
    }
    if (changed) {
      await saveJson(root, CONFIG_FILE, config);
      success("Configuration updated.");
      console.log();
    }
    heading("Configuration");
    console.log();
    table([
      ["Token budget", String(config.tokenBudget)],
      ["Max commits", String(config.maxCommits)],
      ["Sync depth", config.syncDepth],
      ["Sync commit count", String(config.syncCommitCount)],
      ["Recent days", String(config.recentDays)],
      ["Auto-inject (IDE)", String(config.ide.autoInjectContext)],
      ["Ask before inject", String(config.ide.askBeforeInject)],
      ["Auto-sync on commit", String(config.autoSync.onCommit)],
      ["Auto-sync on pull", String(config.autoSync.onPull)],
      ["Auto-sync on checkout", String(config.autoSync.onCheckout)],
      ["Ignore patterns", `${config.ignorePatterns.length} patterns`]
    ]);
    console.log();
  } catch (err) {
    error(err.message);
  }
}
async function cmdInstallHook() {
  showMiniBanner();
  try {
    initGit();
    const root = await findRepoRoot();
    const hooks = ["post-commit", "post-merge", "post-checkout"];
    const installed = await installHooks(root, hooks);
    if (installed.length) {
      success(`Hooks installed: ${installed.join(", ")}`);
      hint("  Context will auto-update on commit, pull, and checkout.\n");
    } else {
      hint("  All hooks already installed.\n");
    }
  } catch (err) {
    error(err.message);
  }
}
async function cmdTimeMachine(action, args) {
  showMiniBanner();
  try {
    initGit();
    await initEncoder();
    const root = await findRepoRoot();
    const config = await loadJson(root, CONFIG_FILE);
    if (!config) {
      warn("Not initialized. Run `dev-context init` first.");
      return;
    }
    switch (action) {
      case "list": {
        const snapshots = await listSnapshots(root);
        if (!snapshots.length) {
          hint("  No snapshots yet. Run `dev-context update` to create one.\n");
          return;
        }
        heading(`Time machine \xB7 ${snapshots.length} snapshots`);
        console.log();
        for (const [i, snap] of snapshots.entries()) {
          const isCurrent = i === 0;
          const marker = isCurrent ? chalk2.green("\u25CF") : chalk2.dim("\u25CB");
          console.log(
            `  ${marker} ${chalk2.dim(`[${i}]`)} ${snap.timestamp} ${chalk2.dim(snap.commitHash)} \xB7 ${snap.tokenCount} tokens`
          );
        }
        console.log();
        hint("  Use `dev-context tm show <index>` to view a snapshot.");
        hint("  Use `dev-context tm restore <index>` to restore.\n");
        break;
      }
      case "show": {
        const idx = parseInt(args[0] || "0", 10);
        const snapshots = await listSnapshots(root);
        if (idx < 0 || idx >= snapshots.length) {
          error(`Invalid index. Have ${snapshots.length} snapshots (0-${snapshots.length - 1}).`);
          return;
        }
        const snap = snapshots[idx];
        const content = await readSnapshot(root, snap.filename);
        if (content) {
          console.log(content);
        }
        break;
      }
      case "restore": {
        const idx = parseInt(args[0] || "0", 10);
        const snapshots = await listSnapshots(root);
        if (idx < 0 || idx >= snapshots.length) {
          error(`Invalid index. Have ${snapshots.length} snapshots (0-${snapshots.length - 1}).`);
          return;
        }
        const snap = snapshots[idx];
        const ok = await restoreSnapshot(root, snap.filename);
        if (ok) {
          success(`Restored snapshot from ${snap.timestamp} (${snap.commitHash})`);
          hint("  context.md now reflects this snapshot.\n");
        } else {
          error("Failed to restore snapshot.");
        }
        break;
      }
      case "diff": {
        const idxA = parseInt(args[0] || "0", 10);
        const idxB = parseInt(args[1] || "1", 10);
        const snapshots = await listSnapshots(root);
        if (idxA >= snapshots.length || idxB >= snapshots.length) {
          error("Invalid snapshot indices.");
          return;
        }
        const contentA = await readSnapshot(root, snapshots[idxA].filename);
        const contentB = await readSnapshot(root, snapshots[idxB].filename);
        if (!contentA || !contentB) {
          error("Could not read snapshots.");
          return;
        }
        const linesA = contentA.split("\n");
        const linesB = contentB.split("\n");
        heading(`Diff: [${idxA}] ${snapshots[idxA].timestamp} vs [${idxB}] ${snapshots[idxB].timestamp}`);
        console.log();
        const added = linesA.filter((l) => !linesB.includes(l));
        const removed = linesB.filter((l) => !linesA.includes(l));
        if (added.length) {
          console.log(chalk2.green("  + Added:"));
          for (const l of added.slice(0, 20)) {
            console.log(chalk2.green(`    + ${l}`));
          }
        }
        if (removed.length) {
          console.log(chalk2.red("  - Removed:"));
          for (const l of removed.slice(0, 20)) {
            console.log(chalk2.red(`    - ${l}`));
          }
        }
        if (!added.length && !removed.length) {
          hint("  No differences found.\n");
        }
        console.log();
        break;
      }
      default:
        hint("  Usage: dev-context tm <list|show|restore|diff> [args]");
        hint("  Examples:");
        hint("    dev-context tm list");
        hint("    dev-context tm show 0");
        hint("    dev-context tm restore 3");
        hint("    dev-context tm diff 0 2\n");
    }
    freeEncoder();
  } catch (err) {
    error(err.message);
  }
}
export {
  cmdConfig,
  cmdInit,
  cmdInstallHook,
  cmdShow,
  cmdStatus,
  cmdTimeMachine,
  cmdUpdate
};
