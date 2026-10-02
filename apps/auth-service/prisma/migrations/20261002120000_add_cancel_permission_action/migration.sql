-- Marketing follow-ups gate cancellation on a dedicated CANCEL action.
ALTER TYPE "w_auth"."PermissionAction" ADD VALUE IF NOT EXISTS 'CANCEL';
