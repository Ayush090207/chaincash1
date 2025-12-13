# Basis: Current Transparent Design

This document summarizes the current design of the Basis off-chain cash system, as implemented in `contracts/offchain/basis.es` and described in the associated documentation.

## On-Chain Reserve Contract

The Basis reserve contract is an on-chain script (in ErgoScript) that locks funds (ERG) to back off-chain IOU notes. It enforces the following rules:

1.  **Redemption**: A holder of a valid off-chain note can redeem it for ERG from the reserve. `Action 0`.
    *   **Verification**: The contract verifies a Schnorr signature from the **Reserve Owner** on the note details (Amount, Timestamp, Receiver).
    *   **Tracker Authorization**: Redemption typically requires a signature from a designated **Tracker** to authorize the transaction and update the debt status.
    *   **Double-Spend Prevention**: The contract maintains an on-chain **AVL Tree** in register `R5`. When a note is redeemed, its timestamp (or unique identifier derived from it) is inserted into this tree. The contract checks that the timestamp has not been used before.
    *   **Emergency Redemption**: If the tracker is offline (e.g., no signature), redemption is possible after a timeout (e.g., 7 days) if the note is valid.
    *   **Payout**: The contract ensures the `Redeemed Amount <= Note Debt` and sends payment to the `Receiver`.

2.  **Top Up**: The reserve owner can add more funds to the reserve. `Action 1`.

## Off-Chain Notes

Notes are created and transferred off-chain to enable credit and fast payments.

*   **Structure**: A note represents a debt from `A` to `B`.
    *   `B_pubkey`: Creditor.
    *   `Amount`: Total debt amount.
    *   `Timestamp`: Unique monotonically increasing identifier for the state.
    *   `Sig_A`: Signature of the debtor (Reserve Owner) on `(B_pubkey, Amount, Timestamp)`.
*   **Transfer**: To pay `C`, `B` could redeem the note or `A` can issue a new note to `C` (updating the debt ledger). In the current "Basis" description, it focuses on `A->B` bilateral links tracked by a third party.

## Double-Spend Prevention

Double spending of the *reserve* (redeeming the same debt twice) is prevented by the **Spent Tree** (AVL Tree) stored in the reserve's UTXO.
*   **Mechanism**: Every redemption adds a unique key (derived from the Timestamp/Note ID) to the tree.
*   **Enforcement**: The contract requires a proof that the new key is *not* already in the tree (for insertion) or just inserts it and fails if it exists (depending on tree op). `basis.es` uses `insert` which fails if key exists.

## Transparency & Privacy Issues

The current design is **fully transparent**:
1.  **Linkability**: The on-chain redemption transaction reveals:
    *   **Reserve Owner** (Input Box).
    *   **Receiver** (Output Box).
    *   **Note Value** (Redeemed Amount).
    *   **Note ID/Timestamp** (Inserted into the tree).
2.  **Implication**: An observer can see exactly which off-chain note (issued at a specific time for a specific amount) was redeemed by which user. There is no anonymity for the redeemer relative to the issuer or the public blockchain.
