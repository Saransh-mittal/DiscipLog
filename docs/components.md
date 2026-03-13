# Reusable Components

This document serves as the guide for shared atomic components within DiscipLog's `shadcn/ui` architecture.

## Installation Policy
Only install necessary shadcn components. 
- Use the CLI: `npx shadcn@latest add [component]`

## Presentational Components

### `Button`
Standard button component.
- Used globally for generic actions, form submissions, and logging triggers.

### `Card`
Content container with distinct elevation/borders.
- Used in the calendar grid and summary displays.

### `Input`
Text collection interface.

## Core Modules

### `Calendar` (WIP)
Dashboard element dynamically querying logged objects to shade day squares globally.

### `Logger` (WIP)
Voice / Text entry point. Interfaces with global generic React Hook over Web Speech API and conditionally renders fallbacks based on runtime capability.
