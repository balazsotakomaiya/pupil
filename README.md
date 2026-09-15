# Pupil

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
[![License](https://img.shields.io/badge/license-MIT-0f766e)](LICENSE)

Pupil is a local-first flashcard app for people who want the power of spaced repetition without the friction that usually comes with it.

Create focused study spaces. Import Anki decks. Generate cards from any topic with AI. Study with FSRS. Everything stays on your machine.

## Screenshots

<p>
  <img src="apps/site/src/assets/screenshots/dashboard.png" alt="Pupil dashboard showing due cards, study stats, and learning spaces" width="100%">
</p>

<table>
  <tr>
    <td width="50%">
      <img src="apps/site/src/assets/screenshots/ai-generate.png" alt="AI Generate screen with prompt, space, difficulty, style, and count controls">
    </td>
    <td width="50%">
      <img src="apps/site/src/assets/screenshots/study-review.png" alt="Study screen showing a revealed flashcard answer and FSRS rating buttons">
    </td>
  </tr>
  <tr>
    <td><strong>Generate cards from a topic</strong></td>
    <td><strong>Review with FSRS scheduling</strong></td>
  </tr>
</table>

## Get Pupil

Download the latest installer for macOS, Windows, or Linux from [GitHub Releases](https://github.com/balazsotakomaiya/pupil/releases/latest). No account is required.

Your cards, review history, and settings stay on your device. If you use AI generation, add your own OpenAI-compatible or Anthropic API key in Settings; it is stored securely on your machine.

## Why Pupil

Most flashcard tools force a tradeoff.

- Anki is powerful, yet deeply outdated visually, clunky, and complex
- AI can generate content fast but usually lives and stays in your chat history on ChatGPT, Claude, or Gemini.
- Modern study tools hide the good stuff behind subscriptions and lock you in.

Pupil is built to close that gap: fast card creation, a clean study flow, serious scheduling, and no account required. It is free and open source.

It is also designed to be more present in your day than Anki typically is — subtle reminders, streaks that keep momentum going, and stats that surface weak spots before they become blind spots.

## What it does

- Organize knowledge into named spaces
- Create cards manually with a desktop-first editor
- Import `.apkg` decks from Anki
- Generate cards from a topic using any OpenAI-compatible or Anthropic model
- Review AI-generated cards before they land in your library
- Study per-space or across your full collection
- Schedule reviews with FSRS
- Export review history as CSV
- Store everything locally in SQLite — no account, no sync

## Principles

Pupil is designed around one idea: studying should feel sharp, calm, and immediate.

- Local-first by default
- Fast enough to go from idea to deck in under a minute
- Structured for daily use, not just card authoring
- Opinionated UI

## Product direction

Pupil is growing beyond the desktop without giving up its local-first foundation.

- Optional cloud sync for people who study across devices
- A mobile app for keeping reviews within reach wherever you are
- Assistant workflows, including a possible MCP bridge so tools like Claude or ChatGPT could push cards directly into Pupil

## Contributing

Want to help build Pupil? Setup, conventions, and the pull-request checks are in [CONTRIBUTING.md](CONTRIBUTING.md). Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

Found a security issue? Please report it privately — see [SECURITY.md](SECURITY.md).

Release notes live in [CHANGELOG.md](CHANGELOG.md).

## License

Pupil is available under the MIT License. You can use, modify, distribute, and sell software based on it, as long as you keep the copyright notice and license text. See [LICENSE](LICENSE).
