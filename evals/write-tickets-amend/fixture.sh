# Spec 001 mid-build: ticket 001 is built (frozen), its milestone still open.
PHASE=none
REVIEW=''
. "$(dirname "$0")/../_fixtures/brain.sh"
rm .brain/.local/specs/001-greeting/demo/001-greeting/review.md
printf '\n## Further Notes\n\nNone.\n' >> .brain/.local/specs/001-greeting/spec.md
