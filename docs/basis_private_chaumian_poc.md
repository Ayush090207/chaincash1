# Private Basis: Chaumian E-Cash Variant

This document outlines a design for a **Private Basis** scheme, which adds Chaumian-style privacy (blind signatures) to the existing Basis on-chain reserve model.

## Threat Model and Goals

*   **Goal**: Enable users to withdraw, transfer, and redeem notes such that the **Reserve/Issuer** cannot link a specific withdrawal to a specific redemption.
*   **Privacy**: Unlinkability of sender and receiver from the issuer.
*   **Security**: Prevention of double-spending (redeeming the same note twice) and inflation (redeeming more than issued).
*   **Trust**:
    *   **Issuer**: Trusted to back the value but untrusted for privacy (Blind Sig).
    *   **Tracker**: Minimally trusted for state availability, but in this private scheme, the Tracker primarily prevents double-spending of *active* notes during off-chain transfers (if applicable) or the On-Chain Contract prevents double redemption.

## Roles

1.  **Reserve (Mint)**: Holds on-chain funds. Issues (signs) blind notes.
2.  **User**: Withdraws blind notes, transfers them (off-chain), or redeems them (on-chain).
3.  **Tracker**: (Optional for pure cash, required for managed state) Maintains off-chain nullifier sets or facilitates transfers.

## Key Material

*   **Reserve Key ($P$)**: Public key of the reserve ($P = xG$). Used to verify Schnorr signatures on notes.
*   **User Keys**: Ephemeral keys used for receiving payments (if using p2p transfer) or simply holding bearer tokens.

## Note Structure

A Private Basis Note is a **Bearer Token**.
*   **Denomination ($v$)**: Value of the note. (Fixed denominations simplify privacy, but arbitrary is possible if blinded).
*   **Serial ($S$)**: Random 256-bit integer (nonce), chosen by the User.
*   **Blind Signature ($\sigma$)**: A cryptographic signature on $S$ from the Reserve Key $P$.
    *   $\sigma = (R', s')$ where $R'$ is a point and $s'$ is a scalar.
*   **Note**: $N = (v, S, \sigma)$.

## Protocol Flows

### 1. Withdraw (Minting)
User wants a note of value $v$.
1.  **Request**: User generates random Serial $S$ and blinding factors. Computes blinded challenge $c$. Sends $c$ to Reserve.
2.  **Payment**: User provides proof of payment (e.g., sending funds to Reserve, or increasing debt limit).
3.  **Sign**: Reserve signs $c$ using private key $x$, returning blind response $s$.
4.  **Unblind**: User unblinds $s$ to get $\sigma = (R', s')$.
5.  **Result**: User holds valid note $N = (v, S, \sigma)$. Reserve knows it signed *something*, but not $S$.

### 2. Pay (Off-Chain Transfer)
User A sends Note $N$ to User B.
*   **Standard Chaumian**: "Swap at Mint". A sends $N$ to B. B contacts Mint to "swap" $N$ for fresh $N'$.
    *   *Problem*: Requires online Mint and breaks offline cash.
*   **Basis / Bearer**: A sends $N$ to B. B verifies $\sigma$ on $S$.
    *   *Risk*: A provides a copy to B but keeps one. Double-spending risk.
    *   *Mitigation*: Trusted Hardware, or "Online Tracker" (B checks nullifier $S$ with Tracker before accepting).

### 3. Redeem (On-Chain)
User wants to convert Note $N$ back to on-chain funds (ERG).
1.  **Transaction**: User constructs a transaction spending the Reserve Box.
2.  **Input**: The Reserve Box (holding $P$ and Spent Tree).
3.  **Args**: Note $N = (v, S, \sigma)$.
4.  **Contract Logic**:
    *   **Verify Sig**: Check valid Schnorr signature $\sigma$ on $S$ by $P$.
    *   **Check Nullifier**: Check if $S$ is already in the Spent Tree (R5).
    *   **Update Tree**: Insert $S$ into Spent Tree.
    *   **Payout**: Send $v$ ERG to User's address.

## Double-Spend Protection

Analogous to the transparent Basis, we use an on-chain **AVL Tree** (or Merkle Tree) stored in the Reserve registers (`R5`) to track **Spent Nullifiers (Serials)**.

*   **Nullifier Set**: A collection of all $S$ that have been redeemed.
*   **Enforcement**: The contract mandates that any redemption must successfully insert $S$ into the tree. If $S$ exists, the script fails.

## Privacy Properties

*   **Unlinkability**: The Reserve signed the blinded serial. When $S$ appears on-chain during redemption, the Reserve cannot mathematically link it to the issuance transaction.
*   **Anonymity**: The implementation of the redemption transaction (e.g., using a fresh address or mixer) ensures the User's identity remains hidden.

## Preservation of Basis Principles

This design preserves the core Basis architecture:
*   **On-Chain Backing**: Funds are locked in a contract.
*   **Off-Chain Circulation**: Notes exist as data packets.
*   **State Tracking**: Instead of detailed "Liability" tracking, the on-chain state tracks "Spent Nullifiers".
