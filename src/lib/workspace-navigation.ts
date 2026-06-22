export interface LastWorkspaceNavigation {
  name: string;
  slug: string;
}

const LAST_WORKSPACE_STORAGE_KEY = 'vector.last-workspace';

function isValidWorkspaceNavigation(
  value: unknown,
): value is LastWorkspaceNavigation {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<LastWorkspaceNavigation>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.slug === 'string' &&
    candidate.slug.trim().length > 0
  );
}

export function readLastWorkspaceNavigation(): LastWorkspaceNavigation | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isValidWorkspaceNavigation(parsed)) return null;

    return {
      name: parsed.name.trim(),
      slug: parsed.slug.trim(),
    };
  } catch {
    return null;
  }
}

export function rememberLastWorkspaceNavigation(
  workspace: LastWorkspaceNavigation,
) {
  if (typeof window === 'undefined' || !isValidWorkspaceNavigation(workspace)) {
    return;
  }

  try {
    window.localStorage.setItem(
      LAST_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        name: workspace.name.trim(),
        slug: workspace.slug.trim(),
      }),
    );
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
