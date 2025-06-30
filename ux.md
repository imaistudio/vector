# AIKP — UX & Design Guidelines

> This document defines the **look-and-feel contract** for every user-facing screen in AIKP. Treat it as the _single source of truth_ for product & engineering when making layout, styling or motion decisions.

---

## 1. Navigation Philosophy — **Dense, Linear-Inspired Design**

1. AIKP adopts a **dense, efficient navigation model** inspired by Linear.app's design principles:
   • Navigation items are **compact** with minimal padding (`py-1.5 px-3` max)
   • **No descriptive text** in primary navigation - rely on clear labels and icons only
   • Support **4–5 top-level destinations** maximum with clean visual hierarchy
2. On desktop screens (>1024 px)
   • Sidebar navigation is **dense** with items tightly spaced (`space-y-1`)
   • Text size standardized to `text-sm` for navigation items
   • **Single-line items only** - no multi-line descriptions in nav
3. Organization switcher is **minimal** - avatar + name only, no extra descriptive text
4. When deeper navigation stacks are required (e.g. `/projects/[id]`) we surface a **contextual header** _inside the page_ instead of relying on a global top bar.

---

## 2. Component System — **100 % Shadcn UI + Dense Variants**

1. All UI primitives are sourced from **[shadcn/ui](https://ui.shadcn.com)**. Where a needed component doesn't exist, scaffold it via the shadcn CLI so that it inherits the same tokens, variants & accessibility patterns.
2. Do **not** import external component libraries (_Radix, Headless UI, MUI, …_) directly. Wrap / adapt via shadcn if absolutely necessary.
3. **Dense styling rules**
   • Navigation: `py-1.5 px-3` max, `text-sm`, `space-y-1` between items
   • Forms: Prefer `h-9` inputs over `h-11` for density
   • Buttons: Use `size="sm"` variant as default (`h-9`)
   • Cards: Reduce padding to `p-4` instead of `p-6`
   • Compose variants with `class-variance-authority`.  
   • Merge class names via `tailwind-merge` to avoid duplicates.  
   • **Never hard-code hex values**; colours must reference **Tailwind theme tokens** only (see §3).

---

## 3. Colour System — **Tailwind Theme Tokens Only**

1. Use the palette exported by the shadcn Tailwind config (e.g. `primary`, `secondary`, `muted`, `destructive`).
2. Semantic mapping:
   • Success → `primary`
   • Warning → `yellow`
   • Error → `destructive`
3. Support dark mode automatically using `data-theme="dark"`  
   • Don't maintain separate colour files; rely on Tailwind's `dark:` variant.

---

## 4. Layout, Spacing & Sizing — **Dense by Default**

1. Base unit: **4 px grid** — prefer **4 px multiples** for dense layouts (`space-y-1`, `gap-1`, `space-y-2`, `gap-2`).
2. Forms & Cards follow dense patterns:  
   • Form container max-width `max-w-sm`.  
   • Spacing `space-y-4` between controls (reduced from `space-y-6`).  
   • Inputs height `h-9`, Buttons `h-9`.
   • Card padding `p-4` (reduced from `p-6`)
3. Surfaces use **glass-morphism**: `bg-white/80 dark:bg-slate-900/80` + `backdrop-blur-sm`.
4. **Navigation density**:
   • Items: `py-1.5 px-3` max
   • Spacing: `space-y-1` between nav items
   • Text: `text-sm` for all navigation text
   • Icons: `size-4` (16px) for nav icons

---

## 5. Typography — **Consistent & Dense**

1. Font scale (Tailwind defaults): `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`.
2. **Navigation text** → `text-sm`; **Body text** → `text-sm` (reduced from `text-base`); **Muted copy** → `text-xs text-slate-600 dark:text-slate-400`.
3. `font-medium` for navigation items, `font-semibold` for card titles.
4. **Dense typography rules**:
   • Primary content: `text-sm` as default
   • Secondary content: `text-xs`  
   • Headers: `text-base` or `text-lg` max
   • Avoid `text-base` for dense interfaces

---

## 6. Motion & Micro-Interactions — **Linear-Inspired**

1. **Speed matters** — Keep animation durations between **120 ms – 200 ms**; use `ease-[cubic-bezier(0.16,1,0.3,1)]`.
2. **Enter / Exit**  
   • Fade & slide 2 px (`translate-y-0.5`) for menus & dialogs (reduced movement).  
   • Tab switches animate underline position (`transition-[left]`).
3. **Progress feedback**  
   • Operations <400 ms → no spinner.  
   • >400 ms → show a top-edge **Linear-style progress bar** (`h-0.5`, `animate-[progress]`).
4. **Tactile interactions**  
   • Buttons use subtle active state (`scale-[0.98]`).  
   • List-item hover: subtle background tint `bg-muted/30` (reduced opacity).

---

## 7. Accessibility Checklist

1. All components pass **WCAG 2.1 AA** contrast.
2. Use **aria-labels** on icon-only buttons.
3. Ensure **tab-order** mirrors visual order; navigation items are `tabindex="0"` by default.
4. **Dense design considerations**: Ensure touch targets remain minimum 44px on mobile despite dense desktop design.

---

## 8. Design Tokens Reference

```ts
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground", // Added for nav items
      },
      size: {
        default: "h-9 px-4 py-2", // Reduced from h-11
        sm: "h-8 rounded-md px-3", // Reduced from h-9
        lg: "h-10 rounded-md px-8", // Reduced from h-11
        icon: "h-9 w-9", // Reduced from h-10 w-10
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Navigation-specific variant for dense sidebar
export const navItemVariants = cva(
  "flex items-center gap-2 rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        active: "bg-accent text-accent-foreground",
      },
      size: {
        default: "py-1.5 px-3", // Dense padding
        compact: "py-1 px-2", // Ultra-dense for secondary nav
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

---

## 9. Dense Navigation Patterns

### Sidebar Navigation

- **Item height**: `py-1.5` (24px total height)
- **Icon size**: `size-4` (16px)
- **Text size**: `text-sm`
- **Spacing**: `space-y-1` between items
- **Padding**: `px-3` horizontal, `py-1.5` vertical
- **No descriptions**: Icons + labels only

### Organization Switcher

- **Avatar size**: `size-6` (24px)
- **Text**: Single line, `text-sm`, truncated if needed
- **Padding**: `p-2` inside dropdown items
- **No extra metadata**: Name only, no descriptions

The snippet above is canonical for creating new dense, navigation-focused components that match Linear's efficient design language.

_Any proposal diverging from these guidelines requires approval from the **Design Lead**._

---

## 10. Standard Design Patterns — **Issue-Based Design System**

### View Page Layout Pattern

Based on the **Issues Page** (`src/app/[orgId]/(main)/issues/page.tsx`), all entity list view pages should follow this structure:

```tsx
export default function EntityPage() {
  // 1. Client component with hooks
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);

  // 2. Data fetching with proper invalidation
  const { data: paged, isLoading } = trpc.organization.listEntityPaged.useQuery(
    {
      orgSlug,
      page,
      pageSize: PAGE_SIZE,
    },
  );

  // 3. Mutation handlers with targeted invalidation
  const deleteMutation = trpc.entity.delete.useMutation({
    onSuccess: () => {
      Promise.all([
        utils.organization.listEntity.invalidate({ orgSlug }),
        utils.organization.listEntityPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  return (
    <div className="bg-background h-full">
      {/* Header with tabs */}
      <div className="border-b">
        <div className="flex items-center justify-between p-1">
          <div className="flex items-center gap-1">
            {/* Filter tabs with counts */}
            {visibleTabs.map((tab) => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 gap-2 rounded-xs px-3 text-xs font-normal",
                  activeFilter === tab.key && "bg-secondary",
                )}
              >
                <span>{tab.label}</span>
                <span className="text-muted-foreground text-xs">
                  {tab.count}
                </span>
              </Button>
            ))}
          </div>
          {/* Create button aligned right */}
          <CreateEntityDialog className="h-6" orgSlug={orgSlug} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <EntityTable
          orgSlug={orgSlug}
          entities={filteredEntities}
          // ... other props
        />
      </div>

      {/* Pagination footer */}
      <div className="text-muted-foreground flex justify-between border-t p-2 text-xs">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1}>
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * PAGE_SIZE >= total}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Key Principles:**

- **Full height layout**: `h-full` container with proper flex layout
- **Compact header**: `p-1` padding, `h-6` buttons, `text-xs` typography
- **Filter tabs with counts**: Secondary variant for active, ghost for inactive
- **Right-aligned create button**: Consistent placement and sizing
- **Bordered sections**: Top border for header, bottom border for pagination
- **Dense pagination**: Small buttons with minimal spacing

### Table Design Pattern

Based on **IssuesTable** (`src/components/issues/issues-table.tsx`), entity tables should follow:

```tsx
export function EntityTable({ entities, ...handlers }: EntityTableProps) {
  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">[ICON]</div>
          <h3 className="mb-2 text-lg font-semibold">No [entities] found</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first [entity].
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      <AnimatePresence initial={false}>
        {entities.map((entity) => (
          <motion.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            key={entity.id}
            className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors"
          >
            {/* Entity-specific content with consistent spacing */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/${orgSlug}/[entities]/${entity.key}`}
                className="hover:text-primary block truncate text-sm font-medium transition-colors"
              >
                {entity.title || entity.name}
              </Link>
            </div>

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              {/* ... menu content */}
            </DropdownMenu>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

**Key Principles:**

- **Divide-y layout**: No table headers, use divider lines between rows
- **Framer Motion**: Animate presence with subtle y-axis movement
- **Hover states**: `hover:bg-muted/50` for interactive feedback
- **Flex layout**: `gap-3 px-3 py-2` for consistent internal spacing
- **Truncation**: `min-w-0 flex-1` for main content, `truncate` for overflow
- **Action buttons**: `h-6 w-6 p-0` for compact dropdown triggers
- **Empty states**: Centered with emoji, title, description, and action prompting

### Dialog Design Pattern

Based on **CreateIssueDialog** (`src/components/issues/create-issue-dialog.tsx`), dialogs should follow:

```tsx
function CreateEntityDialogContent({ orgSlug, onClose, onSuccess }) {
  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className="gap-2 p-2 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <div className="text-muted-foreground flex w-full items-center gap-2 text-sm">
              {/* Properties Row - horizontal selector layout */}
              <div className="flex flex-wrap gap-2">
                <EntitySelector1 />
                <EntitySelector2 />
                <EntitySelector3 />
              </div>
              {/* Right-aligned metadata/preview */}
              <div className="ml-auto">
                <PreviewComponent />
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Main content fields */}
          <Input
            placeholder="Entity title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base"
            autoFocus
          />

          <Textarea
            placeholder="Add description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px]"
          />
        </form>

        {/* Footer actions */}
        <div className="flex w-full flex-row items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!title.trim() || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Creating…" : "Create [entity]"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Key Principles:**

- **Compact padding**: `gap-2 p-2` for dense dialog layout
- **Header as properties bar**: Selectors in header, not form body
- **No close button**: `showCloseButton={false}` for cleaner look
- **Flex wrap selectors**: Horizontal layout with responsive wrapping
- **Right-aligned metadata**: Preview or format info in header
- **Minimal form spacing**: `space-y-2` between form elements
- **Balanced footer**: Cancel left, primary action right with loading states

### Individual Entity View Page Pattern

Based on entity detail pages, individual view pages should follow:

```tsx
export default async function EntityViewPage({ params }) {
  const { orgId, entityKey } = await params;

  const entity = await findEntityByKey(orgId, entityKey);

  if (!entity) {
    notFound();
  }

  return (
    <div className="bg-background h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{entity.name}</h1>
            <p className="text-muted-foreground text-sm">{entity.key}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status badges, action buttons */}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">{/* Entity-specific content */}</div>
    </div>
  );
}
```

**Key Principles:**

- **Full height**: `h-full` with proper flex layout
- **Bordered header**: Clean separation with `border-b`
- **Truncated titles**: Handle long names gracefully
- **Consistent padding**: `p-4` for comfortable spacing
- **Header actions**: Right-aligned status and controls

_These patterns ensure consistency across all entity types while maintaining the dense, efficient design language established by the issues pages._

---

## 11. Dense Interface Typography Scale

```ts
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground", // Added for nav items
      },
      size: {
        default: "h-9 px-4 py-2", // Reduced from h-11
        sm: "h-8 rounded-md px-3", // Reduced from h-9
        lg: "h-10 rounded-md px-8", // Reduced from h-11
        icon: "h-9 w-9", // Reduced from h-10 w-10
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Navigation-specific variant for dense sidebar
export const navItemVariants = cva(
  "flex items-center gap-2 rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        active: "bg-accent text-accent-foreground",
      },
      size: {
        default: "py-1.5 px-3", // Dense padding
        compact: "py-1 px-2", // Ultra-dense for secondary nav
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```
