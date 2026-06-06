-- Adds staff_invitations, api_keys, and the three oauth_* tables.
-- IDEMPOTENT ON PURPOSE: production (and any env synced via `prisma db push`)
-- already has these tables even though no migration created them — this
-- migration exists so fresh environments built purely from `migrate deploy`
-- get them too. Every statement is guarded so it no-ops where they exist.

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_invitations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "key_prefix" VARCHAR(12) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'admin',
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_clients" (
    "id" UUID NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "redirect_uris" TEXT[],
    "grant_types" TEXT[] DEFAULT ARRAY['authorization_code']::TEXT[],
    "response_types" TEXT[] DEFAULT ARRAY['code']::TEXT[],
    "scope" VARCHAR(255) NOT NULL DEFAULT 'mcp',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_authorization_codes" (
    "id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scope" VARCHAR(255),
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" VARCHAR(10) NOT NULL DEFAULT 'S256',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_access_tokens" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "token_prefix" VARCHAR(16) NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "scope" VARCHAR(255) NOT NULL DEFAULT 'mcp',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_invitations_business_id_idx" ON "staff_invitations"("business_id");
CREATE INDEX IF NOT EXISTS "staff_invitations_email_idx" ON "staff_invitations"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_business_id_idx" ON "api_keys"("business_id");
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_clients_client_id_key" ON "oauth_clients"("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_authorization_codes_code_hash_key" ON "oauth_authorization_codes"("code_hash");
CREATE INDEX IF NOT EXISTS "oauth_authorization_codes_client_id_idx" ON "oauth_authorization_codes"("client_id");
CREATE INDEX IF NOT EXISTS "oauth_authorization_codes_expires_at_idx" ON "oauth_authorization_codes"("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_access_tokens_token_hash_key" ON "oauth_access_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "oauth_access_tokens_client_id_idx" ON "oauth_access_tokens"("client_id");
CREATE INDEX IF NOT EXISTS "oauth_access_tokens_user_id_idx" ON "oauth_access_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "oauth_access_tokens_expires_at_idx" ON "oauth_access_tokens"("expires_at");

-- AddForeignKey (guarded: ADD CONSTRAINT has no IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_invitations_business_id_fkey') THEN
    ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_invitations_invited_by_id_fkey') THEN
    ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_business_id_fkey') THEN
    ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_created_by_id_fkey') THEN
    ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_authorization_codes_client_id_fkey') THEN
    ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_access_tokens_client_id_fkey') THEN
    ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
