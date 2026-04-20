export interface DevContextConfig {
  tokenBudget: number;
  maxCommits: number;
  syncDepth: "recent" | "inception";
  syncCommitCount: number;
  recentDays: number;
  maxFileMapEntries: number;
  ignorePatterns: string[];
  priorityFiles: string[];
  autoSync: {
    onCommit: boolean;
    onPull: boolean;
    onPush: boolean;
    onCheckout: boolean;
    onProjectOpen: boolean;
  };
  ide: {
    autoInjectContext: boolean;
    askBeforeInject: boolean;
  };
}

export interface FileEntry {
  path: string;
  ext: string;
  lang: string | null;
  size: number;
  dir: string;
  purpose: string | null;
}

export interface CommitEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

export interface StackInfo {
  languages: Array<[string, number]>;
  frameworks: string[];
  tools: string[];
  packageManager: string | null;
}

export interface ScanResult {
  files: Map<string, FileEntry>;
  langStats: Record<string, number>;
  dirStats: Record<string, number>;
  totalFiles: number;
}

export interface ContextSnapshot {
  id: string;
  timestamp: string;
  commitHash: string;
  commitMessage: string;
  tokenCount: number;
  content: string;
}

export interface TimeMachineEntry {
  filename: string;
  timestamp: string;
  commitHash: string;
  commitMessage: string;
  tokenCount: number;
}

export interface ContextStatus {
  repo: string;
  branch: string;
  contextFile: string;
  tokens: number;
  budget: number;
  lastUpdated: string;
  totalFiles: number;
  topLanguages: Array<[string, number]>;
  snapshotCount: number;
  pendingCommits: number;
}

export const DEFAULT_CONFIG: DevContextConfig = {
  tokenBudget: 4000,
  maxCommits: 30,
  syncDepth: "recent",
  syncCommitCount: 500,
  recentDays: 14,
  maxFileMapEntries: 150,
  ignorePatterns: [
    "*.lock", "*.sum", "*.min.js", "*.min.css",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "pubspec.lock",
    "*.g.dart", "*.freezed.dart", "*.gen.dart",
    "*.pb.dart", "*.pbjson.dart",
    "build/", "dist/", ".dart_tool/", "node_modules/",
    ".gradle/", "__pycache__/", ".next/", "target/",
    ".context/", ".git/", ".svn/", ".hg/",
    "*.pyc", "*.class", "*.o", "*.so", "*.dylib",
    "*.png", "*.jpg", "*.jpeg", "*.gif", "*.ico", "*.svg", "*.webp",
    "*.woff", "*.woff2", "*.ttf", "*.eot",
    "*.mp3", "*.mp4", "*.wav", "*.avi", "*.mov",
    "*.zip", "*.tar", "*.gz", "*.rar",
    "*.db", "*.sqlite", "*.sqlite3",
    "coverage/", ".nyc_output/", ".cache/",
  ],
  priorityFiles: [
    "README.md", "README.rst", "README.txt",
    "pubspec.yaml", "package.json", "Cargo.toml",
    "pyproject.toml", "setup.py", "setup.cfg", "go.mod",
    "Makefile", "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "Gemfile", "build.gradle", "build.gradle.kts", "pom.xml",
    ".env.example", "tsconfig.json", "vite.config.ts",
  ],
  autoSync: {
    onCommit: true,
    onPull: true,
    onPush: false,
    onCheckout: true,
    onProjectOpen: true,
  },
  ide: {
    autoInjectContext: false,
    askBeforeInject: true,
  },
};

export const LANG_MAP: Record<string, string> = {
  ".py": "Python", ".dart": "Dart/Flutter", ".js": "JavaScript",
  ".ts": "TypeScript", ".jsx": "React", ".tsx": "React/TS",
  ".rs": "Rust", ".go": "Go", ".java": "Java", ".kt": "Kotlin",
  ".swift": "Swift", ".rb": "Ruby", ".php": "PHP", ".c": "C",
  ".cpp": "C++", ".cs": "C#", ".scala": "Scala", ".mq5": "MQL5",
  ".vue": "Vue", ".svelte": "Svelte", ".html": "HTML", ".css": "CSS",
  ".scss": "SCSS", ".sass": "SASS", ".less": "LESS",
  ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML", ".json": "JSON",
  ".sql": "SQL", ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
  ".dockerfile": "Docker", ".tf": "Terraform", ".proto": "Protobuf",
  ".graphql": "GraphQL", ".gql": "GraphQL",
  ".md": "Markdown", ".mdx": "MDX",
  ".lua": "Lua", ".r": "R", ".jl": "Julia",
  ".ex": "Elixir", ".exs": "Elixir", ".erl": "Erlang",
  ".zig": "Zig", ".nim": "Nim", ".v": "V",
};

export const CONTEXT_DIR = ".context";
export const CONTEXT_FILE = "context.md";
export const SYSTEM_FILE = "system.json";
export const CONFIG_FILE = "config.json";
export const CHANGES_FILE = "changes.json";
export const TIMEMACHINE_DIR = "timemachine";
