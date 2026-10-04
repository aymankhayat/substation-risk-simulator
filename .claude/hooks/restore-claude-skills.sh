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

SKILLS_DIR="${HOME}/.claude/skills"
CACHE_DIR="${HOME}/.claude/plugins/cache"
ANTIGRAVITY_REPO="https://github.com/sickn33/antigravity-awesome-skills.git"

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

# The upstream "plugin-safe" bundle is a subset: it leaves out about 90 skills
# that the repository's own skills/ directory carries. Those have no plugin to
# install them, so copy just those, and only those, to avoid loading every
# skill twice.
restore_plugin_excluded_skills() {
  command -v python3 >/dev/null 2>&1 || { log "python3 missing; skipping excluded skills"; return; }
  [ -d "$CACHE_DIR" ] || { log "no plugin cache; skipping excluded skills"; return; }

  local tmp
  tmp="$(mktemp -d)" || return
  trap 'rm -rf "$tmp"' RETURN

  if ! timeout 300 git clone --depth 1 --filter=blob:none --sparse -q \
        "$ANTIGRAVITY_REPO" "$tmp/ag" 2>/dev/null \
     || ! git -C "$tmp/ag" sparse-checkout set skills >/dev/null 2>&1; then
    log "could not fetch the excluded skills; plugins alone are installed"
    return
  fi

  python3 - "$tmp/ag/skills" "$CACHE_DIR" "$SKILLS_DIR" <<'PY'
import glob, os, shutil, sys
src, cache, dest = sys.argv[1], sys.argv[2], sys.argv[3]

def names(root):
    return {os.path.basename(os.path.dirname(p))
            for p in glob.glob(root + "/**/SKILL.md", recursive=True)}

# Served under a prefixed name by the claude.ai account or the synced plugins;
# copying them here would only duplicate what is already loaded.
elsewhere = {
    "built-in-browser", "chrome-browser", "computer-use", "deep-research",
    "doc-coauthoring", "docs", "docx", "google-workspace", "import-memory",
    "linkedin-content", "linkedin-humanizer", "linkedin-strategy", "mcp-builder",
    "morning", "pdf", "pptx", "skill-creator", "xlsx", "web-artifacts-builder",
    "design-system",
}
covered = names(cache) | elsewhere
os.makedirs(dest, exist_ok=True)

copied = 0
for path in glob.glob(src + "/**/SKILL.md", recursive=True):
    d = os.path.dirname(path)
    name = os.path.basename(d)
    if name in covered or os.path.exists(os.path.join(dest, name)):
        continue
    try:
        shutil.copytree(d, os.path.join(dest, name), symlinks=True)
        copied += 1
    except Exception:
        pass

# A dangling symlink in the upstream layout registers as a broken skill.
for e in os.listdir(dest):
    p = os.path.join(dest, e)
    if os.path.islink(p) and not os.path.exists(p):
        os.unlink(p)

print(f"[claude-skills] copied {copied} skills the plugin bundle leaves out",
      file=sys.stderr)
PY
}

restore_plugin_excluded_skills

log "done"
exit 0
