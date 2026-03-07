# Optimistic Updates in Vector

Vector uses a custom `useOptimisticValue` hook to make selector interactions feel instant. The hook lives at `src/hooks/use-optimistic.ts`.

## How It Works

1. User picks a new value in a selector (e.g. changes priority)
2. `setOptimistic(newValue)` is called **before** the mutation fires
3. The selector immediately displays `newValue`
4. The Convex mutation runs server-side
5. Convex's reactive subscription updates the query data
6. The parent re-renders with the new server value
7. React's "adjust state during render" pattern detects the server change and clears the optimistic override
8. A safety timeout (5s) clears stale optimistic state if the mutation fails

## Hook API

```tsx
import { useOptimisticValue } from '@/hooks/use-optimistic';

// Single value (string, number, etc.)
const [displayValue, setOptimistic] = useOptimisticValue(serverValue);

// Array variant (compares by JSON serialisation)
import { useOptimisticArray } from '@/hooks/use-optimistic';
const [displayItems, setOptimisticItems] = useOptimisticArray(serverItems);
```

## Usage in Selectors

Every selector follows this pattern:

```tsx
export function XSelector({ selectedX, onXSelect, ... }) {
  const [displayX, setOptimisticX] = useOptimisticValue(selectedX);

  // Use displayX for ALL display logic (finding current item, check marks, button label)
  const current = items.find(i => i._id === displayX);

  // On select: set optimistic FIRST, then fire the callback
  const handleSelect = (id: string) => {
    setOptimisticX(id);     // instant UI update
    onXSelect(id);          // fires mutation in parent
    setOpen(false);
  };

  // Check marks use displayX
  <Check className={cn('mr-2 h-4 w-4',
    displayX === item._id ? 'opacity-100' : 'opacity-0'
  )} />
}
```

## Selectors with Optimistic Updates

All of these selectors use `useOptimisticValue` internally:

| Selector            | File                      | Optimistic field   |
| ------------------- | ------------------------- | ------------------ |
| PrioritySelector    | issue-selectors.tsx       | `selectedPriority` |
| StateSelector       | issue-selectors.tsx       | `selectedState`    |
| ProjectSelector     | issue-selectors.tsx       | `selectedProject`  |
| TeamSelector        | team-selector.tsx         | `selectedTeam`     |
| VisibilitySelector  | visibility-selector.tsx   | `value`            |
| StatusSelector      | project-selectors.tsx     | `selectedStatus`   |
| ProjectLeadSelector | project-lead-selector.tsx | `selectedLead`     |
| RoleSelector        | role-selector.tsx         | `currentRole`      |

## Parent Components (No Changes Needed)

Parents continue to fire mutations normally. The optimistic behaviour is encapsulated inside each selector:

```tsx
// Parent: no change needed
const handlePriorityChange = (issueId: string, priorityId: string) => {
  void changePriorityMutation({
    issueId: issueId as Id<'issues'>,
    priorityId: priorityId as Id<'issuePriorities'>,
  });
};

<PrioritySelector
  priorities={priorities}
  selectedPriority={issue.priorityId || ''}
  onPrioritySelect={id => handlePriorityChange(issue._id, id)}
/>;
```

## When NOT to Use

- **Creation dialogs** — local form state already provides instant feedback
- **Delete operations** — should wait for confirmation + mutation
- **Multi-step operations** — e.g. file uploads, where progress is shown differently
- **Navigation triggers** — e.g. slug changes that cause a redirect
