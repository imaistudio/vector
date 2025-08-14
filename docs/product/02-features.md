# Key Features

## Authentication & User Management

- Google OAuth (organisation-scoped)
- Post-signup flow to link Discord
- Role assignment (Member, Lead, Admin) through the Admin UI

## Project & Hierarchy Management

- Admin UI to create/manage Teams & Projects
- Define hierarchy: assign Leads per project
- Each Project record stores members list + Lead

## Real-time Notifications

- Discord bot relays comment/issue events to project channels
- Web-UI toast & inbox for mentions / assignments

## On-boarding & Organisation Switching

1.  **New signup → create organisation**
    1.  User signs up ➜ redirected to **organisation setup** wizard.
    2.  Wizard collects _org name_, _slug_ (+ optional logo).
    3.  Upon completion the user becomes **admin** of the new org (`member.role = "admin"`).
    4.  Default project settings are seeded; user lands on **Dashboard**.

2.  **Invite to existing org → new platform user**
    1.  User receives invitation email, clicks link.
    2.  Completes minimal signup (password, name).
    3.  Invitation is accepted ⇒ they become **member** of the inviting org.
    4.  No personal organisation is created.

3.  **Invite to existing org → existing platform user**
    1.  Logged-in user clicks invite link.
    2.  Invitation accepted; new `member` row is created in that org.
    3.  UI switches active organisation to the newly joined one.
    4.  User can toggle between organisations via org-switcher (uses Better-Auth `organization.setActive`).

## Future Enhancements

- Support for additional communication channels (Slack, Teams).
- Analytics dashboard for notification / activity metrics.
- Customizable response templates per project.
