# Checkly (MVP)

Mobile-first task tracker + daily goals tracker.

## Run locally

1) Install deps

```bash
npm install
```

2) Start dev server

```bash
npm run dev
```

Open the printed URL. On iPhone, open that URL in Safari and choose **Share → Add to Home Screen**.

## What’s included

- **Today** tab: Daily Goals + Due Today + Overdue
- **Tasks** tab: all tasks + anytime tasks
- **Settings** tab: manage daily goals + reset data
- Local-first persistence (localStorage)
- Recurring tasks: every X day/week/month/year

## Notes

- Recurring tasks advance **from completion date** (great for chores).
- One-time tasks can have an optional due date, otherwise they show in Anytime.
