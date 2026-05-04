-- Drop FK from User to CompanyRole
ALTER TABLE auth."User" DROP COLUMN IF EXISTS "companyRoleId";

-- Drop CompanyRole table
DROP TABLE IF EXISTS auth."CompanyRole";
