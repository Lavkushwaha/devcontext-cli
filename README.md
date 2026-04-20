# dev-context

**Stop wasting tokens teaching AI about your codebase.**

Every new AI chat starts from zero. You paste files, explain architecture, describe recent changes — burning tokens on context reconstruction before the real work begins.

`dev-context` watches your git repo and generates a token-optimized context file that any AI instantly understands. It auto-updates on every commit, pull, and checkout.

```
$ dev-context init

  ◆ dev-context initialized

  │ Files scanned        347
  │ Commits parsed       30
  │ Tokens               ████████████████░░░░ 3847/4000 tokens (96%)
  │ Output               .context/context.md
  │ Hooks                post-commit, post-merge, post-checkout
```

## Install

```bash
npm install -g dev-context
```

Or use without installing:
```bash
npx dev-context init
```

## Quick Start

```bash
# Initialize in your repo (scans files, parses git log, generates context)
dev-context init

# Paste context into any AI chat
dev-context show | pbcopy          # macOS
dev-context show | xclip           # Linux
dev-context show | clip             # Windows

# Or just open and copy
cat .context/context.md
```

That's it. Every new AI conversation starts with full codebase awareness.

## How It Works

```
Git events (commit/pull/push/checkout/open)
    │
    ▼
┌─────────────────────────────┐
│     dev-context engine       │
│  ┌──────────┐ ┌──────────┐  │
│  │  Scanner  │ │  Differ  │  │
│  └──────────┘ └──────────┘  │
│  ┌─────────────────────────┐│
│  │   Context Compiler      ││
│  │   Token budget → .md    ││
│  └─────────────────────────┘│
└─────────────────────────────┘
    │
    ▼
.context/
├── context.md          ← paste this
├── timemachine/        ← past snapshots
├── system.json         ← cached architecture
└── config.json         ← your settings
```

1. **Scans** your repo, skipping noise (build/, node_modules/, generated files)
2. **Detects** tech stack from config files (pubspec.yaml, package.json, Cargo.toml, etc.)
3. **Parses** git history to extract recent commits with changed files
4. **Identifies** hot zones — files changing most frequently
5. **Compiles** everything into a single token-budgeted markdown file
6. **Snapshots** every update into the time machine for history tracking

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `dev-context init` | | First-time setup. Scans repo, generates context, installs hooks |
| `dev-context update` | | Refresh context from latest git state |
| `dev-context show` | | Print context.md to stdout (pipe-friendly) |
| `dev-context status` | | Show context freshness, token count, stats |
| `dev-context config` | | View/update settings |
| `dev-context install-hook` | | Install git hooks for auto-sync |
| `dev-context tm list` | `timemachine list` | Browse past context snapshots |
| `dev-context tm show <n>` | | View a specific snapshot |
| `dev-context tm restore <n>` | | Restore a snapshot as current context |
| `dev-context tm diff <a> <b>` | | Diff two snapshots |

### Init Options

```bash
dev-context init --budget 8000           # Larger token budget
dev-context init --depth inception       # Parse all commits from beginning
dev-context init --commits 500           # Number of commits for inception mode
```

### Config Options

```bash
dev-context config --budget 6000
dev-context config --max-commits 50
dev-context config --sync-depth inception
dev-context config --auto-inject true     # For IDE extension
```

## Time Machine

Every `update` saves a snapshot. Browse your codebase's context evolution:

```bash
$ dev-context tm list

  ◆ Time machine · 12 snapshots

  ● [0] 2026-04-20 14:30 a3f2b1c4 · 3847 tokens
  ○ [1] 2026-04-19 16:45 b7e9d0a1 · 3612 tokens
  ○ [2] 2026-04-18 09:15 c1d4e8f2 · 3490 tokens
  ...

$ dev-context tm diff 0 2     # What changed in context between snapshots
$ dev-context tm restore 2    # Go back to an earlier context state
$ dev-context tm show 1       # View a specific snapshot
```

Use case: "The AI was giving better answers last week. What context did it have then?"

## VS Code Extension

Install the `dev-context-vscode` extension for IDE integration:

- **Status bar** shows current token count
- **Auto-inject** context before AI queries (configurable)
- **Copy to clipboard** from command palette
- **Stale detection** suggests updates when context is old
- **File watching** tracks git changes in real-time

Settings: `Cmd+,` → search "dev-context"

## Auto-Sync

By default, `dev-context init` installs these git hooks:

| Hook | Trigger | Default |
|------|---------|---------|
| `post-commit` | After every commit | ✓ enabled |
| `post-merge` | After pull/merge | ✓ enabled |
| `post-checkout` | After branch switch | ✓ enabled |

Hooks run async — they don't slow down your git workflow.

## Example Output

```markdown
<!-- dev-context | 2026-04-20 14:30 | 3847 tokens -->
# my-trading-app
Repo: user/my-trading-app | Branch: main

## Stack
Languages: Dart/Flutter (234 files), TypeScript (45 files)
Frameworks: Flutter, Firebase
Tools: GetX, Tailwind CSS

## Hot zones (frequently changed)
  lib/socket_mixin.dart (8 commits)
  lib/controllers/base.dart (5 commits)

## Recent changes
  [2026-04-20]
    a3f2b1c4 refactor: split socket mixin into modules (socket_mixin.dart +3 more)
    b7e9d0a1 fix: deeplink ampersand truncation (deeplink_handler.dart)
  [2026-04-19]
    c1d4e8f2 feat: add analytics mixins (analytics/ +4 more)

## Key files
  pubspec.yaml — Flutter options trading app
  lib/socket/ — WebSocket subscription lifecycle
  lib/controllers/base.dart — Core controller with parallel API
```

## Extending

dev-context exports its full API for programmatic use:

```typescript
import {
  initGit,
  findRepoRoot,
  scanRepo,
  detectStack,
  compileContext,
  readContext,
  listSnapshots,
} from "dev-context";

// Use in your own tools, IDE extensions, CI pipelines
const root = await findRepoRoot();
const content = await readContext(root);
```

### IDE Extension Development

The `extensions/` directory contains:
- `vscode/` — VS Code extension (production-ready scaffold)
- Future: JetBrains, Neovim, Zed

### Planned Features

- [ ] MCP server mode — Claude/Cursor pull context automatically
- [ ] AI-powered diff summaries — use LLM to summarize complex changes
- [ ] Multi-repo support — monorepo and cross-repo context
- [ ] Context profiles — different budgets for different AI tools
- [ ] `.contextignore` — fine-grained exclusion control
- [ ] Web dashboard — visual time machine browser

## Philosophy

This tool exists because of one insight: **AI context is a first-class artifact that should be version-controlled, auto-maintained, and always current.**

Your codebase has a README that goes stale. It has docs that lag behind reality. But it has a git log that is always true. dev-context turns that truth into something every AI can consume instantly.

## License

MIT
