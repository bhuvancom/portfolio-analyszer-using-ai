-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tradingSymbol" TEXT NOT NULL,
    "isin" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platform" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisMetadata" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "interval" TEXT NOT NULL DEFAULT '1d',
    "range" TEXT NOT NULL DEFAULT '1y',
    "diversificationScore" TEXT,
    "riskProfile" TEXT,
    "topPerformer" TEXT,
    "worstPerformer" TEXT,
    "rebalancingNeeded" BOOLEAN,
    "portfolioSummary" TEXT,
    "sectorConcentration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AnalysisMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisHoldingSnapshot" (
    "id" SERIAL NOT NULL,
    "metadataId" INTEGER NOT NULL,
    "holdingId" INTEGER,
    "tradingSymbol" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "averagePrice" DOUBLE PRECISION NOT NULL,
    "advice" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "rawJson" JSONB,

    CONSTRAINT "AnalysisHoldingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisMetadata" ADD CONSTRAINT "AnalysisMetadata_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisHoldingSnapshot" ADD CONSTRAINT "AnalysisHoldingSnapshot_metadataId_fkey" FOREIGN KEY ("metadataId") REFERENCES "AnalysisMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
