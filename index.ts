import chalk from "chalk";
import {
  type DevContextConfig,
  DEFAULT_CONFIG,
  SYSTEM_FILE,
  CHANGES_FILE,
  CONFIG_FILE,
} from "../types.js";
import {
  initGit,
  findRepoRoot,
  getCurrentBranch,
  getRemoteUrl,
  getCommitLog,
  getLatestCommitHash,
  installHooks,
} from "../core/git.js";
import { scanRepo, detectStack } from "../core/scanner.js";
import {
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
} from "../core/compiler.js";
import { initEncoder, countTokens, freeEncoder } from "../utils/tokens.js";
import {
  showBanner,
  showMiniBanner,
  createSpinner,
  heading,
  info,
  success,
  warn,
  error,
  hint,
  tokenBadge,
  table,
  divider,
} from "../utils/ui.js";

// ─── Init ────────────────────────────────────────────────────────────────────

export async function cmdInit(options: {
  budget?: number;
  depth?: "recent" | "inception";
  commits?: number;
  silent?: boolean;
}): Promise<void> {
  if (!options.silent) showBanner();

  const spinner = createSpinner("Initializing devcontext...");
  spinner.start();

  try {
    initGit();
    await initEncoder();

    const root = await findRepoRoot();
    const branch = await getCurrentBranch();
    const remote = await getRemoteUrl();

    const config: DevContextConfig = {
      ...DEFAULT_CONFIG,
      ...(options.budget ? { tokenBudget: options.budget } : {}),
      ...(options.depth ? { syncDepth: options.depth } : {}),
      ...(options.commits ? { syncCommitCount: options.commits } : {}),
    };

    const maxCommits =
      config.syncDepth === "inception" ? config.syncCommitCount : config.maxCommits;

    // Step 1: Scan
    spinner.text = chalk.dim("Scanning repository...");
    const scan = await scanRepo(root, config.ignorePatterns);

    // Step 2: Detect stack
    spinner.text = chalk.dim("Detecting tech stack...");
    const stack = await detectStack(root);

    // Step 3: Parse git history
    spinner.text = chalk.dim(`Parsing git history (${maxCommits} commits)...`);
    const commits = await getCommitLog(maxCommits);

    // Step 4: Compile context
    spinner.text = chalk.dim("Compiling context...");
    const context = await compileContext(root, config, scan, stack, commits, branch, remote);
    const tokens = countTokens(context);

    // Step 5: Save everything
    spinner.text = chalk.dim("Saving...");
    await ensureContextDir(root);
    await saveJson(root, CONFIG_FILE, config);
    await saveJson(root, SYSTEM_FILE, {
      stack,
      scanSummary: {
        totalFiles: scan.totalFiles,
        langStats: scan.langStats,
        dirStats: scan.dirStats,
      },
    });
    await saveJson(root, CHANGES_FILE, {
      commits,
      generatedAt: new Date().toISOString(),
    });

    const outputPath = await saveContext(root, context);

    // Save initial snapshot
    const latestHash = await getLatestCommitHash();
    await saveSnapshot(root, context, latestHash, commits[0]?.message || "init");

    // Update .gitignore
    await updateGitignore(root);

    // Create .contextignore if not exists
    await createContextIgnore(root);

    // Install default hooks
    const hookNames = [];
    if (config.autoSync.onCommit) hookNames.push("post-commit");
    if (config.autoSync.onPull) hookNames.push("post-merge");
    if (config.autoSync.onCheckout) hookNames.push("post-checkout");
    if (hookNames.length) {
      spinner.text = chalk.dim("Installing git hooks...");
      await installHooks(root, hookNames);
    }

    spinner.stop();

    if (!options.silent) {
      heading("devcontext initialized");
      console.log();
      table([
        ["Files scanned", String(scan.totalFiles)],
        ["Commits parsed", String(commits.length)],
        ["Tokens", tokenBadge(tokens, config.tokenBudget)],
        ["Output", outputPath],
        ["Hooks", hookNames.length ? hookNames.join(", ") : "none"],
      ]);
      console.log();
      hint("  Paste .context/context.md into any AI chat.");
      hint("  Run `devcontext show` to print context to stdout.");
      hint("  Run `devcontext update` after making changes.\n");
    }

    freeEncoder();
  } catch (err: any) {
    spinner.stop();
    error(err.message || "Failed to initialize");
    process.exit(1);
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function cmdUpdate(options: { silent?: boolean }): Promise<void> {
  if (!options.silent) showMiniBanner();

  const spinner = createSpinner("Updating context...");
  if (!options.silent) spinner.start();

  try {
    initGit();
    await initEncoder();

    const root = await findRepoRoot();
    const config = await loadJson<DevContextConfig>(root, CONFIG_FILE);
    if (!config) {
      spinner.stop();
      warn("Not initialized. Run `devcontext init` first.");
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
      generatedAt: new Date().toISOString(),
    });
    await saveJson(root, SYSTEM_FILE, {
      stack,
      scanSummary: {
        totalFiles: scan.totalFiles,
        langStats: scan.langStats,
        dirStats: scan.dirStats,
      },
    });

    await saveContext(root, context);

    // Save time machine snapshot
    const latestHash = await getLatestCommitHash();
    await saveSnapshot(root, context, latestHash, commits[0]?.message || "update");

    if (!options.silent) {
      spinner.stop();
      success(
        `Context updated · ${scan.totalFiles} files · ${commits.length} commits · ${tokens}/${config.tokenBudget} tokens`
      );
      console.log();
    }

    freeEncoder();
  } catch (err: any) {
    spinner.stop();
    error(err.message || "Failed to update");
  }
}

// ─── Status ──────────────────────────────────────────────────────────────────

export async function cmdStatus(): Promise<void> {
  showMiniBanner();

  try {
    initGit();
    await initEncoder();

    const root = await findRepoRoot();
    const config = await loadJson<DevContextConfig>(root, CONFIG_FILE);
    if (!config) {
      warn("Not initialized. Run `devcontext init` first.");
      return;
    }

    const content = await readContext(root);
    if (!content) {
      warn("No context.md found. Run `devcontext init`.");
      return;
    }

    const tokens = countTokens(content);
    const branch = await getCurrentBranch();
    const snapshots = await listSnapshots(root);
    const system = await loadJson<any>(root, SYSTEM_FILE);

    heading("Status");
    console.log();
    table([
      ["Repository", root],
      ["Branch", branch],
      ["Tokens", tokenBadge(tokens, config.tokenBudget)],
      ["Snapshots", String(snapshots.length)],
      ["Total files", String(system?.scanSummary?.totalFiles || "?")],
    ]);

    if (system?.scanSummary?.langStats) {
      const langs = Object.entries(system.scanSummary.langStats as Record<string, number>)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([l, c]) => `${l} (${c})`)
        .join(", ");
      info("Languages", langs);
    }

    console.log();
    freeEncoder();
  } catch (err: any) {
    error(err.message);
  }
}

// ─── Show ────────────────────────────────────────────────────────────────────

export async function cmdShow(): Promise<void> {
  try {
    initGit();
    const root = await findRepoRoot();
    const content = await readContext(root);
    if (!content) {
      console.error(chalk.yellow("No context.md. Run `devcontext init` first."));
      process.exit(1);
    }
    // Raw stdout for piping
    process.stdout.write(content);
  } catch (err: any) {
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function cmdConfig(options: {
  budget?: number;
  maxCommits?: number;
  recentDays?: number;
  syncDepth?: "recent" | "inception";
  syncCommits?: number;
  autoInject?: boolean;
  askBefore?: boolean;
}): Promise<void> {
  showMiniBanner();

  try {
    initGit();
    const root = await findRepoRoot();
    const config = await loadJson<DevContextConfig>(root, CONFIG_FILE);
    if (!config) {
      warn("Not initialized. Run `devcontext init` first.");
      return;
    }

    let changed = false;
    if (options.budget !== undefined) { config.tokenBudget = options.budget; changed = true; }
    if (options.maxCommits !== undefined) { config.maxCommits = options.maxCommits; changed = true; }
    if (options.recentDays !== undefined) { config.recentDays = options.recentDays; changed = true; }
    if (options.syncDepth !== undefined) { config.syncDepth = options.syncDepth; changed = true; }
    if (options.syncCommits !== undefined) { config.syncCommitCount = options.syncCommits; changed = true; }
    if (options.autoInject !== undefined) { config.ide.autoInjectContext = options.autoInject; changed = true; }
    if (options.askBefore !== undefined) { config.ide.askBeforeInject = options.askBefore; changed = true; }

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
      ["Ignore patterns", `${config.ignorePatterns.length} patterns`],
    ]);
    console.log();
  } catch (err: any) {
    error(err.message);
  }
}

// ─── Install Hook ────────────────────────────────────────────────────────────

export async function cmdInstallHook(): Promise<void> {
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
  } catch (err: any) {
    error(err.message);
  }
}

// ─── Time Machine ────────────────────────────────────────────────────────────

export async function cmdTimeMachine(action: string, args: string[]): Promise<void> {
  showMiniBanner();

  try {
    initGit();
    await initEncoder();
    const root = await findRepoRoot();
    const config = await loadJson<DevContextConfig>(root, CONFIG_FILE);
    if (!config) {
      warn("Not initialized. Run `devcontext init` first.");
      return;
    }

    switch (action) {
      case "list": {
        const snapshots = await listSnapshots(root);
        if (!snapshots.length) {
          hint("  No snapshots yet. Run `devcontext update` to create one.\n");
          return;
        }

        heading(`Time machine · ${snapshots.length} snapshots`);
        console.log();
        for (const [i, snap] of snapshots.entries()) {
          const isCurrent = i === 0;
          const marker = isCurrent ? chalk.green("●") : chalk.dim("○");
          console.log(
            `  ${marker} ${chalk.dim(`[${i}]`)} ${snap.timestamp} ` +
              `${chalk.dim(snap.commitHash)} · ${snap.tokenCount} tokens`
          );
        }
        console.log();
        hint("  Use `devcontext tm show <index>` to view a snapshot.");
        hint("  Use `devcontext tm restore <index>` to restore.\n");
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

        // Simple line diff
        const linesA = contentA.split("\n");
        const linesB = contentB.split("\n");
        heading(`Diff: [${idxA}] ${snapshots[idxA].timestamp} vs [${idxB}] ${snapshots[idxB].timestamp}`);
        console.log();

        const added = linesA.filter((l) => !linesB.includes(l));
        const removed = linesB.filter((l) => !linesA.includes(l));

        if (added.length) {
          console.log(chalk.green("  + Added:"));
          for (const l of added.slice(0, 20)) {
            console.log(chalk.green(`    + ${l}`));
          }
        }
        if (removed.length) {
          console.log(chalk.red("  - Removed:"));
          for (const l of removed.slice(0, 20)) {
            console.log(chalk.red(`    - ${l}`));
          }
        }
        if (!added.length && !removed.length) {
          hint("  No differences found.\n");
        }
        console.log();
        break;
      }

      default:
        hint("  Usage: devcontext tm <list|show|restore|diff> [args]");
        hint("  Examples:");
        hint("    devcontext tm list");
        hint("    devcontext tm show 0");
        hint("    devcontext tm restore 3");
        hint("    devcontext tm diff 0 2\n");
    }

    freeEncoder();
  } catch (err: any) {
    error(err.message);
  }
}
