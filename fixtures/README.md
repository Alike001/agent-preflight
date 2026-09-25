# Synthetic fixtures

Every fixture in this directory is synthetic. None contains a real workflow export, credential, wallet secret, customer record, or production response.

- `valid/` and `invalid/` cover the Day 1 parser and graph boundary.
- `mvp/structurally-broken.json` demonstrates deterministic graph failure.
- `mvp/semantic-mismatch.json` is structurally valid but semantically incompatible, demonstrating why SERV is required.
- `mvp/excessive-permissions.json` declares intentionally unjustified authority in task text for semantic review.
- `mvp/corrected-control.json` is the compatible control used for the red-to-green demo.

Automated tests use mocked transports only. Production never substitutes fixture output for SERV.
