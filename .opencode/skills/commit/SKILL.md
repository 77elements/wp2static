---
name: commit
description: Commit all changes with a short message. Only use when user explicitly says "commit" or "feature ok".
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(git *)
---

# Git Commit Workflow

Commit all staged and unstaged changes.

## Rules

- **Trigger:** ONLY on explicit user approval ("commit" / "feature ok")
- **Format:** `git add . && git commit -m "[msg]"`
- **Language:** ALWAYS English, regardless of the conversation language. The German chat thread is for collaboration; commits stay English so the history is readable by anyone scanning the repo (including future contributors and code-review tools).
- **Message style:** Short one-liner, no prefixes, no scopes
- NO selective adds
- NO `git log`
- NO `git diff` before or after
- NO AI/tool signatures or Co-Authored-By lines

## Steps

1. If this is the FIRST commit ever (repo has no commits yet):
   ```
   git branch -M main && git add . && git commit -m "[msg]" && git checkout -b development
   ```
   (creates main, commits, creates + switches to development)
2. Otherwise: `git add . && git commit -m "$ARGUMENTS"` (if user provided a message)
3. If no message provided, write a short descriptive one-liner based on the work done
4. Done. Say nothing extra.
