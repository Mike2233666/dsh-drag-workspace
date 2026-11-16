# Changelog

## 0.2.0

- Cross-workspace move is now built in: the host registers
  `POST /dsh-drag-workspace/api/move` and runs the move pipeline itself.
- Vendored the move pipeline from `dsh-session-manager` v0.7.8 (MIT) instead of
  calling its HTTP API; the vendored plugin is booted against a shadow context,
  so its own routes, boot reconciliation and update checks stay off.
- No third-party plugin dependency remains.
- Added offline tests: client drag wiring, host route registration, and a real
  artifact move against a throwaway `DSH_HOME`.

## 0.1.0

- First local build: drag a session row onto another workspace header and call
  `dsh-session-manager`'s `/session-manager/api/move`.
