# Contributing to dev-context

Thanks for your interest in contributing! dev-context is an open-source developer tool and contributions of all kinds are welcome.

## Development Setup

```bash
git clone https://github.com/devcontext/devcontext.git
cd devcontext
npm install
npm run dev    # Watch mode with tsup
```

### Testing locally

```bash
# Link the CLI globally
npm link

# Test in any git repo
cd /path/to/some-repo
dev-context init
dev-context status
dev-context tm list
```

### Project Structure

```
src/
├── bin/cli.ts           # CLI entry point (Commander)
├── commands/index.ts    # All command implementations
├── core/
│   ├── git.ts           # Git operations (simple-git wrapper)
│   ├── scanner.ts       # Repo file scanning & stack detection
│   └── compiler.ts      # Context generation & time machine
├── utils/
│   ├── ui.ts            # Terminal UI (chalk, ora, gradients)
│   └── tokens.ts        # Token counting
├── types.ts             # TypeScript types & constants
└── index.ts             # Public API exports

extensions/
└── vscode/              # VS Code extension
```

## What to Work On

### Good First Issues
- Add support for more language detection in `LANG_MAP`
- Improve file purpose extraction heuristics
- Add more framework detection (SvelteKit, Remix, Rails, Django)
- Write unit tests for scanner and compiler

### Medium
- Implement `.contextignore` file parsing
- Add `dev-context diff` command (diff current vs last snapshot)
- Improve token counting accuracy
- Add JSON output mode for CI/CD integration

### Large
- JetBrains IDE extension
- Neovim/Vim plugin
- MCP server mode for Claude/Cursor auto-pull
- AI-powered diff summarization
- Web dashboard for time machine visualization

## Code Style

- TypeScript strict mode
- ESM modules (no CommonJS)
- Prefer `async/await` over callbacks
- Use the UI utilities from `src/utils/ui.ts` for all terminal output
- Keep dependencies minimal

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Run `npm run typecheck` and `npm run lint`
4. Test manually in a real git repo
5. Write a clear PR description explaining what and why
6. Submit!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
