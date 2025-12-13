# Private Basis PoC: Summary for Pull Request

## Changes Implemented

### Documentation
*   **Analysis**: Added `docs/basis_current_design.md` summarizing the existing transparent Basis architecture.
*   **Design**: Added `docs/basis_private_chaumian_poc.md` detailing the new Private Basis scheme using Blind Schnorr Signatures and on-chain nullifier tracking.

### Contracts (ErgoScript)
*   **New Contract**: Created `contracts/basis_private_reserve.es`.
    *   Implements `Action 3: Redeem Private Note`.
    *   Verifies a Blind Schnorr Signature on the note's Serial.
    *   Enforces double-spend prevention by checking and updating the **Spent Nullifiers Tree** in register `R5`.

### Rust Logic (chaincash_offchain)
*   **New Module**: Added `crates/chaincash_offchain/src/private_reserve.rs` (and exported in `lib.rs`).
    *   **BlindSigner Trait**: Abstract interface for blinding, signing, and verifying.
    *   **MockBlindSigner**: PoC implementation of the signer (mocks cryptographic math).
    *   **PrivateReserveState**: In-memory tracking of spent nullifiers to simulate off-chain state mirroring.
    *   **Service & Tests**: Implemented `withdraw`, `transfer` (verify), and `redeem` flows in a `PrivateReserveService` struct, coupled with tests.

## Notes & Future Work
*   **Cryptography**: The current Rust implementation uses a `MockBlindSigner`. Real world usage requires a proper blinded Schnorr library (e.g., using `k256` arithmetic).
*   **ErgoScript**: The contract uses `g.exp(s) == R * P^e`. This manual verification is sound but needs careful gas analysis and integration with the specific blind signature scheme chosen.
*   **Verification**: Automated tests (`cargo test`, `sbt test`) could not be run in the current environment due to missing binaries. Manual code review was performed.

## PR Checklist
- [x] Documentation: Current Design & Private Scheme Docs (docs/)
- [x] Contract: `basis_private_reserve.es` (contracts/)
- [x] Rust: `private_reserve.rs` module with tests (chaincash_offchain)
- [x] Integration: Exported module in `lib.rs`
