UPDATE "AdminControl"
SET "adminCount" = (SELECT COUNT(*) FROM "User" WHERE "role" = 'ADMIN');
