---
name: IronTrack Orange Core
colors:
  primary: "#f26a21"
  primary-strong: "#d94f08"
  primary-soft: "#ffe7d7"
  canvas: "#f7f5f2"
  surface: "#ffffff"
  surface-muted: "#faf8f6"
  on-surface: "#191714"
  on-surface-muted: "#716c65"
  border: "#e6dfd7"
  border-strong: "#d3c8bd"
  success: "#26835f"
  error: "#c44135"
typography:
  family: Inter
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
  body-strong:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 700
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 900
    textTransform: uppercase
  display:
    fontFamily: Inter
    fontWeight: 800
    letterSpacing: "-0.07em"
rounded:
  sm: 12px
  md: 14px
  lg: 18px
  xl: 22px
shadow:
  soft: "0 18px 45px rgba(45, 34, 22, 0.08)"
---

# Design System

## Overview

IronTrack should feel like a focused workout log: light, calm, direct, and a little energetic. The app is not a performance analytics dashboard. It should help users plan workouts, track sets during a session, and review completed workouts with minimal friction.

Orange is the energy color. Use it for primary actions, selected states, workout days, and important affordances. Most of the interface should stay quiet: warm canvas, white cards, soft borders, and dark text.

## Product Principles

- The app has three core jobs: plan workouts, track workouts, review workouts.
- Do not invent analytics the app does not know, such as best lift or readiness.
- Do not make timers visually central. A normal gym workout is not a race.
- Keep active workout mode focused on set entry.
- Keep public-template discovery separate from the user's own template list.

## Colors

- **Primary** (`#f26a21`): main CTAs, brand mark, selected/active accents.
- **Primary strong** (`#d94f08`): primary text on pale orange backgrounds.
- **Primary soft** (`#ffe7d7`): low-emphasis action fills, workout calendar days.
- **Canvas** (`#f7f5f2`): page background.
- **Surface** (`#ffffff`): cards, panels, inputs.
- **Surface muted** (`#faf8f6`): quiet input and secondary surfaces.
- **On-surface** (`#191714`): primary text.
- **On-surface muted** (`#716c65`): supporting text, inactive navigation, secondary labels.
- **Border** (`#e6dfd7`): default dividers and card borders.
- **Border strong** (`#d3c8bd`): stronger dividers, hover borders.
- **Success** (`#26835f`): sync success and confirmed/completed states.
- **Error** (`#c44135`): destructive actions and errors.

## Typography

- **Headlines**: Inter, heavy/semi-bold, tight line height, slight negative letter spacing.
- **Body**: Inter, regular/medium, 14-16px.
- **Labels**: Inter, bold, 11-12px, uppercase only for small section labels and table headers.
- Avoid viewport-scaled body text. Keep compact UI text readable and stable.

## Layout

- Mobile-first PWA, with desktop sidebar and mobile bottom nav outside workout mode.
- During active workout, hide normal navigation and show a workout action bar.
- Prefer one clear primary area per screen. Avoid dashboard-style grids unless the user is reviewing a calendar or history.
- Cards should be white surfaces on the warm canvas, with border and soft shadow.
- Keep card radius around 18-22px; smaller internal controls around 12-14px.

## Components

### Buttons

- Primary buttons use orange fill with white text.
- Secondary buttons use white fill, border, and dark text.
- Destructive actions are icon buttons with red hover/focus treatment.
- Touch targets should be at least 40-44px tall.

### Template Cards

- Main Templates screen shows templates owned by the current user.
- Template cards show:
  - template name
  - delete and edit icons for owned templates, with edit as the rightmost action
  - horizontal exercise-chip carousel
  - full-width pale-orange footer action with icon + `Start`
- Exercise chips stay in one horizontal row.
- Long exercise names truncate inside max-width chips.
- Many exercises scroll horizontally inside the card.
- Create template appears as a dashed row at the bottom of the list.

### Public Template Search

- Public templates are not mixed into the main template list.
- Public-template discovery should be a dedicated search flow.
- Copying a public template creates a private owned copy by default.

### Active Workout

- Active workout screen shows set number, weight, reps, and the right-side set selection handle.
- Keep superset connectors and selected bulk actions.
- Add Exercise belongs below the exercise list.
- Notes are not shown inline during workout.
- Finish opens a modal that can ask for notes and confirm save.
- Exit opens a leave/discard confirmation when needed.
- Bottom bar contains workout actions, not normal navigation.

### History

- History uses a calendar view.
- Show a full month; row count depends on the month plus leading/trailing week days.
- Workout days are low-key orange circles.
- Tapping a workout day opens the latest workout for that day.
- Workout detail is read-only and uses the same basic exercise/set structure as active workout.
- Detail view keeps normal app navigation and has a back affordance to the calendar.

## Do's And Don'ts

- Do use orange sparingly for action and orientation.
- Do keep screens true to the app's known data.
- Do favor direct controls over explanatory text.
- Do preserve existing workout mechanics when restyling.
- Do make overflow behavior visible for horizontal chip rows.
- Don't add dashboard metrics unless the product actually computes them.
- Don't make timers prominent.
- Don't mix dark themed components into the light orange system.
- Don't hide secondary but necessary actions, such as edit/delete on templates.
