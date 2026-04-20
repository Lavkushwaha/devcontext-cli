import chalk from "chalk";
import ora, { type Ora } from "ora";
import gradientString from "gradient-string";

// ─── Brand Colors ────────────────────────────────────────────────────────────

const BRAND = {
  primary: "#6C5CE7",
  secondary: "#A29BFE",
  accent: "#00CEC9",
  warm: "#FD79A8",
  success: "#00B894",
  warning: "#FDCB6E",
  error: "#D63031",
  muted: "#636E72",
};

const ctxGradient = gradientString([BRAND.primary, BRAND.accent]);
const warmGradient = gradientString([BRAND.warm, BRAND.secondary]);

// ─── ASCII Art Banner ────────────────────────────────────────────────────────

const BANNER = `
     ██████╗  ███████╗██╗   ██╗ ██████╗████████╗██╗  ██╗
     ██╔══██╗ ██╔════╝██║   ██║██╔════╝╚══██╔══╝╚██╗██╔╝
     ██║  ██║ █████╗  ██║   ██║██║        ██║    ╚███╔╝ 
     ██║  ██║ ██╔══╝  ╚██╗ ██╔╝██║        ██║    ██╔██╗ 
     ██████╔╝ ███████╗ ╚████╔╝ ╚██████╗   ██║   ██╔╝ ██╗
     ╚═════╝  ╚══════╝  ╚═══╝   ╚═════╝   ╚═╝   ╚═╝  ╚═╝
`;

export function showBanner(): void {
  console.log(ctxGradient(BANNER));
  console.log(
    chalk.dim("     git-aware AI context · v0.1.0\n")
  );
}

export function showMiniBanner(): void {
  console.log(
    ctxGradient("  ▲ dev-context") + chalk.dim(" · context is everything\n")
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function createSpinner(text: string): Ora {
  return ora({
    text: chalk.dim(text),
    spinner: "dots12",
    color: "cyan",
  });
}

// ─── Status Output ───────────────────────────────────────────────────────────

export function heading(text: string): void {
  console.log(`\n${chalk.hex(BRAND.primary).bold("  ◆")} ${chalk.bold(text)}`);
}

export function subheading(text: string): void {
  console.log(`  ${chalk.hex(BRAND.accent)("│")} ${chalk.dim(text)}`);
}

export function info(label: string, value: string): void {
  console.log(
    `  ${chalk.hex(BRAND.accent)("│")} ${chalk.dim(label.padEnd(18))} ${value}`
  );
}

export function success(text: string): void {
  console.log(`\n  ${chalk.hex(BRAND.success)("✓")} ${chalk.green(text)}`);
}

export function warn(text: string): void {
  console.log(`  ${chalk.hex(BRAND.warning)("⚠")} ${chalk.yellow(text)}`);
}

export function error(text: string): void {
  console.log(`  ${chalk.hex(BRAND.error)("✗")} ${chalk.red(text)}`);
}

export function hint(text: string): void {
  console.log(`  ${chalk.dim(text)}`);
}

export function divider(): void {
  console.log(chalk.dim("  ─".repeat(30)));
}

export function tokenBadge(tokens: number, budget: number): string {
  const pct = Math.round((tokens / budget) * 100);
  const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
  const color =
    pct < 70 ? chalk.hex(BRAND.success) :
    pct < 90 ? chalk.hex(BRAND.warning) :
    chalk.hex(BRAND.error);
  return `${color(bar)} ${tokens}/${budget} tokens (${pct}%)`;
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function table(rows: Array<[string, string]>): void {
  const maxLabel = Math.max(...rows.map(([l]) => l.length));
  for (const [label, value] of rows) {
    console.log(
      `  ${chalk.hex(BRAND.accent)("│")} ${chalk.dim(label.padEnd(maxLabel + 2))} ${value}`
    );
  }
}

// ─── Box ─────────────────────────────────────────────────────────────────────

export function box(title: string, content: string): void {
  const lines = content.split("\n");
  const maxLen = Math.max(title.length + 4, ...lines.map((l) => l.length)) + 4;
  const top = `╭${"─".repeat(maxLen)}╮`;
  const bot = `╰${"─".repeat(maxLen)}╯`;
  const titleLine = `│  ${chalk.bold(title)}${"".padEnd(maxLen - title.length - 2)}│`;

  console.log(chalk.hex(BRAND.accent)(top));
  console.log(chalk.hex(BRAND.accent)(titleLine));
  console.log(chalk.hex(BRAND.accent)(`│${"".padEnd(maxLen)}│`));
  for (const line of lines) {
    console.log(
      chalk.hex(BRAND.accent)("│") +
        `  ${line}${"".padEnd(Math.max(0, maxLen - line.length - 2))}` +
        chalk.hex(BRAND.accent)("│")
    );
  }
  console.log(chalk.hex(BRAND.accent)(bot));
}

// ─── File Tree ───────────────────────────────────────────────────────────────

export function fileTree(entries: Array<{ path: string; info: string }>): void {
  for (let i = 0; i < entries.length; i++) {
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└──" : "├──";
    console.log(
      `  ${chalk.dim(connector)} ${chalk.white(entries[i].path)} ${chalk.dim("·")} ${chalk.dim(entries[i].info)}`
    );
  }
}

// ─── Progress ────────────────────────────────────────────────────────────────

export function progressStep(step: number, total: number, text: string): void {
  const filled = Math.round((step / total) * 20);
  const bar = chalk.hex(BRAND.accent)("█".repeat(filled)) + chalk.dim("░".repeat(20 - filled));
  process.stdout.write(`\r  ${bar} ${chalk.dim(`[${step}/${total}]`)} ${text}`);
  if (step === total) console.log();
}

export { BRAND };
