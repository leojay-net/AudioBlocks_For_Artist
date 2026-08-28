# Role-Based Access Control (RBAC)

Members of an artist workspace can have one of three roles, defined in
`src/types/role.ts` and made available app-wide through `RoleContext`
(`src/context/RoleContext.tsx`) and the `useRole()` hook
(`src/hooks/useRole.ts`).

> This is currently a front-end-only permission model driving what the UI
> shows/enables — there is no corresponding backend enforcement in this
> repo. Treat `can()`/`cannot()` as UX guidance, not a security boundary.

## Roles

| Role      | Description                                                                 |
| --------- | ----------------------------------------------------------------------------- |
| `owner`   | Full access; only role that can change billing/settings and manage roles.   |
| `manager` | Can create/edit/delete content (songs, merch, events); cannot manage the workspace or its settings/roles. |
| `viewer`  | Read-only; cannot create, edit, or delete content, nor change settings.     |

## Permissions

Permissions are static booleans looked up per role (`ROLE_PERMISSION_TABLE`
in `src/types/role.ts`) — deliberately simple so the UI can check them in
O(1) without enumerating actions:

| Permission          | `owner` | `manager` | `viewer` |
| -------------------- | :-----: | :-------: | :------: |
| `content:create`    |   ✅    |    ✅     |    ❌    |
| `content:edit`      |   ✅    |    ✅     |    ❌    |
| `content:delete`    |   ✅    |    ✅     |    ❌    |
| `settings:read`     |   ✅    |    ✅     |    ✅    |
| `settings:edit`     |   ✅    |    ❌     |    ❌    |
| `workspace:manage`  |   ✅    |    ❌     |    ❌    |
| `roles:manage`      |   ✅    |    ❌     |    ❌    |

Each role also has display metadata in `ROLE_INFO` (label + tagline shown
next to the role badge) and a Tailwind class string in `ROLE_BADGE_STYLES`
(used for the pink/purple/gray role chip rendered in `TopHeader.tsx` and the
profile page).

## Using it in a component

```tsx
import { useRole } from "@/hooks/useRole";

function DeleteMerchButton() {
  const { can } = useRole();
  if (!can("content:delete")) return null;
  return <button onClick={handleDelete}>Delete</button>;
}
```

`useRole()` reads from `RoleContext` and returns:

- `role` — the current `Role`.
- `info` — that role's `ROLE_INFO` entry (label + description).
- `permissions` — the role's full permission array.
- `can(permission)` / `cannot(permission)` — boolean checks against
  `permissions`.
- `setRole(role)` — switches the active role. Intended for demo UIs and
  tests, not a real permission grant flow (in production the role would be
  derived from the authenticated session, not set client-side).

**No-provider fallback:** if `useRole()` is called without a `RoleProvider`
mounted above it, it returns a safe default of `role: "viewer"` with
`can()` always `false` — this fails closed rather than open, so an
untested/legacy code path can't accidentally grant elevated access just
because the provider wasn't wired up.

Real usage in this codebase:

- `MerchesContent.tsx` — gates create/edit/delete controls behind
  `can("content:create")` / `can("content:edit")` / `can("content:delete")`.
- `TopHeader.tsx` — renders the role badge via `ROLE_BADGE_STYLES[role]`.
- `app/dashboard/profile/page.tsx` — gates the Settings tab's editable
  fields behind `can("settings:edit")`, and shows
  `getSettingsRestrictionReason(role)` as a tooltip explaining *why* a
  disabled control is disabled for non-owners.

## Testing with RBAC

Any component test that renders something gated by `useRole()` needs a
`RoleProvider` in the tree, or it'll see the no-provider `viewer` fallback.
Follow the pattern in `src/__tests__/TopHeader.test.tsx`: a small
`renderTopHeader()` helper that wraps the component in
`<RoleProvider initialRole={role}>` (plus `QueryClientProvider`, if the
component also needs React Query) so tests can render the same component
once per role under test.

## Extending: adding a new role or permission

**New permission** (most common case):

1. Add the string literal to the `Permission` union in `src/types/role.ts`.
2. Add it to whichever roles' arrays in `ROLE_PERMISSION_TABLE` should have
   it.
3. Gate the relevant UI with `can("your:new-permission")`.
4. Update the table above.

**New role:**

1. Add it to the `Role` union and the `ROLES` array in `src/types/role.ts`.
2. Add an entry to `ROLE_PERMISSION_TABLE` listing its permissions.
3. Add display metadata to `ROLE_INFO` and a badge style to
   `ROLE_BADGE_STYLES`.
4. If the new role needs a distinct settings-restriction message, add a
   `case` to `getSettingsRestrictionReason()`.
5. Update the tables above and add a `RoleProvider` test case for it,
   mirroring the existing owner/manager/viewer cases.
