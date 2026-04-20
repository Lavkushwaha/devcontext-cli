# devcontext

**Stop wasting tokens teaching AI about your codebase.**

Every new AI chat starts from zero. You paste files, explain architecture, describe recent changes — burning tokens on context reconstruction before the real work begins.

`devcontext` watches your git repo and generates a token-optimized context file that any AI instantly understands. It auto-updates on every commit, pull, and checkout.

```
$ devcontext init

  ◆ devcontext initialized

  │ Files scanned        347
  │ Commits parsed       30
  │ Tokens               ████████████████░░░░ 3847/4000 tokens (96%)
  │ Output               .context/context.md
  │ Hooks                post-commit, post-merge, post-checkout
```

## Install

```bash
npm install -g devcontext-cli
```

Or use without installing:
```bash
npx devcontext-cli init
```

## Quick Start

```bash
# Initialize in your repo (scans files, parses git log, generates context)
devcontext init

# Paste context into any AI chat
devcontext show | pbcopy          # macOS
devcontext show | xclip           # Linux
devcontext show | clip             # Windows

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
│     devcontext engine       │
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
| `devcontext init` | | First-time setup. Scans repo, generates context, installs hooks |
| `devcontext update` | | Refresh context from latest git state |
| `devcontext show` | | Print context.md to stdout (pipe-friendly) |
| `devcontext status` | | Show context freshness, token count, stats |
| `devcontext config` | | View/update settings |
| `devcontext install-hook` | | Install git hooks for auto-sync |
| `devcontext tm list` | `timemachine list` | Browse past context snapshots |
| `devcontext tm show <n>` | | View a specific snapshot |
| `devcontext tm restore <n>` | | Restore a snapshot as current context |
| `devcontext tm diff <a> <b>` | | Diff two snapshots |

### Init Options

```bash
devcontext init --budget 8000           # Larger token budget
devcontext init --depth inception       # Parse all commits from beginning
devcontext init --commits 500           # Number of commits for inception mode
```

### Config Options

```bash
devcontext config --budget 6000
devcontext config --max-commits 50
devcontext config --sync-depth inception
devcontext config --auto-inject true     # For IDE extension
```

## Time Machine

Every `update` saves a snapshot. Browse your codebase's context evolution:

```bash
$ devcontext tm list

  ◆ Time machine · 12 snapshots

  ● [0] 2026-04-20 14:30 a3f2b1c4 · 3847 tokens
  ○ [1] 2026-04-19 16:45 b7e9d0a1 · 3612 tokens
  ○ [2] 2026-04-18 09:15 c1d4e8f2 · 3490 tokens
  ...

$ devcontext tm diff 0 2     # What changed in context between snapshots
$ devcontext tm restore 2    # Go back to an earlier context state
$ devcontext tm show 1       # View a specific snapshot
```

Use case: "The AI was giving better answers last week. What context did it have then?"

## VS Code Extension

Install the `devcontext-vscode` extension for IDE integration:

- **Status bar** shows current token count
- **Auto-inject** context before AI queries (configurable)
- **Copy to clipboard** from command palette
- **Stale detection** suggests updates when context is old
- **File watching** tracks git changes in real-time

Settings: `Cmd+,` → search "devcontext"

## Auto-Sync

By default, `devcontext init` installs these git hooks:

| Hook | Trigger | Default |
|------|---------|---------|
| `post-commit` | After every commit | ✓ enabled |
| `post-merge` | After pull/merge | ✓ enabled |
| `post-checkout` | After branch switch | ✓ enabled |

Hooks run async — they don't slow down your git workflow.

## Example Output

```markdown
<!-- devcontext | 2026-04-20 14:30 | 3847 tokens -->
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

devcontext exports its full API for programmatic use:

```typescript
import {
  initGit,
  findRepoRoot,
  scanRepo,
  detectStack,
  compileContext,
  readContext,
  listSnapshots,
} from "devcontext-cli";

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

Your codebase has a README that goes stale. It has docs that lag behind reality. But it has a git log that is always true. devcontext turns that truth into something every AI can consume instantly.

## License

MIT
