-- Force seed/default accounts to change password on next login
UPDATE "User"
SET "mustChangePassword" = true
WHERE "isDeleted" = false
  AND "email" IN (
    'admin@inventory.local',
    'godown1@inventory.local',
    'godown2@inventory.local'
  );
