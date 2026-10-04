# Claude Code setup for this repo

This directory only configures the assistant. Nothing here is part of the
simulator, and nothing here is read by `index.html`, the engine, or the tests.

## Why it exists

A cloud session runs in a container that is built fresh and thrown away. The
home directory goes with it, so a skill library installed by hand is gone by the
next session. The repository is the one thing that gets cloned every time, which
makes it the only place a setup step can live.

`hooks/restore-claude-skills.sh` runs at session start and reinstalls three
plugin marketplaces from GitHub:

| Marketplace | Source | What it brings |
|---|---|---|
| `agentic-awesome-skills` | `sickn33/antigravity-awesome-skills` | ~2,576 general skills |
| `impeccable` | `pbakaus/impeccable` | frontend design direction, 4 agents, 24 commands |
| `taste-skill` | `Leonxlnx/taste-skill` | 13 design variants |

A cold run takes about a minute. If the library is already installed, the script
notices and exits without touching anything, so it costs nothing on a local
machine or a warm container.

## The skills no plugin carries

The upstream bundle calls itself the "plugin-safe" distribution, and it is a
subset: 2,576 of the 2,667 skills in the repository's own `skills/` directory.
About 90 have no plugin to install them, among them `claude-code-expert`,
`using-git-worktrees`, `delegating-to-agents`, `manage-skills` and
`agent-creator`.

So the script has a second phase. It sparse-checks out that directory and copies
only the skills the plugins do not already provide, skipping the ~20 that the
claude.ai account or the synced plugins serve under a prefixed name. Copying the
directory wholesale would register every skill twice, once bare and once
prefixed, and pay for about 126k tokens of descriptions for a second time.

## What it will not do

The script never fails a session start. Each step is optional and it always
exits 0, so a network outage or a renamed upstream repo costs you the skills
rather than the session.

Skills do become available in the session that installs them. The CLI reports a
freshly installed plugin as `enabled` rather than `loaded`, which reads like it
is waiting for a restart, but the registry rescans and the skills are invokable
once it does.

## A caveat worth reading

These are roughly 2,600 skills from community repositories, and each one is a
set of instructions that can steer the assistant. They are third-party content
on the same footing as any other dependency you would pull from GitHub. The
marketplaces are pinned to repositories rather than commits, so an upstream
change arrives on the next session start without review.

## Running it by hand

```bash
bash .claude/hooks/restore-claude-skills.sh
```

## Turning it off

Delete `settings.json`, or drop the `SessionStart` block from it. The hook is
the only thing wired up, so removing it leaves the repo with no assistant
configuration at all.
