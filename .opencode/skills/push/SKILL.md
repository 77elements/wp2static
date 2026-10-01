---
name: push
description: Merge development into main, push to remote, return to development branch. Only use when user explicitly says "push".
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(git *)
---

# Git Push Workflow

Merge development into main, push, and return to development.

## Steps

1. Merge development into main:
   ```
   git checkout main && git merge development
   ```

2. Push both branches:
   ```
   git push && git checkout development && git push origin development
   ```

3. Confirm: "Back at development branch. Awaiting instructions."
