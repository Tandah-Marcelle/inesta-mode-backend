-- Update existing customer roles to user
UPDATE users SET role = 'user' WHERE role = 'customer';

-- Update the enum type
ALTER TYPE "public"."users_role_enum" RENAME TO "users_role_enum_old";
CREATE TYPE "public"."users_role_enum" AS ENUM('super_admin', 'admin', 'user');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::text::"public"."users_role_enum";
DROP TYPE "public"."users_role_enum_old";