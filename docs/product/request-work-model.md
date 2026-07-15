# Request and Work Model

Status: Living product specification. Implementation authorized and in progress on 2026-07-15.

This document records the product model and interaction ideas discussed for evolving Vector beyond a flat issue tracker. It intentionally describes product meaning and behavior rather than database tables, APIs, migrations, pull requests, or implementation sequencing.

This document remains the source of truth for product meaning while implementation proceeds. Decisions made during implementation are recorded here so schema, UI, CLI, agent, GitHub, and notification behavior do not drift apart.

## 1. Why This Change Is Needed

Vector is currently organized around issues. That model becomes difficult when people use AI agents to execute larger amounts of work in parallel:

- One incoming request may be a tiny change, a large outcome, or something whose scope is initially unknown.
- A single meaningful outcome may contain many notes, checklist steps, individually assigned tasks, agent runs, pull requests, and handoffs.
- Several related requests may be satisfied by the same body of work.
- One request may need to produce several separate bodies of work.
- Users may oversee several humans and agents working simultaneously.
- Small, frequently updated issues create noise and can visually bury important work.
- Assignment does not mean that somebody has intentionally begun execution.
- Replacing an assignee loses the important story of who owned the work during each period and what they accomplished before handing it off.
- A merged pull request is useful progress evidence, but it does not always mean that the requester received the intended result.

The product should distinguish intake, execution, decomposition, live activity, ownership, and review instead of representing all of them as undifferentiated issues.

## 2. Product Vocabulary

### 2.1 Request

A Request is an incoming ask. It captures what somebody wants and provides a routing and review envelope around that ask.

A Request is not automatically active execution. Being assigned a Request or choosing to take responsibility for it does not mean work has started.

A Request answers questions such as:

- Who requested this?
- What result do they want?
- What context did they provide?
- Which person, people, or team should respond?
- Has somebody taken responsibility for routing or fulfilling it?
- Does it belong to existing Work?
- Should it create one new Work record, several Work records, or no Work?
- Is the requested result ready for the requester to review?
- Did the requester accept the result?

### 2.2 Work

Work is the main execution object and the primary product noun. The UI should use natural phrases such as:

- My work
- New work
- Start work
- Active work
- Work owner
- Attach to work
- Create work from request

Where possible, the UI should avoid repeatedly saying “work item.” “Work” should be sufficient.

Work represents a meaningful outcome that somebody is accountable for delivering. It may begin with unknown scope. It can contain notes, checklists, Tasks, human contributions, agent executions, development artifacts, handoffs, and review context.

Work is not necessarily created immediately when a Request is assigned. A recipient can first understand and route the Request, then deliberately create or attach Work.

### 2.3 Task

A Task is an independently trackable unit inside Work.

A Task is appropriate when a step needs one or more of the following:

- An individual assignee
- Its own execution state
- A clear handoff
- A blocker or dependency
- Independent agent execution
- Discussion or progress updates
- A due date or scheduling signal
- A direct development association

Tasks should be quick to create and edit inline from the Work surface. Tasks should not overwhelm the top-level Work views.

### 2.4 Checklist item

A checklist item is an informal step inside the Work workpad. It is lighter than a Task.

Checklist items are suitable for small steps that do not need independent ownership, notifications, lifecycle, discussion, or development tracking. They should be live-toggleable directly in the workpad.

A checklist item may later be promoted to a Task if it grows or needs independent tracking.

### 2.5 Project

A Project remains broader than Work. It groups multiple related outcomes over a longer period or initiative.

The intended hierarchy is:

```text
Project
└── Work
    ├── Linked Requests
    ├── Workpad notes and checklist items
    ├── Tasks
    ├── Human and agent executions
    ├── Development artifacts
    └── Activity, review, and handoffs
```

### 2.6 Agent execution

An agent execution is one agent or local coding session working in the context of Work or a specific Task.

Agent execution state must remain distinct from Work state and Task state. One paused agent must not pause all Work when other people or agents are still active.

## 3. Core Relationship Model

Requests and Work have a many-to-many relationship.

### 3.1 One Request can produce multiple Work records

A broad Request may need to be split into several independently owned outcomes.

Example:

```text
Request: Improve the reliability of desktop updates

Work A: Preserve the previous executable during updates
Work B: Add understandable recovery messaging
Work C: Build Windows interruption test coverage
```

### 3.2 Multiple Requests can attach to one Work record

Several requests may describe the same underlying need or may be efficiently handled together.

Example:

```text
Work: Redesign desktop update recovery

Linked Request A: Show download progress
Linked Request B: Recover after interrupted updates
Linked Request C: Explain retry failures clearly
```

This is especially important when a human uses agents to handle several related requests within the same focused body of work.

### 3.3 Manual attachment must always exist

AI may suggest existing Work that appears relevant, but AI cannot be a required dependency for routing.

Users must always be able to:

- Search for existing Work manually.
- Attach a Request to existing Work.
- Create new Work from a Request.
- Split a Request into multiple Work records.
- Remove or correct an incorrect association, subject to permissions.

If AI is unavailable, unconfigured, or wrong, the complete manual flow must continue to work.

## 4. Request Capture

The Request creation experience should help people describe the result they want without requiring them to understand the implementation.

### 4.1 Request content

A Request should capture:

- A concise title.
- Context or problem description.
- Expected output or expected result.
- Optional supporting review guidance.
- Desired timing or urgency.
- Suggested recipient, recipients, or team.
- Supporting links, attachments, screenshots, or related entities.
- Requester identity and source.

### 4.2 Expected output

The requester should be guided to define what outcome they expect.

Expected output is not necessarily a technical specification. It should describe what should be true for the requester when the work is delivered.

Example:

```text
Context
Customers cannot tell whether desktop updates are still progressing.

Expected output
Users can understand update progress and recover cleanly after an interrupted update.
```

The product should use approachable language. “Expected result” or “Expected output” is preferred over formal terms such as “acceptance criteria.”

### 4.3 Review guidance

The requester may optionally add free-form guidance describing what they care about during review. This should not become a rigid, universally required checklist.

The requester must review the delivered result during the review phase regardless of whether they supplied detailed review guidance in advance.

## 5. Request Routing and Responsibility

A Request may be routed to:

- One person
- Multiple people
- A team

Routing identifies who should respond to the Request. It does not start execution.

### 5.1 Direct routing to a person

The common case is that a Request goes directly to a specific person. That person can inspect it, take responsibility, and determine whether it belongs to existing Work or needs new Work.

### 5.2 Routing to multiple people

Multiple people may initially receive or share responsibility for a Request. The product should still make it clear who is currently expected to make the routing or execution decision.

The precise distinction between recipient, accountable request owner, and watcher remains to be defined.

### 5.3 Routing to a team

A team-routed Request enters a team intake surface. A team member can take it, assign a responsible person, attach it to existing Work, or create new Work.

Future routing rules may suggest or select people based on team, request source, repository, labels, workload, or other context. Deterministic manual routing must remain available.

## 6. From Request to Work

Assignment or acceptance of a Request must not automatically start Work.

The recipient should have an intentional planning/conversion moment where they can:

- Attach the Request to existing Work.
- Create one new Work record.
- Create several Work records.
- Ask for more context.
- Route the Request elsewhere.
- Identify it as a duplicate.
- Decline it when appropriate.

Creating or attaching Work means the delivery structure has been chosen. It does not necessarily mean somebody has begun executing it.

## 7. Intentional Start of Work

Starting Work must be an explicit action.

The core interaction should communicate:

> I am starting this work now.

Receiving, claiming, accepting, or being assigned a Request must not trigger this automatically.

### 7.1 Start work action

When a user selects Start work, Vector should conceptually:

- Record who intentionally started.
- Record the start time.
- Move the Work into an active/in-progress state when appropriate.
- Establish or confirm the current accountable owner.
- Create an execution or focus record for that person.
- Bring the Work into the user’s active/focused view.
- Open the focused Work surface.
- Show current Tasks, blockers, requests, notes, agent runs, and development context.

Starting Work should not require launching an agent. A human may work manually, attach an existing agent session, or launch one or more agents afterward.

### 7.2 Multiple active Work records

A person may have multiple Work records active at the same time.

This is necessary because users may supervise several agent executions, wait on external input, switch between different responsibilities, or coordinate parallel work.

Vector should not impose a global single-active-Work restriction.

The UI still needs to distinguish:

- Work that is active generally.
- Work receiving live activity now.
- Work waiting on a human.
- Work blocked or paused at the Task/execution level.

## 8. Focused Work Experience

The Work surface should help a person lock into one body of work while preserving access to its full history and relationships.

The focused surface should prioritize:

### 8.1 Outcome and responsibility

- Work title and intended outcome
- Current accountable owner
- Contributors
- Status, priority, effort, and due timing
- Linked Requests and their expected outputs

### 8.2 Current focus

- Next actionable Tasks
- Work currently being performed
- Active agents and humans
- Blockers
- Items waiting for review or input
- Explicit human-attention requests

### 8.3 Workpad

- Notes
- Decisions
- Headings and structured writing
- Live checklist items
- Links and references
- Implementation discoveries
- Context added during execution

### 8.4 Tracked Tasks

- Inline creation
- Individual assignment
- Clear Task state
- Agent attribution where applicable
- Blockers and dependencies
- Handoffs
- Minimal progress metadata

### 8.5 Development

- Pull requests
- Commits
- Checks and review states
- Deployment or release signals where available

### 8.6 History

- Human ownership periods
- Handoffs
- Agent execution summaries
- Meaningful changes
- Request associations
- Review outcomes

The surface should remain dense, inline, and operational. It should not become a collection of oversized dashboard cards or separate edit pages.

## 9. Work Ownership

Work should have one current accountable human owner.

Other people and agents may contribute simultaneously, but the owner remains responsible for the overall outcome, coordination, and delivery state.

Ownership must be historical rather than represented only by overwriting the current assignee.

An ownership period should conceptually preserve:

- Owner
- Start time
- End time
- How ownership began
- How ownership ended
- Related handoff
- Summary of progress during that period

## 10. Handoffs

A handoff is a first-class transition, not a silent assignee replacement.

### 10.1 Pending handoff

The current owner proposes a handoff to another person. The previous owner remains accountable until the recipient accepts.

The UI should clearly show:

- Current owner
- Intended next owner
- Pending handoff status
- When the handoff was proposed
- Whether the recipient has seen or accepted it

### 10.2 Handoff context

A handoff should preserve or summarize:

- Work completed so far
- Open Tasks
- Current blockers
- Decisions made
- Relevant notes
- Active or completed agent executions
- Linked pull requests and their states
- Waiting reviews or human inputs
- Recommended next action
- A free-form handoff note

The summary may be assisted by AI, but the transition must not depend on AI.

### 10.3 Acceptance

The new owner accepts the handoff intentionally. Only then does the accountable owner change.

Accepting ownership does not automatically mean the new owner has begun execution. The new owner should still explicitly select Start work when they begin their own active period.

### 10.4 New-owner experience

The new owner’s focused UI should lead with:

- What remains to be done
- What currently needs attention
- What is blocked or waiting
- What the previous owner recommends next

Older context should remain accessible through previous ownership periods, handoffs, activity, Work notes, and agent summaries without overwhelming the current focus view.

## 11. Tasks

Tasks exist underneath Work and provide individually assignable execution units.

### 11.1 Creation

Humans and authorized agents may create Tasks.

Task creation by agents should be configurable per Work. The default may allow agents to create Tasks directly.

### 11.2 Attribution

Agent-created Tasks should have a minimal attribution indicator. Attribution should be visible when needed without adding noisy labels to every row.

Potential attribution sources include:

- The authenticated Vector CLI profile
- The registered agent device
- The attached process or provider
- The agent execution that created the Task
- An explicit CLI attribution flag

The final identity and trust model remains open. The public Vector skill may instruct external agents to pass attribution metadata, but the backend should not blindly trust arbitrary display labels when stronger authenticated context exists.

### 11.3 Assignment

Tasks may be assigned to individual people and, where supported, agent executions.

The initial concept assumes people create and assign Tasks manually. Automatic AI decomposition or silent automatic assignment is not required for the core model.

### 11.4 Agent permissions

By default, an authorized agent may be allowed to:

- Create Tasks
- Update Tasks assigned to its execution
- Report progress
- Mark its Task waiting or blocked
- Complete its Task
- Suggest or request a transfer

An agent should not silently transfer overall Work ownership, accept a Request on behalf of its requester, or reassign another person’s Task without an explicit policy granting that authority.

## 12. Human and Agent Execution

Vector should support several humans and agents executing within the same Work concurrently.

### 12.1 Separate state layers

The product must not collapse these states together:

```text
Work state
Planned, active, waiting, blocked, ready for review, completed, canceled

Task state
Todo, in progress, waiting, blocked, done, canceled

Execution state
Running, waiting, blocked, paused, completed, failed, disconnected

Ownership state
Current owner, pending handoff, previous ownership periods
```

The exact labels remain open, but the separation is required.

### 12.2 Agent context bundle

An agent working on Work should be able to retrieve a bounded, relevant context bundle containing:

- Work identity, outcome, state, and ownership
- Linked Requests and their expected outputs
- Workpad notes and decisions
- Tasks and assignments
- Current blockers
- Handoffs
- Development artifacts
- Recent relevant activity
- Active executions and their latest summaries

The context should be useful without forcing the agent to reconstruct the Work from many independent commands.

### 12.3 Agent updates

Through the Vector CLI and public skill, an agent should be able to perform explicit operations such as:

- Find or resolve Work
- Fetch Work context
- Attach an already-running session to Work or a Task
- Start an execution associated with Work
- Claim or begin an assigned Task
- Post progress
- Record a discovery or decision
- Mark its execution or Task waiting
- Mark its execution or Task blocked with a reason
- Pause or resume its execution
- Complete a Task
- Create a Task when policy allows
- Propose a Task transfer
- Explicitly request human attention
- Complete its execution with a summary and artifacts

### 12.4 Externally started sessions

People must be able to attach agent executions that began outside Vector or before the Work association was chosen.

This supports normal usage where somebody begins a Codex, Claude, terminal, or other agent session and later decides which Work or Task it belongs to.

### 12.5 Pausing

An agent normally pauses its own execution or Task. It should not pause the entire Work merely because its individual execution is waiting.

The Work surface should aggregate all live states so the user can understand whether meaningful progress continues elsewhere.

### 12.6 Human-attention escalation

Agents should not notify the Work owner for every waiting or blocked transition.

An agent should explicitly raise a human-attention request when it needs a person to act. That escalation should explain:

- What the agent needs
- Why it cannot continue
- Which Task or execution is affected
- Whether other Work can continue
- Suggested actions or choices

This explicit signal should drive prominent UI and notifications while ordinary internal waiting states remain quieter.

## 13. Work Overview and Supervision

One of the primary product goals is allowing a user to understand all Work currently happening across humans and agents.

The overview should make it possible to see:

- Active Work
- Work with live agent executions
- Work waiting for human attention
- Blocked Work or Tasks
- Work pending handoff acceptance
- Work ready for requester review
- Work with stale or disconnected executions
- Which person remains accountable
- What changed recently

The overview must preserve visual hierarchy. Small Task updates should not bury high-impact Work.

## 14. Review and Completion

### 14.1 Work completion

Completing Work indicates that its accountable owner believes the intended outcome has been delivered.

Agent execution completion or pull request merge must not automatically imply that all Work is complete unless an explicit Work policy permits that automation.

### 14.2 Request readiness

When all Work associated with a Request has been completed or otherwise raised for review, the Request should move to Ready for review.

The requester should be notified that the result is available and that review is now their responsibility.

### 14.3 Request review

The requester should see:

- Their original Request
- Their expected output
- Any review guidance they supplied
- The Work that was performed
- A concise completion summary
- Relevant artifacts and demonstrations
- Follow-up notes or limitations

They may:

- Accept the result and complete the Request
- Request changes, with a required review note that becomes current delivery context
- Add review feedback
- Create a follow-up Request
- Complete the Request directly if they have permission

Requesting changes reopens any linked Work that was waiting in Ready for review
back to Active. The review note is shown prominently in that Work so its owner
can resume with the requester's latest direction without reconstructing context
from the activity feed. Completed, canceled, or independently active Work is not
silently rewritten.

### 14.4 Permission-aware completion

The person who created a Request may mark it complete directly when they have the required permission. This is useful when no additional delivery process is necessary or the requester is satisfied without waiting for automatic roll-up.

Accepting a Request also closes linked Work that is still in Ready for review
when every fulfilling Request attached to that Work is now terminal (completed,
declined, or duplicate). Shared Work remains open until all of its requester-
specific review boundaries have resolved.

### 14.5 Shared Work and request completion

Because multiple Requests can share Work, closing one Work may make several Requests ready for review. The Request remains the requester-specific review boundary.

The exact behavior for partially satisfied Requests and Work that contributes only to part of a Request remains to be defined.

## 15. Notifications and Reminders

Notifications should communicate meaningful responsibility and attention changes rather than every low-level update.

Important notification moments include:

- A Request is routed or assigned
- A person is expected to take a routing decision
- A handoff is proposed
- A handoff is accepted or declined
- An agent explicitly requests human attention
- A Task is transferred
- Work becomes blocked at the aggregate level
- Work becomes ready for review
- A Request becomes ready for requester review
- The requester accepts the result or asks for changes
- A linked development event requires human action
- A scheduled or recurring reminder becomes due

Agent waiting, routine checklist toggles, ordinary Task progress, and background development updates should not automatically generate disruptive notifications.

The broader notification model should eventually distinguish unread information from unresolved action, support snoozing and recurrence, and stop reminders when their underlying responsibility is complete.

## 16. GitHub and Development Continuity

The existing GitHub relationship must not be lost.

Work and Tasks should be able to retain linked:

- Pull requests
- Commits
- GitHub issues
- Review states
- Checks
- Merge and close events

GitHub state should be treated as development evidence. Different Work may choose different completion policies:

- Manual completion
- Completion based on Tasks and required development artifacts
- GitHub-driven completion for narrowly scoped coding Work

Unmatched development artifacts should not necessarily create noisy top-level Work automatically. They may enter an unlinked-development or routing surface, while workspaces may opt into automatic creation.

Detailed GitHub policy remains subject to later discussion.

## 17. AI Assistance Principles

AI should assist without becoming a hard dependency.

Potential assistance includes:

- Suggesting existing Work for a Request
- Suggesting how to split a broad Request
- Summarizing a handoff
- Summarizing agent execution
- Suggesting Tasks
- Preparing a completion summary
- Highlighting blockers or missing context

For every essential workflow, Vector must preserve a deterministic manual path when AI is unavailable, unconfigured, delayed, or incorrect.

AI-generated associations, summaries, Tasks, and routing decisions should be attributable and correctable.

## 18. Attribution and Auditability

Meaningful actions should identify whether they originated from:

- A human in the Vector UI
- A human using the Vector CLI
- A registered local device
- A specific agent provider or process
- An attached external session
- A GitHub automation
- A scheduled system automation

Attribution should remain visually minimal during normal use while being available in activity, Task metadata, execution detail, and audit history.

The preferred model is to infer trustworthy attribution from authenticated session, device, process, and execution context, with an explicit CLI flag used only where additional labeling is needed.

## 19. Product Principles

The design should follow these principles:

1. **Requests are intake, not execution.** Assignment does not mean work started.
2. **Starting Work is intentional.** Vector records the moment somebody begins.
3. **Work is the outcome workspace.** Notes, Tasks, agents, GitHub, and history converge there.
4. **One human remains accountable.** Parallel contributors do not erase ownership.
5. **Handoffs preserve history.** Ownership changes are accepted transitions, not field overwrites.
6. **Multiple Work records can be active.** Users may supervise parallel humans and agents.
7. **Agent state is not Work state.** A paused agent does not pause everyone.
8. **Human attention is explicit.** Agents raise a deliberate escalation when a person must act.
9. **AI assists but does not gate.** Manual routing and attachment always work.
10. **Review belongs to the requester.** Delivery makes a Request ready; the requester accepts the result.
11. **Tiny steps stay lightweight.** Checklists should not flood top-level Work views.
12. **Attribution is trustworthy and quiet.** The audit trail is complete without covering every row in badges.

## 20. Confirmed Decisions

The following decisions have been made during the product discussion:

- Use Work as the primary execution concept and product noun.
- Keep Request separate from Work.
- A Request may link to existing Work or create new Work.
- Multiple Requests may link to the same Work.
- One Request may lead to multiple Work records.
- Manual Work search and attachment must work without AI.
- Assignment or acceptance of a Request does not start Work.
- Starting Work is an explicit user action.
- Users may have multiple active Work records.
- Work has a current accountable human owner.
- The previous owner remains accountable during a pending handoff.
- The new owner must accept a handoff.
- Accepting a handoff does not automatically mean execution has started.
- Humans can create Tasks underneath Work.
- Agents may create Tasks when the Work policy allows it.
- Agent Task creation may default to allowed.
- Agent attribution should be minimal but available.
- Already-running external agent sessions may be attached to Work later.
- An agent explicitly raises human attention instead of notifying on every waiting state.
- Review guidance remains general and free-form rather than a rigid required checklist.
- The requester reviews delivered results.
- An authorized requester may directly complete their own Request.
- Completing all linked Work can move a Request to Ready for review.
- The requester is notified when review is required.
- Existing GitHub development linkage and automation value must be preserved.

## 21. Implementation Decisions and Deliberate Deferrals

The first implementation uses the following concrete answers. Items explicitly marked deferred are not accidental omissions.

### Request routing

- A Request routed to exactly one person uses that person as its current Request owner. A Request routed to several people remains without a single owner until somebody claims it.
- A recipient is asked to respond or plan. The Request owner has claimed planning accountability. A watcher observes. Work contributors are separate and belong to Work, not Request.
- A Request may remain routed to a team without a person owner. A team member can later claim it.
- Automatic routing rules and AI suggestions are deferred. Manual routing to people or a team is complete without AI.
- Public Request intake remains available when an organization explicitly enables it. The anonymous mutation enforces fixed-window organization and submitter quotas before persisting a Request or notifying anyone; stronger CAPTCHA-style proof may be added later if public abuse warrants it.

### Work lifecycle

- Work states are `planned`, `active`, `waiting`, `blocked`, `ready_for_review`, `completed`, and `canceled`.
- Planned Work may be unowned. Selecting Start Work on unowned Work claims ownership and starts it in one explicit action.
- Assignment, Request claim, Work creation with an owner, handoff acceptance, and agent attachment do not start Work.
- Work has both an overall first-start timestamp and a per-owner execution-start timestamp. Accepting a handoff clears the latter, requiring the new owner to explicitly start their period.
- Waiting and blocked are explicit aggregate Work states. A paused execution does not change Work automatically.
- Automatic aggregation from mixed Task states is deferred; humans and authorized agents set aggregate Work state deliberately.
- Legacy board and command surfaces that still mutate a Work through workflow states use the same Request reconciliation as the dedicated Work actions, so alternate UI paths cannot bypass intake → delivery → review propagation.

### Focus and execution

- The default Work overview is Active now. It includes active, waiting, or blocked Work and Work with a live execution, even when the aggregate Work has not started.
- Blocked and review-ready Work rank ahead of ordinary active Work. Within that grouping, large effort ranks ahead of smaller effort, then the least recently changed Work ranks first so stale outcomes are harder to bury.
- Requests requiring review, changes, or routing rank ahead of ordinary routed intake. Older unhandled Requests receive a visible waiting-age signal.
- Manual pins and custom ordering are deferred.
- Meaningful Work updates are tracked separately from high-volume agent event streams.

### Tasks

- A Task has zero or one accountable human assignee.
- Tasks are not nested. Hierarchy stops at Work → Task, with checklists inside the Work workpad for lighter decomposition.
- Every Task belongs to exactly one Work.
- An authorized agent execution may create a Task only when the Work policy is `allow`; `approval_required` and `deny` prevent direct creation.
- Direct agent-to-human Task assignment is allowed when the execution acts through an authenticated human session and the user has Work edit permission. A visible agent attribution remains on the Task.

### Agent identity and permissions

- In this version an agent is an execution attached to an authenticated human, device, and optional process. It is not a standalone organization member.
- Trustworthy attribution is inferred from the live execution. CLI-created agent Tasks and attention requests must pass `--execution <liveActivityId>`; arbitrary provider labels are not accepted as proof.
- External agents currently use the same authenticated CLI credential as their supervising human, so the backend cannot prove that a command which omits `--execution` came from an agent. The public skill requires execution attribution and policy enforcement applies to attributed execution commands. Cryptographic enforcement for every agent-originated command requires distinct agent credentials or signed bridge context and remains a later trust-model upgrade.
- Attached sessions must belong to the authenticated user's registered device/session context and the same Work.
- Per-Work agent Task policies are `allow`, `approval_required`, and `deny`, defaulting to `allow`.
- People with Work edit permission may change the policy inline.

### Handoffs

- A recipient may accept or decline.
- A pending handoff may remain pending; the current owner remains accountable and recurring reminders can surface it. Automatic timeout is deferred.
- Administrative ownership bypass is deferred so the normal audit story remains unambiguous.
- A handoff requires a summary of completed and remaining context. Accepted history is immutable in this version.
- The new ownership period begins on acceptance, but its execution-start time remains empty until Start Work.

### Request review

- One linked Work may be ready while another is active. A Request becomes Ready for review only when all linked Work is ready or completed.
- Partial fulfillment remains visible through the individual linked Work states.
- Requesting changes updates the Request, notifies the Request owner and linked Work owners, and reopens linked review-ready Work to Active. The review note is surfaced as current Work context. It does not reopen already completed/canceled Work or create follow-up Work silently.
- Request completion remains a human review action by the requester, creator, or another user with edit authority. Automated Request acceptance is deferred.
- When that human accepts a Request, linked review-ready Work auto-completes only if every fulfilling Request on that Work is terminal. This keeps shared Work from closing while another requester still needs review.
- Changing the last Request ↔ Work relation away from `fulfills` removes that Work from completion aggregation and returns the Request to the appropriate intake/planning state. `contributes` links preserve context without driving review.

### Notifications and reminders

- Routing, handoffs, Request review, assignments, agent attention, reminders, and GitHub action-required events support in-app, web push, and preference-controlled email/push channels.
- The notification inbox separates actionable items from updates and lets a user mark an item done or snooze it until tomorrow.
- Recurring reminders can target requester, Request owner, Work owner, Work creator, Task assignee, and Request watchers. Work reminders default to owner plus creator; Request reminders default to requester plus owner.
- Reminders may be one-time, daily, weekdays, weekly, or custom-day cadence, optionally gated on inactivity. They stop automatically when their Request, Work, or Task completes or cancels.
- Agent waiting does not notify by itself. An agent explicitly raises attention, which produces the actionable notification.
- Grouping multiple simultaneous attention requests is deferred.

### GitHub

- Unmatched pull requests and GitHub issues go to a Development inbox by default. Workspace policy may instead create a Request, create planned Work, or ignore them. A durable inbox record makes every automatic creation policy idempotent even if an automatic artifact link is later removed or suppressed.
- Key matching and AI matching are independent policies. Manual artifact linking always remains available.
- GitHub authors become Work contributors by default, never Work owners, and do not start Work.
- Pull request text does not overwrite a Work title or workpad.
- Repository state is evidence by default. The workspace can keep it manual, notify the accountable owner when terminal evidence needs review, or allow GitHub to update state. GitHub may complete/cancel Work only when both the workspace state-automation policy and the individual Work completion policy opt into GitHub control.
- GitHub never starts Work. When opted-in terminal evidence completes all Work linked to a Request, that Request becomes Ready for human review.
- Artifacts attach primarily to Work. Task-level artifact links are represented in the schema and can be expanded in a later UI pass.
- A successful key/AI resolution with no match removes stale automatic links. A disabled, unavailable, or failed resolver preserves existing links so a temporary integration outage cannot silently detach evidence.
- Task-scoped development evidence updates only that Task. It never completes the parent Work or raises its Requests for review; only Work-scoped evidence may drive GitHub-controlled Work completion.
- Manual unlink and suppression are scoped to the exact Work-level or Task-level attachment that was removed, so hiding evidence from one Task does not hide it from its siblings or parent Work. When no other active attachment remains, either action also records the artifact as human-triaged, preventing later webhook updates from creating a new unmatched Request or Work. An explicit manual re-link reverses the scoped decision and restores the artifact's linked inbox state.
- Reconciliation and webhook ingestion apply the unmatched-artifact policy idempotently to open pull requests and GitHub issues, so installing GitHub after an artifact opened or missing its original webhook does not hide that work. Dismissed inbox items remain dismissed.

### Naming and migration

- User-facing primary navigation and canonical routes use Requests and Work. `/requests/:key` and `/work/:key` are canonical.
- Existing Work keys stay unchanged so links, commits, and external references remain stable.
- `/issues` and `/issues/:key` are compatibility redirects. A legacy child-issue URL redirects to its parent Work and identifies the migrated Task.
- Existing root issues become Work. Existing child issues become dedicated Tasks while their issue rows remain compatibility aliases during migration.
- The internal `issues` table remains the storage identity for Work in this migration to preserve foreign keys and GitHub relationships. Product language and new APIs use Work.
- Logged-out legacy links preserve their full destination through sign-in, while inaccessible or missing legacy records resolve as not found instead of surfacing a server error.

## 22. Current Implementation Mapping

Implementation is organized around these durable boundaries:

- Convex `requests`, `requestRecipients`, and `requestWorkLinks` store intake, routing, and the many-to-many Request ↔ Work relationship.
- Existing top-level `issues` rows store Work identity with Work-specific lifecycle, owner, effort, completion, provenance, and agent-policy fields.
- Convex `tasks` stores the independently trackable units inside Work.
- Ownership periods and handoff records preserve accountability history and distinct per-owner execution starts.
- Attention records, live activity records, and execution provenance keep agent state separate from aggregate Work state.
- The shared activity feed authorizes and hydrates Request, Work, and Task scopes directly, so lifecycle history remains visible without treating the new entities as legacy team activity.
- Reminder rules and occurrences provide durable recurring scheduling with idempotent delivery.
- GitHub artifact links remain attached to the stable Work identity; a Development inbox captures unmatched evidence.
- CLI command groups are `request`, `work`, and `task`. The `issue` group remains compatibility-only.
- Dense application surfaces are `/requests`, `/requests/:key`, `/work`, and `/work/:key`. The Work detail is the focused execution surface with linked Requests, workpad/checklists, Tasks, executions, development evidence, policies, reminders, and ownership history.

The existing issue permission constants are reused in the first migration so access does not silently broaden while the product vocabulary changes. A separate permission-naming migration may follow after behavior stabilizes.

## 23. Example End-to-End Flow

```text
1. A requester submits a Request.
   They describe the problem, expected result, timing, and suggested recipient.

2. Vector routes the Request to a person or team.
   The recipient is responsible for deciding what happens next, but no Work has
   started merely because the Request was assigned.

3. The recipient inspects the Request.
   Vector may suggest related Work. The recipient can manually search regardless
   of whether AI is configured.

4. The recipient attaches the Request to existing Work.
   Alternatively, they create one or several new Work records.

5. At a later intentional moment, the owner selects Start work.
   Vector records the execution start and brings the Work into active focus.

6. The owner creates Tasks and checklist items.
   Several Tasks may be assigned to different people or agents.

7. Multiple agents work simultaneously.
   Each receives bounded Work context and reports its own progress, waiting,
   blockers, and completion without overwriting the aggregate Work state.

8. An agent needs a product decision.
   It explicitly raises human attention with the question, reason, affected Task,
   and suggested options.

9. The owner hands Work to another person.
   The handoff remains pending while the previous owner stays accountable. The
   recipient reviews the handoff context and accepts ownership.

10. The new owner explicitly starts their own execution period.
    Their focused view emphasizes remaining Tasks and current context while the
    previous history stays available.

11. The owner completes Work.
    Vector prepares a concise delivery summary and updates linked Requests.

12. When all relevant Work is complete, the Request becomes Ready for review.
    The requester receives a notification and reviews the original expected
    result against the delivered outcome.

13. The requester accepts or requests changes.
    Acceptance completes the Request. Requested changes return it to delivery or
    create follow-up Work through an explicit human decision; Vector does not
    silently reopen or create Work.
```
