/**
 * devcontext — Git-aware AI context generator
 *
 * Public API for programmatic usage, IDE extensions, and integrations.
 */

export {
  type DevContextConfig,
  type ScanResult,
  type StackInfo,
  type CommitEntry,
  type ContextSnapshot,
  type TimeMachineEntry,
  type ContextStatus,
  type FileEntry,
  DEFAULT_CONFIG,
  CONTEXT_DIR,
  CONTEXT_FILE,
} from "./types.js";

export {
  initGit,
  findRepoRoot,
  getCurrentBranch,
  getRemoteUrl,
  getCommitLog,
  getLatestCommitHash,
  installHooks,
} from "./core/git.js";

export {
  scanRepo,
  detectStack,
  extractFilePurpose,
} from "./core/scanner.js";

export {
  compileContext,
  saveContext,
  readContext,
  saveJson,
  loadJson,
  ensureContextDir,
  updateGitignore,
  createContextIgnore,
  saveSnapshot,
  listSnapshots,
  readSnapshot,
  restoreSnapshot,
} from "./core/compiler.js";

export {
  initEncoder,
  countTokens,
  freeEncoder,
} from "./utils/tokens.js";
