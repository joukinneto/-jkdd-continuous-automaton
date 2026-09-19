\# JKDD Continuous — Agent Rules



\## Objective

This repository is the central JKDD Continuous orchestrator.



\## Core Principles

\- Use local tools before LLMs.

\- Minimize context sent to models.

\- Prefer git diff, search results, summaries, and targeted files.

\- Expensive models are escalation targets, not default executors.

\- Never send an entire repository unless explicitly required.



\## Agent Routing

1\. Search Agent

&#x20;  - file discovery

&#x20;  - symbol search

&#x20;  - repository inspection



2\. Git Agent

&#x20;  - status

&#x20;  - diff

&#x20;  - branches

&#x20;  - commits

&#x20;  - pull requests



3\. QA Agent

&#x20;  - tests

&#x20;  - lint

&#x20;  - build

&#x20;  - validation



4\. Coding Agent

&#x20;  - small and medium code changes

&#x20;  - use lower-cost provider when possible



5\. Architecture Agent

&#x20;  - complex refactors

&#x20;  - cross-module changes

&#x20;  - architecture decisions



\## Provider Routing

\- Local tools first

\- OpenAI/Codex for general coding and implementation

\- Gemini or other providers for secondary review when configured

\- Claude Code only for difficult reasoning or escalation

\- If one provider is unavailable or rate-limited, route to another available provider



\## Token Policy

\- max files per LLM request: 8

\- max lines per file: 500

\- prefer diff over full files

\- do not resend unchanged files

\- do not include full chat history

\- expand context only after failure



\## Safety

\- work on branches

\- do not modify production directly

\- preserve existing functionality

\- log agent actions

