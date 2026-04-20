/**
 * Token counting utility.
 * Uses a character-based heuristic by default.
 * Falls back gracefully if tiktoken isn't available.
 */

let encoder: any = null;
let useHeuristic = false;

export async function initEncoder(): Promise<void> {
  try {
    const { get_encoding } = await import("tiktoken");
    encoder = get_encoding("cl100k_base");
  } catch {
    useHeuristic = true;
  }
}

export function countTokens(text: string): number {
  if (encoder && !useHeuristic) {
    try {
      return encoder.encode(text).length;
    } catch {
      // fallback
    }
  }
  // Heuristic: ~1 token per 3.5 chars for code-heavy content
  // Slightly conservative to stay under budget
  return Math.ceil(text.length / 3.5);
}

export function freeEncoder(): void {
  if (encoder?.free) {
    encoder.free();
    encoder = null;
  }
}
