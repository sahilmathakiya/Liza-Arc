ALTER TABLE "Account" ADD COLUMN "issuer" TEXT NOT NULL DEFAULT 'local:credential';

ALTER TABLE "Account" ALTER COLUMN "issuer" DROP DEFAULT;

CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");
