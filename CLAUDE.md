# Working rules

Standing instructions for this repo. They apply without being restated.

## Use the skills, don't ask first

The skill library is installed by `.claude/hooks/restore-claude-skills.sh`.
When a skill fits the task, invoke it. Do not ask permission, do not announce
the intention and wait, and do not list candidates for selection. A fitting
skill that goes uninvoked is a worse outcome than one invoked unnecessarily.

Order matters when several apply:

1. **Design and architecture lead.** `impeccable`, the `taste-skill:*` set, and
   `design:*` set direction before any code is written. Direction chosen after
   implementation is just a justification of what already exists.
2. **Implementation and review follow.** `engineering:*`, `code-review`,
   `security-review`, `simplify`.
3. **Prose cleanup runs last.** `unslop`, `de-ai-writer`, `avoid-ai-writing`,
   `professional-proofreader`. Running these first wastes the pass, because
   later edits reintroduce what they removed.

## Raise the quality, not the scope

Do the task that was asked, to a standard higher than the minimum that passes.
Tests, edge cases, error paths and naming are part of the task, not extras.

Scope is a different axis. Do not add features, refactors or files that were
not asked for. If something outside the task looks wrong, say so in a sentence
and carry on with the task.

## Prose standards

Everything written for a person to read follows these, including commit
messages, README and documentation copy, PR descriptions, and anything
destined for a CV, portfolio page or LinkedIn post.

**Punctuation and characters**

- No em dashes. Use a comma, a colon, a full stop, or restructure.
- No invisible or non-ASCII lookalike characters: zero-width spaces, non-breaking
  spaces, curly quotes where straight ones belong.
- No arrows appended to link or button text.

**Vocabulary to cut**

Delve, leverage as a verb, utilize, robust, seamless, elevate, unlock, harness,
empower, navigate the landscape, testament to, at its core, it's worth noting,
in today's fast-paced, game-changer, cutting-edge, best-in-class. Say the plain
thing instead.

**Structure**

- Do not open by restating the question.
- Do not close by summarizing what was just said.
- Vary sentence length. Uniform medium-length sentences are the clearest tell.
- Avoid the tricolon reflex: three parallel adjectives or clauses in a row, over
  and over.
- Do not accent a single word in a heading with italics, bold or color.
- Avoid "It's not just X, it's Y" and "This isn't about X. It's about Y."

**Substance**

- A specific number beats an adjective. "33 responsive rules never fired" is
  worth more than "significant responsive issues".
- Claim only what was verified, and say how it was verified.
- Cut any sentence that would survive deletion without loss.

## Verify before claiming

Run the tests, the build check, or the command, and quote the real output. Do
not report something as working on the strength of having written it. If a step
was skipped or a check failed, say which, in plain words.
