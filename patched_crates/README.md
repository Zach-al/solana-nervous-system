# Patched Crates

This directory contains vendored crates with local modifications.
Auditors: please review this file to understand why we maintain local patches.

## aes-gcm-siv

**Reason for patch:** The upstream `aes-gcm-siv` crate (v0.11.x) pulls in a
`universal-hash` version that conflicts with the `polyval` dependency tree
required by our pinned `libp2p` noise transport. The conflict prevents
`cargo build` from resolving a compatible dependency graph.

**Upstream issue:** https://github.com/RustCrypto/AEADs/issues/541

**Changes made:**
- Pinned `universal-hash` to `=0.5.1` in the local `Cargo.toml`.
- No changes to any cryptographic algorithm implementation.
- No changes to test vectors or the AEAD interface.

**Migration plan:** Remove this patch when `aes-gcm-siv` releases a version
(likely 0.12.x) that is compatible with `universal-hash 0.5.x` natively,
or when `libp2p` upgrades its noise dependency chain.

**Last reviewed:** 2026-04-18
