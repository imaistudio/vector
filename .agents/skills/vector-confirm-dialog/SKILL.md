---
name: vector-confirm-dialog
description: Use when adding destructive confirmations, replacing window.confirm() or alert(), or building any user-facing confirmation flow. Covers the useConfirm hook, AlertDialog composition, and Vector-specific patterns.
user-invocable: false
---

# Vector Confirm Dialog

Use this skill whenever you need to confirm a destructive or significant action with the user.

## The Rule

**Never use `window.confirm()` or `window.alert()` in this codebase.**

- For confirmations (delete, remove, revoke, etc.) use the `useConfirm` hook.
- For validation feedback or error messages use `toast.error()` from `sonner`.
- For success feedback on inline edits, let the optimistic update be the confirmation (no toast needed per Vector design).

## The Hook: `useConfirm`

Located at `src/hooks/use-confirm.tsx`.

### API

```tsx
const [confirm, ConfirmDialog] = useConfirm();
```

Returns a tuple:

1. `confirm(options)` - async function that returns `Promise<boolean>`
2. `ConfirmDialog` - React component that must be rendered in the JSX tree

### Options

```ts
interface ConfirmOptions {
  title: string; // Short action label, e.g. "Delete issue"
  description: string; // What happens if they confirm
  confirmLabel?: string; // Button text, default "Confirm"
  cancelLabel?: string; // Button text, default "Cancel"
  variant?: 'default' | 'destructive'; // default: 'default'
}
```

### Usage Pattern

```tsx
function MyComponent() {
  const [confirm, ConfirmDialog] = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete item',
      description:
        'This will permanently delete the item and cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    // proceed with mutation
  };

  return (
    <>
      {/* your UI */}
      <ConfirmDialog />
    </>
  );
}
```

### Where to Render `<ConfirmDialog />`

- If the component returns a single root element, add `<ConfirmDialog />` as a sibling inside a fragment.
- If the confirm is used inside a `DropdownMenu`, wrap both in a fragment: `<> <DropdownMenu>...</DropdownMenu> <ConfirmDialog /> </>`.
- If inside a `Dialog` or `Popover`, place `<ConfirmDialog />` as a sibling of `DialogContent`/`PopoverContent` (still inside the root primitive).

### Multiple Confirms

If a component needs different confirm dialogs for different actions, use descriptive names:

```tsx
const [confirmDelete, ConfirmDeleteDialog] = useConfirm();
const [confirmRemove, ConfirmRemoveDialog] = useConfirm();
```

## Design Details

The confirm dialog follows Vector's dense design:

- `sm:max-w-sm` width
- `gap-3 p-4` spacing
- `text-sm font-semibold` title
- `text-xs` description
- `size='sm'` buttons
- Ghost cancel, primary/destructive confirm
- Uses shadcn `AlertDialog` primitives under the hood

## Copy Guidelines

- **Title**: short verb phrase describing the action: "Delete issue", "Remove member", "Revoke invitation"
- **Description**: one sentence explaining what happens, ending with consequence: "This will permanently delete the item and cannot be undone." or "They will lose access to all resources."
- **Confirm label**: matches the action verb: "Delete", "Remove", "Revoke"
- **Variant**: use `destructive` for deletions, removals, and revocations

## Anti-Patterns

- Do not use `window.confirm()` or `window.alert()` anywhere in the codebase
- Do not use `alert()` for validation — use `toast.error()` instead
- Do not add success toasts for routine inline property changes (per Vector design skill)
- Do not create custom modal markup for confirmations — use the hook
- Do not use the hook for non-destructive informational messages — use `toast` or inline UI
