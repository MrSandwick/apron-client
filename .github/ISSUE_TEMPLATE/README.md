# Kanban Templates

Starter templates for issues tracked on the GitHub project kanban board.

## Templates

| File | Use for |
| --- | --- |
| [`task.md`](./task.md) | A general unit of work. |
| [`feature.md`](./feature.md) | Proposing a new feature or enhancement. |
| [`bug.md`](./bug.md) | Reporting a defect. |
| [`user-story.md`](./user-story.md) | A feature from the user's perspective. |
| [`spike.md`](./spike.md) | Time-boxed research / investigation. |

## Suggested Board Columns

```
Backlog  →  To Do  →  In Progress  →  Review  →  Done
```

- **Backlog** — captured but not yet scheduled.
- **To Do** — prioritized and ready to pick up.
- **In Progress** — actively being worked (keep WIP low).
- **Review** — in PR review / QA.
- **Done** — merged and verified.

## Conventions

- Each card sets **Status**, **Priority**, and (where relevant) an **Estimate** in its footer.
- Use the matching label (`task`, `feature`, `bug`, `story`, `spike`) so the board can filter by type.
- Move a card right only when its acceptance criteria are checked off.
