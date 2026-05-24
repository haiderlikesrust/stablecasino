-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nonce" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "betAmount" TEXT NOT NULL,
    "betUsdc" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "outcome" TEXT,
    "payoutUsdc" TEXT,
    "playerHand" JSONB NOT NULL,
    "dealerHand" JSONB NOT NULL,
    "deckSeed" TEXT NOT NULL,
    "deckCursor" INTEGER NOT NULL DEFAULT 0,
    "doubledDown" BOOLEAN NOT NULL DEFAULT false,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "escrowSig" TEXT,
    "escrowConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "payoutTx" TEXT,
    "burnTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSnapshot" (
    "id" TEXT NOT NULL,
    "pendingLamports" TEXT NOT NULL,
    "collectedLamports" TEXT NOT NULL,
    "bankrollAllocLamports" TEXT NOT NULL,
    "airdropAllocLamports" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionRound" (
    "id" TEXT NOT NULL,
    "totalLamports" TEXT NOT NULL,
    "holderSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txSignature" TEXT,

    CONSTRAINT "DistributionRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT,
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Nonce_nonce_key" ON "Nonce"("nonce");

-- CreateIndex
CREATE INDEX "Nonce_wallet_idx" ON "Nonce"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Game_userId_idx" ON "Game"("userId");

-- CreateIndex
CREATE INDEX "Game_state_idx" ON "Game"("state");

-- CreateIndex
CREATE INDEX "LedgerEntry_kind_idx" ON "LedgerEntry"("kind");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
