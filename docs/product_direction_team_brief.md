---
title: "DiscipLog: Productivity Coach with Developer Superpowers"
subtitle: "Product Direction Brief"
date: "April 2026"
author: "DiscipLog Team"
geometry: "margin=1in"
fontsize: 11pt
mainfont: "Arial Unicode MS"
monofont: "Menlo"
linestretch: 1.3
colorlinks: true
linkcolor: "blue"
urlcolor: "blue"
header-includes: |
  \usepackage{fancyhdr}
  \usepackage{xcolor}
  \usepackage{tikz}
  \usepackage{booktabs}
  \usepackage{enumitem}
  \pagestyle{fancy}
  \fancyhead[L]{\small\textcolor{gray}{DiscipLog — Product Direction Brief}}
  \fancyhead[R]{\small\textcolor{gray}{April 2026}}
  \fancyfoot[C]{\thepage}
  \definecolor{accent}{HTML}{7C3AED}
  \definecolor{success}{HTML}{059669}
  \definecolor{warning}{HTML}{D97706}
  \definecolor{muted}{HTML}{64748B}
---

\begin{center}
\vspace{1cm}
{\Huge\bfseries DiscipLog}\\[0.3cm]
{\Large Productivity Coach with Developer Superpowers}\\[0.8cm]
{\large Product Direction Brief — April 2026}\\[0.3cm]
{\small Confidential — For Internal Team Use}
\vspace{1cm}
\end{center}

\hrule
\vspace{0.5cm}

# The Big Idea

> **DiscipLog stays a productivity coach for everyone — and adds an optional "Developer Mode" that automatically tracks coding sessions, making it irresistible for software developers.**

This isn't a pivot. It's a **power-up**.

\vspace{0.3cm}

# The Problem We're Solving

Developers want to be consistent with their coding, but they struggle to actually track and improve their habits.

Today, they either:

- **Don't track at all** — No self-awareness, no improvement
- **Use time-trackers like WakaTime** — See numbers, but get no guidance on what to change
- **Try manual habit apps** — Too much friction, they quit within a week

There's a gap in the market: **nobody is coaching developers on their coding consistency using real data.**

And a new gap is emerging: **nobody is tracking the relationship between developers and their AI coding assistants.**

\newpage

# Why Add-On Beats Pivot

We considered rebuilding DiscipLog as a developer-only tool. Here's why we chose the add-on approach instead:

| Factor | Full Pivot | Add-On Mode (Our Choice) |
|:---|:---|:---|
| Risk | High - breaks what works | Low - core untouched |
| Existing users | Confused or alienated | Unaffected |
| Developer appeal | Strong | Equally strong |
| Future expansion | Locked to dev niche | Browser Mode, Calendar Mode, etc. |
| Marketing | Narrow: "dev-only tool" | Flexible: "coach for everyone, superpowers for devs" |

\vspace{0.3cm}

# How DiscipLog Works Today (Unchanged)

Everything that makes DiscipLog valuable stays exactly as it is:

| Feature | What It Does | Status |
|:---|:---|:---:|
| Manual Logging | Log any activity with a quick note | Stays |
| Sprint Timer | Focused work blocks with tracking | Stays |
| AI Coach | Personalized coaching with memory | Stays |
| Smart Recall | Auto-generated flashcards for learning | Stays |
| Weekly Debriefs | Auto-generated weekly summaries | Stays |
| Momentum | Streaks and consistency tracking | Stays |
| Push Notifications | Personalized nudges | Stays |

**A user who never enables Developer Mode has the exact same DiscipLog they use today.**

\newpage

# What Developer Mode Adds

Developer Mode is a **toggle in Settings**. When a developer turns it on, they get three new capabilities:

## 1. Automatic IDE Tracking

A VS Code extension runs silently in the background and logs coding sessions automatically — zero effort from the user.

**What it captures (metadata only, never code):**

- Files edited and languages used
- Active coding time vs. idle time
- Terminal commands run
- Git commits and branches
- Errors resolved
- Debug sessions

## 2. AI Agent Awareness

When developers use AI coding assistants (like Copilot or Cursor), DiscipLog also captures what the AI did during the session — via MCP (Model Context Protocol).

**What it captures:**

- What tasks the AI performed
- How many files it generated
- Whether it succeeded or needed retries

## 3. Auto-Generated Sprint Logs

Instead of typing "I coded for 2 hours on my project," the system auto-generates rich session summaries like:

> "1h 42m on DiscipLog project. Built auth system — AI scaffolded the login page, developer wrote validation logic manually. 2 commits pushed, all tests passing."

\newpage

# The Two-Piece System

Developer Mode uses two components working together:

| Component | Role | Analogy |
|:---|:---|:---|
| **VS Code Extension** | Passively watches the developer's coding activity | The Eyes |
| **MCP Server** | Listens to AI assistants and records what they did | The Ears |

Together, they give DiscipLog the **complete picture** of a coding session — both the human and the AI contributions.

**How it flows:**

1. Developer opens VS Code → Extension starts tracking silently
2. Developer codes, uses AI assistant, runs commands
3. AI assistant reports its tasks via MCP
4. Session ends after idle period
5. Extension + MCP data merge into one rich session summary
6. Auto-posted to DiscipLog as a sprint log
7. AI Coach, Smart Recall, and Memory all process it automatically

**The developer just codes. The system does the rest.**

\newpage

# Two Users, One Product

## Priya — University Student (No Developer Mode)

Priya uses DiscipLog to track her study habits. She:

- Manually logs study sessions ("1 hour of Data Structures")
- Uses the sprint timer for focused study blocks
- Gets AI coaching on her consistency
- Reviews Smart Recall cards before exams

**She never sees Developer Mode.** The app works exactly as it does today.

Her AI Coach says: *"You studied 3 hours today — strong. Your weakest day is Sunday. Try a 25-minute morning sprint this Sunday to break the pattern."*

\vspace{0.5cm}

## Aarav — Software Developer (Developer Mode ON)

Aarav enables Developer Mode. He:

- **Automatically** gets his coding sessions logged by the VS Code extension
- **Also** manually logs non-coding activities (reading, exercise)
- Uses the sprint timer for focused coding blocks
- Gets AI coaching that combines **all** his data

His AI Coach says: *"You coded 4.2 hours today across 3 sessions. Your side project hasn't been touched in 9 days — that's your longest gap. Tomorrow looks light — try a 30-min sprint on it."*

**That insight was only possible because Developer Mode gave the coach automatic coding data.**

\newpage

# The Vision: Layered Modes

Developer Mode is the first "power mode." The same pattern extends to other data sources:

| Mode | What It Tracks | Status |
|:---|:---|:---|
| **Core** | Manual logs, sprints | Built and working |
| **Developer Mode** | IDE coding sessions, AI agent activity | Building next |
| **Browser Mode** | Research, reading, browsing patterns | Future |
| **More Modes** | Calendar, mobile, meetings | Long-term vision |

**Each mode makes the AI Coach smarter** because it sees more of the user's life. But each mode is completely optional — the core always works on its own.

## Browser Mode Preview

With Browser Mode enabled, the AI Coach would be able to say:

> "You spent 40 minutes researching authentication best practices, then opened VS Code and coded the auth system for 1.5 hours. Your research-to-implementation ratio is improving - last month you'd spend 3x longer researching before acting."

This cross-source insight is only possible when the Coach can see both browsing AND coding data.

\newpage

# How We're Different from Competitors

## WakaTime — "Time Tracking for Developers"

**What they do:** Dashboard showing hours coded, languages used, projects worked on.

**Their weakness:** Data without direction. Users see "you coded 4 hours today" but get no guidance. No AI coaching. No concept of broader productivity.

**Our edge:** DiscipLog is a full productivity coach. Developer Mode adds what WakaTime does — plus AI coaching, agent awareness, and integration with your entire productivity picture.

## RescueTime — "Time Tracking for Everyone"

**What they do:** Tracks all computer activity, gives a "productivity score."

**Their weakness:** Too broad. No depth in any category. No AI coaching.

**Our edge:** We go deep where it matters. Developer Mode understands coding sessions. Browser Mode will understand research patterns. The AI Coach synthesizes all of it.

## Notion / Todoist / Generic Productivity Apps

**What they do:** Task management, note-taking, planning.

**Their weakness:** No tracking. No coaching. No awareness of what you actually DID.

**Our edge:** We don't just plan — we *track real activity* and *coach on consistency*. Planning is cheap. Execution tracking is rare. AI coaching on execution data is unique.

## Our Unique Position

```
WakaTime         = Coding dashboard       (dev-only)
RescueTime       = Productivity score     (broad, shallow)
Notion/Todoist   = Planning tools         (no tracking)

DiscipLog        = AI productivity coach  (deep)
                   + Developer superpowers  (automatic)
                   + Browser tracking       (coming soon)
```

**Nobody combines real activity tracking + AI coaching + extensible modes.**

\newpage

# What We Already Have (Head Start)

DiscipLog isn't starting from zero. We've built systems that competitors would need months to replicate:

| Capability | What It Means | Competitor? |
|:---|:---|:---:|
| AI Coach with Memory | Remembers your patterns over time | No |
| Smart Recall | Auto-generated review flashcards | No |
| Semantic Search | Evidence-based coaching advice | No |
| Weekly Debriefs | Auto-generated weekly summaries | No |
| Sprint System | Focused work timer with tracking | Basic |
| Momentum Tracking | Streaks, consistency scores, nudges | No |
| Source-Agnostic Pipeline | Any data source feeds the same AI | No |

**The source-agnostic pipeline is the hidden superpower.** Whether a log comes from manual entry, sprint timer, VS Code extension, or browser extension — the entire AI pipeline processes it identically. Adding new modes is fast.

**We're not building a time tracker that also has AI. We're building an AI coach that now gets automatic data — including what AI assistants are doing.**

\newpage

# The Roadmap

## Phase 1 -- Developer Mode Foundation (Weeks 1-4)

**Goal:** Validate that developers want automatic IDE session tracking in DiscipLog.

- Add Developer Mode section in Settings (toggle, API key, preferences)
- Build VS Code extension (passive tracking only)
- IDE sessions appear in dashboard alongside manual logs
- Auto-generated sprint summaries

**Success metric:** 5 beta developers keep the extension installed for 7+ days.

## Phase 2 -- Coaching on IDE Data (Weeks 5-8)

**Goal:** Show that AI coaching on automatic data is more valuable than manual data alone.

- AI Coach references IDE sessions in conversations
- Pattern detection: *"You code most on Tuesdays"*
- Smart Recall generates cards from coding patterns
- Weekly debrief includes IDE session breakdown

**Success metric:** Users engage with AI coaching 3+ times per week.

## Phase 3 -- AI Agent Awareness (Weeks 9-12)

**Goal:** Become the only tool that understands the human + AI coding relationship.

- MCP server that AI assistants call to report activity
- Sessions show human vs. AI contribution breakdown
- Coach advises on AI reliance trends
- Sprint control via AI agent

**Success metric:** 3+ AI-aware sessions per user per week.

## Phase 4 -- Browser Mode (Months 4-6)

**Goal:** Expand from coding tracking to full productivity tracking.

- Browser extension for research/browsing patterns
- Coach correlates research time with implementation time
- Full productivity picture: manual + coding + browsing

**Success metric:** 20% of Developer Mode users also enable Browser Mode.

\newpage

# Revenue Model

| Tier | Price | What They Get |
|:---|:---|:---|
| **Free** | $0 | Core DiscipLog: manual logs, sprints, basic AI coaching, 7-day history |
| **Pro** | $5-8/mo | Full AI coaching, Smart Recall, unlimited history, weekly debriefs |
| **Pro + Developer** | $8-12/mo | Everything in Pro + Developer Mode (IDE auto-tracking, AI agent awareness) |
| **Pro + Everything** | $12-15/mo | All modes: Developer + Browser + future modes |

**Why developers would pay:**

- \$5-8/month is trivial for working developers
- The AI coaching is genuinely valuable and personal
- AI agent awareness is a feature nobody else offers
- It gets smarter over time (more data = better insights)

**The mode-based pricing creates clear upgrade paths.** A free user upgrades to Pro for coaching. A Pro developer upgrades for Developer Mode. As we add modes, each creates new revenue.

\newpage

# Privacy — Our #1 Priority

| Principle | What It Means |
|:---|:---|
| No code content, ever | We track file names, languages, save counts - never code |
| No keystroke logging | We count activity level - not what was typed |
| No browsing content | Browser Mode tracks domains and time - never pages |
| Agent summaries only | We capture "Built login page" not full AI conversations |
| Open-source extensions | Anyone can audit what we collect |
| Your data, your control | Delete, pause, or export anytime |

**If we get privacy wrong, developers will never trust us.** Transparent, minimal data collection. No exceptions.

\vspace{0.5cm}

# Risks & How We Handle Them

| Risk | Severity | Mitigation |
|:---|:---:|:---|
| Privacy concerns | High | Open-source extensions. Metadata only. Clear privacy page. |
| WakaTime exists | Medium | We're a coach, they're a dashboard. Different products. |
| Scope creep | Medium | Strict phasing. No Browser Mode until Phase 4. |
| Low mode adoption | Medium | Core works without modes. Modes are bonus, not required. |
| MCP ecosystem maturing | Medium | MCP is Phase 3. Extension works standalone. |
| Extension complexity | Low | About 500 lines of code. 2-3 weekends estimated. |

\newpage

# The One-Liner

\begin{center}
\vspace{0.5cm}
\fbox{\parbox{0.85\textwidth}{
\centering
\vspace{0.3cm}
{\large\bfseries DiscipLog is an AI productivity coach that gets smarter the more it sees — and Developer Mode lets it see your coding sessions automatically.}
\vspace{0.3cm}
}}
\vspace{0.5cm}
\end{center}

**For developers:** *"Your AI coach now watches your IDE."*

**For everyone else:** *"Your AI coach learns your patterns and helps you stay consistent."*

\vspace{0.5cm}

# Next Steps

1. **This week:** Build Developer Mode toggle in Settings + basic VS Code extension
2. **Next week:** 5 developer beta testers using it daily
3. **Week 3-4:** Evaluate: Are they keeping it? What do they want?
4. **Week 5-8:** Add AI coaching on IDE data if signal is positive
5. **Week 9+:** Build MCP for AI agent awareness
6. **Month 4+:** Browser Mode

\vspace{0.5cm}

\begin{center}
\fbox{\parbox{0.85\textwidth}{
\centering
\vspace{0.3cm}
{\bfseries The core app is our foundation. Developer Mode is our wedge. Browser Mode is our expansion. Don't skip the order.}
\vspace{0.3cm}
}}
\end{center}
