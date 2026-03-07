---
name: vector-design
description: Vector's dense UI design system. Use when building new pages, components, dialogs, tables, selectors, or any UI in the Vector project. Covers layout patterns, inline selectors, creation dialogs, data tables with micro-interactions, animation, optimistic updates, and shadcn composition patterns specific to this codebase.
user-invocable: false
---

# Vector Design System

Vector is a dense, Linear-inspired project management UI built with Next.js, shadcn/ui, Tailwind CSS, Convex, and motion/react. Every component prioritises information density, instant feedback, and keyboard-friendly interactions.

## Core Principles

1. **Dense by default.** Minimise padding — use `p-1`, `p-2`, `gap-2`. Rows are 24-32 px tall.
2. **Inline everything.** Properties (state, priority, team, assignee) are changed via inline Popover+Command dropdowns — never separate pages or modals.
3. **Optimistic UI.** Every selector uses `useOptimisticValue` so changes feel instant. See [optimistic.md](./optimistic.md).
4. **Animate list operations.** Use motion/react `AnimatePresence` + `layout` for add/remove/reorder.
5. **Permission-aware.** Wrap editable selectors in `PermissionAware` / `PermissionAwareSelector`.
6. **Icon-first selectors.** Use `displayMode='iconWhenUnselected'` — show icon only until a value is selected, then show icon + label.

## Sizing Reference

| Element               | Height    | Padding       | Font                  |
| --------------------- | --------- | ------------- | --------------------- |
| Tab button            | `h-6`     | `px-3`        | `text-xs font-normal` |
| Selector button       | `h-8`     | `gap-2`       | `text-sm`             |
| Table row (issues)    | —         | `px-3 py-2`   | —                     |
| Table row (projects)  | —         | `px-3 py-1.5` | —                     |
| Command input         | `h-9`     | —             | —                     |
| Create button         | `h-6`     | `size='sm'`   | `text-xs`             |
| Icon (inline)         | `h-3 w-3` | —             | —                     |
| Icon (command item)   | `h-4 w-4` | —             | —                     |
| Avatar (list row)     | `size-6`  | —             | `text-xs`             |
| Avatar (lead trigger) | `size-5`  | —             | `text-xs`             |

## Layout Patterns

### Page with Tabs + Table + Pagination

```
<div className='bg-background h-full'>
  {/* Tab header */}
  <div className='border-b'>
    <div className='flex items-center justify-between p-1'>
      <div className='flex items-center gap-1'>
        {tabs} {/* Each tab: Button size='sm' className='h-6 gap-2 rounded-xs px-3 text-xs font-normal' */}
      </div>
      <CreateButton /> {/* size='sm' className='h-6' */}
    </div>
  </div>

  {/* Scrollable table */}
  <div className='flex-1 overflow-y-auto'>
    <AnimatePresence initial={false}>
      {items.map(item => <Row key={item._id} ... />)}
    </AnimatePresence>
  </div>

  {/* Pagination */}
  <div className='border-t px-3 py-1.5 text-xs'>
    Page X of Y  [Prev] [Next]
  </div>
</div>
```

### Sidebar Layout (org / settings)

```
<div className='bg-secondary flex h-screen'>
  <aside className='hidden w-56 lg:block'>
    <div className='flex h-full flex-col'>
      <div className='p-2'>{/* org switcher or header */}</div>
      <div className='flex-1 overflow-y-auto'>{/* nav items */}</div>
      <div className='border-border border-t p-2'><UserMenu /></div>
    </div>
  </aside>
  <main className='bg-background m-2 ml-0 flex-1 overflow-y-auto rounded-md border'>
    {children}
  </main>
</div>
```

### Detail Page (issue / team)

```
<div className='bg-background h-full overflow-y-auto'>
  {/* Sticky header bar */}
  <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60
    flex items-center justify-between border-b px-2 backdrop-blur'>
    <div className='flex h-8 flex-wrap items-center gap-2'>
      <BackLink /> / <InlineSelectors /> / <Key />
    </div>
    <div className='flex items-center'>
      <StateSelector /> <Divider /> <PrioritySelector /> <Divider /> <VisibilitySelector />
    </div>
  </div>
  {/* Content at max-w-5xl */}
  <div className='mx-auto max-w-5xl px-4 py-4'>...</div>
</div>
```

Vertical divider between header selectors:

```tsx
<div className='bg-muted-foreground/20 h-4 w-px' />
```

## Selector Pattern (Popover + Command)

All selectors follow this structure. See `src/components/issues/issue-selectors.tsx` as the canonical reference.

```tsx
export function XSelector({
  items,
  selectedX,
  onXSelect,
  displayMode,
  trigger,
  className,
  align = 'start',
}) {
  const [open, setOpen] = useState(false);
  const { viewOnly } = useAccess();
  const [displayX, setOptimisticX] = useOptimisticValue(selectedX);

  const hasSelection = displayX !== '';
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);
  const current = items.find(i => i._id === displayX);

  const DefaultBtn = (
    <Button
      variant='outline'
      size='sm'
      className={cn('bg-muted/30 hover:bg-muted/50 h-8 gap-2', className)}
    >
      {showIcon && (
        <Icon
          className='h-3 w-3'
          style={{ color: current?.color || '#94a3b8' }}
        />
      )}
      {showLabel && (current?.name || 'Label')}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className='w-64 p-0'>
        <Command>
          <CommandInput placeholder='Search...' className='h-9' />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              {items.map(item => (
                <CommandItem
                  key={item._id}
                  value={item.name}
                  onSelect={() => {
                    if (!viewOnly) {
                      setOptimisticX(item._id);
                      onXSelect(item._id);
                      setOpen(false);
                    }
                  }}
                  disabled={viewOnly}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      displayX === item._id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <ItemIcon
                    className='mr-2 h-3 w-3'
                    style={{ color: item.color || '#94a3b8' }}
                  />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Display Mode Resolution

```tsx
type SelectorDisplayMode =
  | 'default'
  | 'labelOnly'
  | 'iconOnly'
  | 'iconWhenUnselected';

function resolveVisibility(mode, hasSelection) {
  switch (mode) {
    case 'labelOnly':
      return { showIcon: false, showLabel: true };
    case 'iconOnly':
      return { showIcon: true, showLabel: false };
    case 'iconWhenUnselected':
      return { showIcon: true, showLabel: hasSelection };
    default:
      return { showIcon: true, showLabel: true };
  }
}
```

### Dynamic Icons

Use `DynamicIcon` component for icon rendering in triggers/buttons to avoid React Compiler "component created during render" errors. Use `getDynamicIcon()` only in `.map()` callbacks inside dropdown items.

```tsx
import { DynamicIcon } from '@/lib/dynamic-icons';

// In trigger buttons — use the component:
<DynamicIcon
  name={item.icon}
  fallback={Circle}
  className='h-3 w-3'
  style={{ color: item.color || '#94a3b8' }}
/>;

// In .map() dropdown items — getDynamicIcon is fine:
import { getDynamicIcon } from '@/lib/dynamic-icons';
const Icon = item.icon ? getDynamicIcon(item.icon) || Circle : Circle;
<Icon className='mr-2 h-3 w-3' style={{ color: item.color || '#94a3b8' }} />;
```

Default fallback colour: `#94a3b8` (slate-400).

## Creation Dialog Pattern

Dialogs are dense, command-palette-style forms. See `src/components/issues/create-issue-dialog.tsx`.

```tsx
<Dialog open onOpenChange={open => !open && onClose()}>
  <DialogHeader className='sr-only'>
    <DialogTitle>Create item</DialogTitle>
  </DialogHeader>
  <DialogContent showCloseButton={false} className='gap-2 p-2 sm:max-w-2xl'>
    {/* Row of inline selectors */}
    <div className='flex items-center justify-between'>
      <div className='flex flex-wrap gap-2'>
        <TeamSelector displayMode='iconWhenUnselected' ... />
        <AssigneeSelector displayMode='iconWhenUnselected' ... />
      </div>
      <div className='ml-auto flex items-center gap-2'>
        <StateSelector displayMode='iconWhenUnselected' ... />
        <PrioritySelector displayMode='iconWhenUnselected' ... />
      </div>
    </div>

    {/* Form fields */}
    <div className='space-y-2'>
      {/* Input with overlay label */}
      <div className='relative'>
        <Input className='pr-20' ... />
        <span className='text-muted-foreground bg-background pointer-events-none
          absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
          Name
        </span>
      </div>
      <Textarea className='min-h-[120px] resize-none' ... />
    </div>

    {/* Actions */}
    <div className='flex w-full flex-row items-center justify-between gap-2'>
      <Button variant='ghost' size='sm' onClick={onClose}>Cancel</Button>
      <Button size='sm' disabled={!valid || isLoading}>
        {isLoading ? 'Creating...' : 'Create'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### Key Preview (auto-generated)

```tsx
<code className='bg-muted flex h-8 items-center overflow-hidden rounded-md px-2.5 font-mono text-sm'>
  {prefix}-{sequenceNumber}
</code>
```

## Table Row Pattern

```tsx
<motion.div
  layout
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 8 }}
  transition={{ duration: 0.2 }}
  className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors'
>
  {/* 1. Priority selector (flex-shrink-0) */}
  {/* 2. Key: font-mono text-xs text-muted-foreground */}
  {/* 3. State indicator */}
  {/* 4. Title: min-w-0 flex-1 truncate, Link */}
  {/* 5. Team selector (iconWhenUnselected) */}
  {/* 6. Project selector (iconWhenUnselected) */}
  {/* 7. Date: text-muted-foreground text-xs */}
  {/* 8. Assignee avatars: overlapping -ml-2 */}
  {/* 9. Actions: MoreHorizontal dropdown */}
</motion.div>
```

Wrap the list in `<AnimatePresence initial={false}>`.

### Assignee Avatar Stack

```tsx
<div className='flex -space-x-2'>
  {assignees.slice(0, 3).map(a => (
    <Avatar key={a.userId} className='ring-background size-6 ring-2'>
      <AvatarFallback className='text-xs'>{initials}</AvatarFallback>
    </Avatar>
  ))}
  {assignees.length > 3 && (
    <div className='bg-muted text-muted-foreground ring-background flex size-6 items-center justify-center rounded-full text-xs ring-2'>
      +{assignees.length - 3}
    </div>
  )}
</div>
```

### Actions Dropdown (row-level)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
      <MoreHorizontal className='size-4' />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align='end'>
    <DropdownMenuItem variant='destructive' onClick={handleDelete}>
      <Trash2 className='size-4' /> Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Colours & Typography

- **Muted text:** `text-muted-foreground`
- **Muted background:** `bg-muted/30` (very light), `bg-muted/50` (hover)
- **Default icon/dot colour:** `#94a3b8`
- **Accent highlight:** `bg-accent/30` for current-user related rows
- **Monospace keys:** `font-mono text-xs text-muted-foreground`
- **Section headings in content:** `text-sm font-semibold`
- **Tab count badge:** `<span className='text-muted-foreground text-xs'>{count}</span>`

## Making UI Feel Instant (Optimistic + Dense Patterns)

The "quick and dense" feel comes from three pillars working together:

### 1. Optimistic Updates on Every Micro-Interaction

Every dropdown/selector that mutates Convex uses `useOptimisticValue` so the UI updates the instant the user clicks — before the server round-trip. See [optimistic.md](./optimistic.md) for the full pattern.

```tsx
const [displayValue, setOptimistic] = useOptimisticValue(serverValue);

// On select: optimistic FIRST, mutation SECOND
setOptimistic(newId); // UI updates instantly
onSelect(newId); // fires Convex mutation
setOpen(false); // close popover
```

The hook auto-clears when the Convex subscription delivers the real value. A 5s safety timeout handles failed mutations.

### 2. Inline Everything — No Page Transitions

Properties are never changed via separate pages or modals. Every field (status, priority, team, assignee, visibility) has an inline Popover+Command selector that opens in-place. This means:

- No navigation = no loading states for property changes
- The user stays in context (table row, detail header, dialog)
- Multiple properties can be changed in rapid succession

### 3. Animation That Reinforces Speed

- `motion.div` with `layout` on list items = smooth reorder when properties change
- `AnimatePresence` for add/remove = items slide in/out instead of popping
- Short durations: `transition={{ duration: 0.2 }}` — fast enough to feel instant, slow enough to be visible
- No spinners or loading indicators for mutations — the optimistic value IS the feedback

### Anti-patterns to Avoid

- **Never show a spinner** when changing a property inline. Use optimistic state.
- **Never navigate** to change a single field. Open a popover in-place.
- **Never block** the UI waiting for a mutation response. Fire-and-forget with optimistic overlay.
- **Never use toast notifications** for successful property changes. The inline update is the confirmation.

## Loading States

- **Page-level:** Use `PageSkeleton` from `@/components/ui/table-skeleton` for table pages.
- **Custom layouts:** Use `Skeleton` from `@/components/ui/skeleton` matching the loaded content shape.
- **Never use "Loading..." text.** Always use animated skeletons that match the expected layout.

## Permission Wrapping

```tsx
// For selectors — disables interaction when denied
<PermissionAwareSelector orgSlug={orgSlug} permission={PERMISSIONS.ISSUE_EDIT}
  fallbackMessage="You don't have permission">
  <PrioritySelector ... />
</PermissionAwareSelector>

// For editable content blocks
<PermissionAwareWrapper orgSlug={orgSlug} permission={PERMISSIONS.ISSUE_EDIT}>
  <EditableTitle ... />
</PermissionAwareWrapper>
```

## File Reference

| Pattern               | Canonical file                                      |
| --------------------- | --------------------------------------------------- |
| Issue selectors       | `src/components/issues/issue-selectors.tsx`         |
| Team selector         | `src/components/teams/team-selector.tsx`            |
| Project selectors     | `src/components/projects/project-selectors.tsx`     |
| Project lead selector | `src/components/projects/project-lead-selector.tsx` |
| Visibility selector   | `src/components/ui/visibility-selector.tsx`         |
| Creation dialog       | `src/components/issues/create-issue-dialog.tsx`     |
| Issues table          | `src/components/issues/issues-table.tsx`            |
| Projects table        | `src/components/projects/projects-table.tsx`        |
| Page skeleton         | `src/components/ui/table-skeleton.tsx`              |
| Optimistic hook       | `src/hooks/use-optimistic.ts`                       |
| Dynamic icons         | `src/lib/dynamic-icons.tsx`                         |
| Permission components | `src/components/ui/permission-aware.tsx`            |
