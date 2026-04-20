import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const CONTEXT_DIR = ".context";
const CONTEXT_FILE = "context.md";

let statusBarItem: vscode.StatusBarItem;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  // ─── Status Bar ──────────────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "dev-context.show";
  statusBarItem.tooltip = "dev-context · click to view context";
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ─── Commands ────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("dev-context.init", async () => {
      const terminal = vscode.window.createTerminal("dev-context");
      terminal.show();
      terminal.sendText("npx dev-context init");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dev-context.update", async () => {
      const terminal = vscode.window.createTerminal("dev-context");
      terminal.show();
      terminal.sendText("npx dev-context update");
      // Refresh status after a delay
      setTimeout(updateStatusBar, 3000);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dev-context.show", async () => {
      const contextPath = getContextFilePath();
      if (!contextPath) {
        const init = await vscode.window.showWarningMessage(
          "dev-context not initialized in this workspace.",
          "Initialize"
        );
        if (init === "Initialize") {
          vscode.commands.executeCommand("dev-context.init");
        }
        return;
      }
      const doc = await vscode.workspace.openTextDocument(contextPath);
      await vscode.window.showTextDocument(doc, { preview: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dev-context.copyContext", async () => {
      const content = readContextFile();
      if (!content) {
        vscode.window.showWarningMessage("No context.md found. Run dev-context init.");
        return;
      }
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(
        `dev-context: Copied ${estimateTokens(content)} tokens to clipboard`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dev-context.injectContext", async () => {
      const content = readContextFile();
      if (!content) {
        vscode.window.showWarningMessage("No context.md found. Run dev-context init.");
        return;
      }

      const config = vscode.workspace.getConfiguration("dev-context");
      const askBefore = config.get<boolean>("askBeforeInject", true);

      if (askBefore) {
        const action = await vscode.window.showInformationMessage(
          `Inject ${estimateTokens(content)} tokens of context?`,
          "Yes",
          "No",
          "Copy to Clipboard"
        );
        if (action === "No") return;
        if (action === "Copy to Clipboard") {
          await vscode.env.clipboard.writeText(content);
          vscode.window.showInformationMessage("Context copied to clipboard.");
          return;
        }
      }

      // Try to inject into active editor / chat
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const position = editor.selection.active;
        await editor.edit((editBuilder) => {
          editBuilder.insert(position, content + "\n\n");
        });
        vscode.window.showInformationMessage("Context injected.");
      } else {
        await vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage("No active editor. Context copied to clipboard.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dev-context.timeMachine", async () => {
      const terminal = vscode.window.createTerminal("dev-context");
      terminal.show();
      terminal.sendText("npx dev-context tm list");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dev-context.settings", async () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "dev-context"
      );
    })
  );

  // ─── File Watcher ───────────────────────────────────────────────────

  setupFileWatcher(context);

  // ─── Auto-update on project open ────────────────────────────────────

  if (getContextFilePath()) {
    // Context exists, check if it needs updating
    const contextPath = getContextFilePath()!;
    try {
      const stat = fs.statSync(contextPath);
      const age = Date.now() - stat.mtimeMs;
      // If older than 1 hour, suggest update
      if (age > 60 * 60 * 1000) {
        vscode.window
          .showInformationMessage(
            "dev-context: Context is stale. Update?",
            "Update",
            "Later"
          )
          .then((action) => {
            if (action === "Update") {
              vscode.commands.executeCommand("dev-context.update");
            }
          });
      }
    } catch {
      // ignore
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getContextFilePath(): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) return undefined;
  const contextPath = path.join(root, CONTEXT_DIR, CONTEXT_FILE);
  return fs.existsSync(contextPath) ? contextPath : undefined;
}

function readContextFile(): string | null {
  const filePath = getContextFilePath();
  if (!filePath) return null;
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function updateStatusBar(): void {
  const content = readContextFile();
  if (content) {
    const tokens = estimateTokens(content);
    statusBarItem.text = `$(symbol-misc) dctx: ${tokens} tokens`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = `$(symbol-misc) dctx: not initialized`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }
}

function setupFileWatcher(context: vscode.ExtensionContext): void {
  const root = getWorkspaceRoot();
  if (!root) return;

  // Watch for git changes
  const gitWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(root, ".git/refs/heads/*")
  );

  gitWatcher.onDidChange(() => {
    const config = vscode.workspace.getConfiguration("dev-context");
    const autoUpdate = config.get<boolean>("autoUpdateOnSave", false);
    if (autoUpdate && getContextFilePath()) {
      // Auto-update silently
      const terminal = vscode.window.createTerminal({
        name: "dev-context",
        hideFromUser: true,
      });
      terminal.sendText("npx dev-context update --silent");
      setTimeout(() => {
        terminal.dispose();
        updateStatusBar();
      }, 5000);
    }
  });

  context.subscriptions.push(gitWatcher);

  // Watch for context.md changes to update status bar
  const ctxWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(root, `${CONTEXT_DIR}/${CONTEXT_FILE}`)
  );
  ctxWatcher.onDidChange(() => updateStatusBar());
  ctxWatcher.onDidCreate(() => updateStatusBar());
  ctxWatcher.onDidDelete(() => updateStatusBar());
  context.subscriptions.push(ctxWatcher);
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
}
