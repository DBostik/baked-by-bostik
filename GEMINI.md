# Agent Directives for Baked By Bostik

## 1. Deployment Protocol
**CRITICAL**: When asked to deploy changes, push code, or alter project architecture, you MUST read and follow the instructions located in `DEPLOY.md` at the root of the workspace.

*   **Standard Deploy**: Committing and pushing to the `main` branch automatically deploys the site to Firebase via GitHub Actions.
*   **Do Not Run Local Firebase Deployments**: Running `firebase deploy` directly from the AI agent will hang due to authentication requirements. Always push to GitHub instead.

## 2. Git & GitHub Push Instructions
*   When committing, remember to temporarily move the git log to avoid lock issues in the VM environment:
    ```bash
    mv .git/logs .git/logs.hold
    git -c core.logAllRefUpdates=false commit -m "Your message"
    mv .git/logs.hold .git/logs
    ```
*   When pushing, use the secure token saved on the local machine:
    ```bash
    mv .git/logs .git/logs.hold
    git -c core.logAllRefUpdates=false push https://x-access-token:$(cat "/Users/davebostik/Desktop/My Info For Claude/github-token.txt")@github.com/DBostik/baked-by-bostik.git main
    mv .git/logs.hold .git/logs
    ```
