ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

CREATE TABLE "AdminControl" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "adminCount" INTEGER NOT NULL DEFAULT 0,
    "superAdminId" TEXT,
    CONSTRAINT "AdminControl_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AdminControl" ("id", "adminCount") VALUES (1, 0);
