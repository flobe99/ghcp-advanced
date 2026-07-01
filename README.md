# ghcp-advanced

**An advanced GitHub Copilot tutorial focused on Spec-Driven Development (SDD).**

This is a [MoaW](https://moaw.dev) workshop. The best way to read it is rendered:

👉 **[Open the workshop on MoaW](https://moaw.dev/workshop/gh:jkordick/ghcp-advanced/main/docs/)**

Or read the raw markdown: [`docs/workshop.md`](docs/workshop.md).

## What you'll learn

1. **Getting started with GitHub Copilot**: completions, Chat, custom agents, the Copilot CLI, custom instructions, prompt files, skills and MCP servers. A single broad chapter for newcomers.
2. **Spec-Driven Development (SDD)**: Learn about SDD. Make specifications, not vibes, drive what Copilot builds. End-to-end TypeScript/Node example.
3. **spec-kit**: an open-source toolkit by the GitHub team that formalizes and extends the loop you just did by hand. It can be used in combination with GitHub Copilot but also many more agentic AIs for coding.
4. (soon) **Squad**: an open-source framework for orchestrating multi-agent development teams on top of GitHub Copilot.
5. (soon) **SDD for app modernization**: a dedicated chapter on how to use SDD to modernize legacy apps.

## Pre-reqs

- A GitHub account with Copilot access (Free, Pro, Business or Enterprise)
- VS Code with the GitHub Copilot + Copilot Chat extensions
- Node.js 20+
- GitHub CLI (`gh`) and the `gh copilot` extension

See [the Pre-requisites section of the workshop](docs/workshop.md#pre-requisites) for more details.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Inspired by the excellent [GitHub Copilot HoL by @Philess](https://moaw.dev/workshop/gh:Philess/GHCopilotHoL/main/docs/).


### Julia's to do list
- optional: before creating the spec, ask GHCP to break down the user-stories into reasonable sized github issues, and then generate the spec based on the issues; would need github access + github mcp
- add spec-kit for app mod section
- add squad section
- save the world


# Copilot Ansatz
In GitHub Copilot arbeiten drei Bausteine zusammen:

- **Agents**
- **Prompts**
- **Skills**

Kurzfassung:

- **Agent** = Wie Copilot arbeitet (Verhalten, Grenzen, Tool-Nutzung)
- **Prompt** = Was Copilot in einem konkreten Schritt erledigen soll
- **Skill** = Wiederverwendbare Anleitung für wiederkehrende Aufgaben

## Was ist was?

### 1. Agents
Agents sind der Ausfuehrungsmodus von Copilot. Sie bestimmen, wie Copilot vorgeht: eher analysierend, umsetzend oder z. B. testfokussiert.

Im Repository steuerst du das vor allem ueber Instruktionen:

- globale Regeln in `.github/copilot-instructions.md`
- bereichsspezifische Regeln in `duck-emporium/AGENTS.md`

Beispiel aus diesem Repo:

- `duck-emporium/AGENTS.md` verbietet Aenderungen an `user-stories/**`
- Specs in `specs/**` sollen nur im SDD-Flow angepasst werden

## 2. Prompts
Prompts sind versionierte Aufgaben-Templates. Sie definieren Ziel, Eingaben und Regeln fuer einen klaren Arbeitsschritt.

Bei dir liegen sie in `.github/prompts/`:

- `sdd-spec.prompt.md`
- `sdd-plan.prompt.md`
- `sdd-tasks.prompt.md`
- `sdd-implement.prompt.md`
- `add-test.prompt.md`

Typischer Nutzen:

- aus einer User Story eine Spec erstellen
- aus einer Spec einen technischen Plan erstellen
- aus dem Plan eine Taskliste ableiten
- genau eine Task implementieren und testen

## 3. Skills
Skills kapseln wiederkehrende Faehigkeiten als klare Schritt-fuer-Schritt-Anleitungen.

Bei dir liegen sie in `.github/skills/`:

- `run-tests/SKILL.md`
- `lint-and-typecheck/SKILL.md`
- `convert-svg-to-png/SKILL.md`

Beispiel:

- Der Skill `run-tests` beschreibt explizit, wie Tests auszufuehren sind und dass fehlschlagende Tests nicht umgangen werden.

## Wie du es in diesem Repository konkret einsetzt

### Empfohlener Ablauf (SDD)

1. Waehl eine Story aus `user-stories/`.
2. Starte mit `sdd-spec.prompt.md` und erstelle `specs/<story-id>/spec.md`.
3. Fuehre `sdd-plan.prompt.md` aus und erstelle `specs/<story-id>/plan.md`.
4. Erzeuge mit `sdd-tasks.prompt.md` eine umsetzbare Taskliste in `specs/<story-id>/tasks.md`.
5. Implementiere je Durchlauf genau eine Task mit `sdd-implement.prompt.md`.
6. Nutze Skills wie `run-tests` und `lint-and-typecheck`, um Qualitaet verbindlich zu pruefen.

### Best Practices fuer Teamarbeit

- **Regeln einmalig zentral halten**: in `.github/copilot-instructions.md` und `duck-emporium/AGENTS.md`
- **Ablauf als Prompts standardisieren**: damit jeder denselben Prozess nutzt
- **Qualitaets-Gates als Skills festlegen**: Tests und Checks werden nicht vergessen
- **Kleine, reviewbare Schritte**: jede Task sollte einzeln pruefbar und committable sein

So entsteht ein reproduzierbarer Copilot-Workflow: klare Regeln (Agents), klare Arbeitsschritte (Prompts), klare Qualitaetssicherung (Skills).