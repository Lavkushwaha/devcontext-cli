import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { type ScanResult, type StackInfo, type FileEntry, LANG_MAP } from "../types.js";

/**
 * Parse .contextignore file if it exists
 */
async function loadContextIgnore(root: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(root, ".contextignore"), "utf-8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

/**
 * Scan the repo file tree and build metadata
 */
export async function scanRepo(
  root: string,
  ignorePatterns: string[]
): Promise<ScanResult> {
  const files = new Map<string, FileEntry>();
  const langStats: Record<string, number> = {};
  const dirStats: Record<string, number> = {};

  // Load .contextignore
  const contextIgnore = await loadContextIgnore(root);

  // Build glob ignore patterns
  const ignore = [
    "**/node_modules/**", "**/.git/**", "**/build/**", "**/dist/**",
    "**/.dart_tool/**", "**/__pycache__/**", "**/.next/**", "**/target/**",
    "**/.gradle/**", "**/coverage/**", "**/.context/**",
    "**/venv/**", "**/.venv/**",
    ...ignorePatterns.map((p) => (p.endsWith("/") ? `**/${p}**` : `**/${p}`)),
    ...contextIgnore.map((p) => (p.endsWith("/") ? `**/${p}**` : `**/${p}`)),
  ];

  const matches = await glob("**/*", {
    cwd: root,
    nodir: true,
    dot: false,
    ignore,
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
      // skip
    }

    files.set(relPath, {
      path: relPath,
      ext,
      lang,
      size,
      dir,
      purpose: null, // populated lazily
    });
  }

  return {
    files,
    langStats,
    dirStats: Object.fromEntries(
      Object.entries(dirStats).sort(([, a], [, b]) => b - a).slice(0, 20)
    ),
    totalFiles: files.size,
  };
}

/**
 * Detect tech stack from project config files
 */
export async function detectStack(root: string): Promise<StackInfo> {
  const stack: StackInfo = {
    languages: [],
    frameworks: [],
    tools: [],
    packageManager: null,
  };

  const checks: Array<[string, string, string | null]> = [
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
    ["docker-compose.yaml", "Docker Compose", null],
  ];

  for (const [file, framework, pm] of checks) {
    try {
      await fs.access(path.join(root, file));
      stack.frameworks.push(framework);
      if (pm && !stack.packageManager) stack.packageManager = pm;
    } catch {
      // not found
    }
  }

  // Deep detection from package.json
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

    // Detect pnpm/yarn
    try {
      await fs.access(path.join(root, "pnpm-lock.yaml"));
      stack.packageManager = "pnpm";
    } catch {
      try {
        await fs.access(path.join(root, "yarn.lock"));
        stack.packageManager = "yarn";
      } catch { /* npm default */ }
    }
  } catch {
    // no package.json
  }

  // Deep detection from pubspec.yaml
  try {
    const content = await fs.readFile(path.join(root, "pubspec.yaml"), "utf-8");
    if (content.includes("flutter:")) stack.frameworks.push("Flutter");
    if (/\bget:/.test(content) || content.includes("get_it:")) stack.tools.push("GetX/GetIt");
    if (content.includes("riverpod")) stack.tools.push("Riverpod");
    if (content.includes("bloc")) stack.tools.push("BLoC");
    if (content.includes("firebase")) stack.tools.push("Firebase");
  } catch {
    // no pubspec
  }

  // Deduplicate
  stack.frameworks = [...new Set(stack.frameworks)];
  stack.tools = [...new Set(stack.tools)];

  return stack;
}

/**
 * Extract a one-line purpose from a file's leading comments/docstrings
 */
export async function extractFilePurpose(filePath: string): Promise<string | null> {
  try {
    const fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(1024);
    await fd.read(buf, 0, 1024, 0);
    await fd.close();

    const head = buf.toString("utf-8").split("\n").slice(0, 8);

    for (const line of head) {
      const trimmed = line.trim();

      // Python/shell docstring
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        const content = trimmed.replace(/^['"]+|['"]+$/g, "").trim();
        if (content.length > 10) return content.slice(0, 120);
      }

      // Comment-based description
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("///")) {
        const content = trimmed.replace(/^[/#!]+\s*/, "").trim();
        if (
          content.length > 10 &&
          !content.startsWith("!") &&
          !content.toLowerCase().includes("copyright") &&
          !content.toLowerCase().includes("generated") &&
          !content.startsWith("eslint") &&
          !content.startsWith("@ts")
        ) {
          return content.slice(0, 120);
        }
      }
    }
  } catch {
    // can't read
  }
  return null;
}
