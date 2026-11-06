# A plain repository with no brain anywhere, holding one uncommitted rename.
set -euo pipefail
git config --global user.name "Eval"
git config --global user.email "eval@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf false
git init -q .
printf 'export function getUser(id) { return { id } }\n' > users.js
printf 'import { getUser } from "./users.js"\ngetUser(1)\n' > app.js
git add -A && git commit -q -m "Starts the app"
sed -i 's/getUser/fetchUser/g' users.js app.js
