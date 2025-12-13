{
    // Contract for Private Basis (Proof of Concept)
    // Enhances Basis with Chaumian E-Cash features using Blind Schnorr Signatures.

    // Data:
    //  - R4: Reserve Owner Public Key (P)
    //  - R5: Tree of spent Serials (to prevent double spending)
    //
    // Actions:
    //  - 0: Classic Redemption (from basis.es) - Omitted/Simplified for PoC
    //  - 1: Top Up
    //  - 3: Redeem Private Note (New)

    val v = getVar[Byte](0).get
    val action = v / 10
    val index = v % 10

    val ownerKey = SELF.R4[GroupElement].get
    val selfOut = OUTPUTS(index)

    // Common preservation check
    val selfPreserved =
            selfOut.propositionBytes == SELF.propositionBytes &&
            selfOut.tokens == SELF.tokens &&
            selfOut.R4[GroupElement].get == SELF.R4[GroupElement].get

    if (action == 3) {
      // --- Redeem Private Note ---
      // User provides a "Serial" and a valid Blind Signature on it from the Owner.
      // Unlike classic Basis, we don't need a Tracker here for the "Note" validity,
      // because the Signature itself proves the Issuer (Owner) authorized this value.
      // Privacy comes from the fact that Issuer signed a blinded version and doesn't know 'Serial'.

      // Inputs (Variables)
      val serial = getVar[Coll[Byte]](1).get       // The unique Serial Number of the note
      val noteValue = getVar[Long](2).get          // The value this note represents (signed in the blind sig?)
                                                   // NOTE: In simple Schnorr, message is flexible.
                                                   // We assume Message = Hash(Serial || Value) or just Serial if Value is fixed.
                                                   // For this PoC, let's assume valid sig implies valid fixed value (e.g. 1 unit)
                                                   // OR we include Value in the signed message.
                                                   // Let's use Message = Serial ++ ValueBytes

      val sigBytes = getVar[Coll[Byte]](3).get     // The Unblinded Signature (R', s') provided by User
      // Format: 33 bytes R', 32+ bytes s' (BigInt)

      val receiver = getVar[GroupElement](4).get   // Who gets the ERG

      // 1. Reconstruct Message
      val valueBytes = longToByteArray(noteValue)
      val message = blake2b256(serial ++ valueBytes)

      // 2. Parsed Signature
      val rPrimeBytes = sigBytes.slice(0, 33)
      val sPrimeBytes = sigBytes.slice(33, sigBytes.size)
      val rPrime = decodePoint(rPrimeBytes)
      val sPrime = byteArrayToBigInt(sPrimeBytes)
      val g: GroupElement = groupGenerator

      // 3. Verify Signature: g^s' = R' * P^e
      //    where e = Hash(R' || Message)
      val e: Coll[Byte] = blake2b256(rPrimeBytes ++ message) // Hash(R' || m)
      val eInt = byteArrayToBigInt(e)

      val properSignature = g.exp(sPrime) == rPrime.multiply(ownerKey.exp(eInt))

      // 4. Verify Double Spending (Serial not in R5 Tree)
      val spentTree = SELF.R5[AvlTree].get
      val proof = getVar[Coll[Byte]](5).get
      // We insert the Serial into the tree.
      // key = Serial, value = 1 (or block height)
      val insertOp = (serial, longToByteArray(HEIGHT))
      val nextTreeOpt = spentTree.insert(Coll(insertOp), proof)

      val treeUpdated = if (nextTreeOpt.isDefined) {
          val nextTree = nextTreeOpt.get
          // Verify Output Box has the updated tree
          selfOut.R5[AvlTree].get == nextTree
      } else {
          false // Insert failed (Serial already exists or proof invalid)
      }

      // 5. Verify Payout
      val redeemedAmount = SELF.value - selfOut.value
      val properPayout = redeemedAmount <= noteValue

      val receiverCondition = proveDlog(receiver) // Receiver must sign tx

      sigmaProp(
          selfPreserved &&
          properSignature &&
          treeUpdated &&
          properPayout &&
          receiverCondition
      )

    } else if (action == 1) {
       // Top Up
       sigmaProp(
         selfPreserved &&
         selfOut.value > SELF.value &&
         selfOut.R5[AvlTree].get == SELF.R5[AvlTree].get
       )
    } else {
       // Other actions omitted for PoC
       sigmaProp(false)
    }
}
