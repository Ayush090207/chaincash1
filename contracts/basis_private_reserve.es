{
    // Private Basis Reserve Contract (PoC)
    // Supports redemption of Chaumian-style blind-signed notes.

    // Registers:
    //  - R4: Reserve Owner Public Key (GroupElement)
    //  - R5: Spent Nullifiers Tree (AvlTree)
    //
    // Actions:
    //  - 1: Top Up
    //  - 3: Redeem Private Note

    val v = getVar[Byte](0).get
    val action = v / 10
    val index = v % 10

    val ownerKey = SELF.R4[GroupElement].get
    val selfOut = OUTPUTS(index)

    // Preservation Check
    val selfPreserved =
            selfOut.propositionBytes == SELF.propositionBytes &&
            selfOut.tokens == SELF.tokens &&
            selfOut.R4[GroupElement].get == SELF.R4[GroupElement].get

    if (action == 3) {
      // --- Redeem Private Note ---

      // Note Data
      val serial = getVar[Coll[Byte]](1).get       // The Nullifier / Serial
      val noteValue = getVar[Long](2).get          // Value of the note
      
      // Signature (R', s')
      val sigBytes = getVar[Coll[Byte]](3).get
      val rPrimeBytes = sigBytes.slice(0, 33)
      val sPrimeBytes = sigBytes.slice(33, sigBytes.size)
      
      val receiver = getVar[GroupElement](4).get   // Payee

      // 1. Verify Blind Signature
      // Message m = Hash(Serial) (or Serial itself if small, but Hash is safer for uniform size)
      // Ideally, the signature should cover the VALUE too, otherwise User can claim any value for a signed Serial.
      // In this PoC, we assume the blind signature was on Hash(Serial || Value).
      val valueBytes = longToByteArray(noteValue)
      val message = blake2b256(serial ++ valueBytes)

      val rPrime = decodePoint(rPrimeBytes)
      val sPrime = byteArrayToBigInt(sPrimeBytes)
      val g: GroupElement = groupGenerator

      // g^s' = R' * P^e
      val e: Coll[Byte] = blake2b256(rPrimeBytes ++ message)
      val eInt = byteArrayToBigInt(e)
      
      val properSignature = g.exp(sPrime) == rPrime.multiply(ownerKey.exp(eInt))

      // 2. Double Spend Prevention (Nullifier)
      val spentTree = SELF.R5[AvlTree].get
      val proof = getVar[Coll[Byte]](5).get
      
      // Key = Serial, Value = BlockHeight (or 1)
      val insertOp = (serial, longToByteArray(HEIGHT))
      val nextTreeOpt = spentTree.insert(Coll(insertOp), proof)

      val treeUpdated = if (nextTreeOpt.isDefined) {
          val nextTree = nextTreeOpt.get
          selfOut.R5[AvlTree].get == nextTree
      } else {
          false
      }

      // 3. Payout
      val redeemedAmount = SELF.value - selfOut.value
      val properPayout = redeemedAmount <= noteValue
      val receiverCondition = proveDlog(receiver)

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
       sigmaProp(false)
    }
}
