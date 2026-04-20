#!/usr/bin/env node

import { Command } from "commander";
import {
  cmdInit,
  cmdUpdate,
  cmdStatus,
  cmdShow,
  cmdConfig,
  cmdInstallHook,
  cmdTimeMachine,
} from "../index.js";

const program = new Command();

program
  .name("devcontext")
  .description("Git-aware AI context generator. Stop wasting tokens teaching AI about your codebase.")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize devcontext for this repository")
  .option("-b, --budget <tokens>", "Token budget for context output", parseInt)
  .option("-d, --depth <type>", "Sync depth: recent or inception", "recent")
  .option("-c, --commits <count>", "Max commits to parse (for inception)", parseInt)
  .option("-s, --silent", "Suppress output")
  .action(async (opts) => {
    await cmdInit({
      budget: opts.budget,
      depth: opts.depth,
      commits: opts.commits,
      silent: opts.silent,
    });
  });

program
  .command("update")
  .description("Update context from recent git changes")
  .option("-s, --silent", "Suppress output")
  .action(async (opts) => {
    await cmdUpdate({ silent: opts.silent });
  });

program
  .command("status")
  .description("Show current context status")
  .action(cmdStatus);

program
  .command("show")
  .description("Print context.md to stdout (for piping/copying)")
  .action(cmdShow);

program
  .command("generate")
  .description("Regenerate context.md")
  .action(async () => {
    await cmdUpdate({ silent: false });
  });

program
  .command("config")
  .description("View or update configuration")
  .option("-b, --budget <tokens>", "Set token budget", parseInt)
  .option("--max-commits <n>", "Max commits to parse", parseInt)
  .option("--recent-days <n>", "Days of history to include", parseInt)
  .option("--sync-depth <type>", "Sync depth: recent or inception")
  .option("--sync-commits <n>", "Commits for inception sync", parseInt)
  .option("--auto-inject <bool>", "Auto-inject context in IDE")
  .option("--ask-before <bool>", "Ask before injecting context")
  .action(async (opts) => {
    await cmdConfig({
      budget: opts.budget,
      maxCommits: opts.maxCommits,
      recentDays: opts.recentDays,
      syncDepth: opts.syncDepth,
      syncCommits: opts.syncCommits,
      autoInject: opts.autoInject === "true" ? true : opts.autoInject === "false" ? false : undefined,
      askBefore: opts.askBefore === "true" ? true : opts.askBefore === "false" ? false : undefined,
    });
  });

program
  .command("install-hook")
  .description("Install git hooks for auto-sync")
  .action(cmdInstallHook);

program
  .command("tm [action] [args...]")
  .description("Time machine — browse, diff, and restore past contexts")
  .action(async (action = "list", args = []) => {
    await cmdTimeMachine(action, args);
  });

// Aliases
program
  .command("timemachine [action] [args...]")
  .description("Alias for tm")
  .action(async (action = "list", args = []) => {
    await cmdTimeMachine(action, args);
  });

program.parse();
