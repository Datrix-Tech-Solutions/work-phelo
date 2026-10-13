-- Business domain ownership verification uses a dedicated permission action.
ALTER TYPE "w_auth"."PermissionAction" ADD VALUE IF NOT EXISTS 'VERIFY';
