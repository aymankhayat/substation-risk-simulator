#!/usr/bin/env bash
# Restore the Claude skill library in a fresh cloud session.
#
# Cloud sessions start from an empty container: ~/.claude is rebuilt every time,
# so a skill library installed by hand is gone by the next session. This script
# re-registers the marketplaces and reinstalls the plugins from GitHub, which is
# the only copy that outlives the container.
#
# It never fails a session start. Every step is optional and the script always
# exits 0, so a network outage or a renamed upstream repo costs you the skills,
# not the session.

set -uo pipefail

log() { printf '[claude-skills] %s\n' "$*" >&2; }

command -v claude >/dev/null 2>&1 || { log "claude CLI not on PATH; nothing to do"; exit 0; }

# marketplace name : GitHub repo : plugin to install from it
ENTRIES=(
  "agentic-awesome-skills:sickn33/antigravity-awesome-skills:agentic-awesome-skills"
  "impeccable:pbakaus/impeccable:impeccable"
  "taste-skill:Leonxlnx/taste-skill:taste-skill"
)

# Already installed means a local machine or a warm container; re-adding a
# marketplace there would drop its plugins and reinstall them for no reason.
if claude plugin list 2>/dev/null | grep -q "impeccable@impeccable"; then
  log "skills already installed; leaving them alone"
  exit 0
fi

for entry in "${ENTRIES[@]}"; do
  IFS=: read -r market repo plugin <<<"$entry"

  if claude plugin marketplace list 2>/dev/null | grep -q "> ${market}$"; then
    log "marketplace ${market} already known"
  elif timeout 180 claude plugin marketplace add "$repo" >/dev/null 2>&1; then
    log "added marketplace ${market} from ${repo}"
  else
    log "could not add marketplace ${market} from ${repo}; skipping"
    continue
  fi

  if timeout 180 claude plugin install "${plugin}@${market}" >/dev/null 2>&1; then
    log "installed ${plugin}@${market}"
  else
    log "could not install ${plugin}@${market}"
  fi
done

log "done; plugin skills bind at session start, so they are live from the next session on"
exit 0
