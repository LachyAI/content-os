export const HOOK_PATTERNS = [
  "Bold Claim",
  "Question",
  "Pattern Interrupt",
  "Controversial Take",
  "Result/Proof",
  "How-To",
  "Curiosity Gap",
] as const;

export type HookPattern = (typeof HOOK_PATTERNS)[number];

export interface SavedHook {
  id: string;
  hook: string;
  username: string;
  engagement: number;
  pattern?: HookPattern;
  postUrl?: string;
  savedAt: string;
}

const STORAGE_KEY = "hook-library";

export function getSavedHooks(): SavedHook[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveHook(hook: SavedHook): void {
  const hooks = getSavedHooks();
  if (hooks.some((h) => h.id === hook.id)) return;
  hooks.unshift(hook);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks));
}

export function removeHook(id: string): void {
  const hooks = getSavedHooks().filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks));
}

export function updateHookPattern(id: string, pattern: HookPattern): void {
  const hooks = getSavedHooks();
  const hook = hooks.find((h) => h.id === id);
  if (hook) {
    hook.pattern = pattern;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks));
  }
}
