# Changelog

## 0.2.1

- Packaging/docs only; no runtime change since 0.2.0.
- Published to npm (`dsh-drag-workspace@0.2.0` was the first public release,
  `0.2.1` republishes the same tree after the registry finished provisioning
  the new scope-less name).
- Added `.github/workflows/publish.yml`: publishes through npm Trusted
  Publishing (OIDC) with provenance once a trusted publisher is configured,
  so no npm token or 2FA code is needed in CI.
- `PUBLISHING.md` now documents the verified local toolchain (PortableGit,
  npm, DSH runtime node) and the 2FA/bypass-token constraints that affected
  the first publish.

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
