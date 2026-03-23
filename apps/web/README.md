# Web - Next.js App Router (Phase 5)

## Implemented UI Areas

- Authentication and protected workspace shell
- Dashboard with operational + business cards
- Clients, contacts, devices, alerts, tickets, scripts, automations
- Knowledge base list + detail editor (markdown)
- Contracts management
- Billing (invoices, subscriptions, monthly summary)
- Reports with CSV export buttons
- Audit logs page
- Patch management workflow page
- Remote access sessions page
- Integrations page (webhook + SMTP tests)
- Settings page
- API keys management page
- Customer portal:
  - `/portal/sign-in`
  - `/portal/tickets`
  - `/portal/tickets/[ticketId]`

## Main Internal Routes

- `/sign-in`
- `/dashboard`
- `/clients`
- `/devices`
- `/alerts`
- `/alerts/rules`
- `/tickets`
- `/scripts`
- `/scripts/executions`
- `/automations`
- `/knowledge-base`
- `/knowledge-base/[articleId]`
- `/contracts`
- `/billing`
- `/reports`
- `/audit`
- `/patch-management`
- `/remote-access`
- `/integrations`
- `/settings`
- `/api-keys`

## Customer Portal Routes

- `/portal/sign-in`
- `/portal/tickets`
- `/portal/tickets/[ticketId]`

## UX Polish Included

- breadcrumb navigation in topbar
- toast notifications for key actions
- loading/empty/error states on major pages
- dark/light theme support across pages

## Run Local

```powershell
Copy-Item .env.local.example .env.local -Force
npm install
npm run dev
```

By default the browser calls `/backend-api`, and Next.js proxies that path to the backend target defined by `API_PROXY_TARGET`.

## Run Test On Alternate Port

```powershell
npm run build
npm run start:3002
```

## Build

```powershell
npm run build
```

## Verify UI

1. Login internal app with `owner@acme.local / ChangeMe@123`.
2. Validate knowledge base, contracts, billing and reports pages.
3. Export CSV in reports page.
4. Validate audit logs, patch management, remote access.
5. Validate integrations/settings/api keys pages.
6. Open customer portal sign-in and login with `portal@acme.local / ChangeMe@123`.
7. Create and follow up a portal ticket in `/portal/tickets`.

## Remote Access Safety

- The embedded Easyli Windows agent streams the real Windows desktop.
- Every remote session starts in `view-only`. The session console can switch to `shared-control` or `remote-only` after the operator decides to unlock interaction.
- `remote-only` asks the Windows bridge to lock the assisted workstation keyboard and mouse until the mode changes or the session ends.
- Set `EASYLI_DISABLE_LOCAL_INPUT_CONTROL=true` only on machines where Easyli must never unlock pointer/keyboard control.
- Do not run the Windows agent inside the same workstation where you are actively using VS Code unless that workstation is the intended assisted device.

## Required Env

- `NEXT_PUBLIC_API_URL` (default `/backend-api`)
- `API_PROXY_TARGET` (default `http://127.0.0.1:3001/api/v1`)
- `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`)
