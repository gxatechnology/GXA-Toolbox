-- Link application data to Netlify Identity without removing legacy accounts.
-- Passwords, OAuth tokens, and Identity sessions remain owned by Netlify Identity.

CREATE TABLE IF NOT EXISTS public.user_profiles (
    identity_user_id TEXT PRIMARY KEY,
    legacy_user_id BIGINT UNIQUE,
    email VARCHAR(254) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'email',
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    CONSTRAINT user_profiles_legacy_user_fk FOREIGN KEY (legacy_user_id) REFERENCES public.users (id) ON DELETE SET NULL,
    CONSTRAINT user_profiles_email_normalized CHECK (email = LOWER(BTRIM(email))),
    CONSTRAINT user_profiles_full_name_not_blank CHECK (CHAR_LENGTH(BTRIM(full_name)) >= 1),
    CONSTRAINT user_profiles_provider_not_blank CHECK (CHAR_LENGTH(BTRIM(provider)) >= 1),
    CONSTRAINT user_profiles_status_valid CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NOT NULL DEFAULT 'email';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'user_profiles_provider_not_blank'
           AND conrelid = 'public.user_profiles'::regclass
    ) THEN
        ALTER TABLE public.user_profiles
            ADD CONSTRAINT user_profiles_provider_not_blank
            CHECK (CHAR_LENGTH(BTRIM(provider)) >= 1);
    END IF;
END
$$;

ALTER TABLE public.file_jobs
    ADD COLUMN IF NOT EXISTS identity_user_id TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'file_jobs_identity_user_fk'
           AND conrelid = 'public.file_jobs'::regclass
    ) THEN
        ALTER TABLE public.file_jobs
            ADD CONSTRAINT file_jobs_identity_user_fk
            FOREIGN KEY (identity_user_id)
            REFERENCES public.user_profiles (identity_user_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS file_jobs_identity_user_created_idx
    ON public.file_jobs (identity_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS file_jobs_identity_user_status_idx
    ON public.file_jobs (identity_user_id, status);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_trigger
         WHERE tgname = 'user_profiles_set_updated_at'
           AND tgrelid = 'public.user_profiles'::regclass
           AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER user_profiles_set_updated_at
        BEFORE UPDATE ON public.user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.gxa_set_updated_at();
    END IF;
END
$$;
