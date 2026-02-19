BEGIN;

-- Create enum types Prisma expects in schema "projects".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'ProjectStatus'
  ) THEN
    CREATE TYPE projects."ProjectStatus" AS ENUM (
      'draft',
      'in_review',
      'reviewed',
      'active',
      'completed',
      'paused',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'InviteStatus'
  ) THEN
    CREATE TYPE projects."InviteStatus" AS ENUM (
      'pending',
      'accepted',
      'refused',
      'requested',
      'request_rejected',
      'request_approved',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'WorkStreamStatus'
  ) THEN
    CREATE TYPE projects."WorkStreamStatus" AS ENUM (
      'draft',
      'reviewed',
      'active',
      'completed',
      'paused'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'CopilotRequestStatus'
  ) THEN
    CREATE TYPE projects."CopilotRequestStatus" AS ENUM (
      'new',
      'approved',
      'rejected',
      'seeking',
      'canceled',
      'fulfilled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'CopilotApplicationStatus'
  ) THEN
    CREATE TYPE projects."CopilotApplicationStatus" AS ENUM (
      'pending',
      'invited',
      'accepted',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'CopilotOpportunityStatus'
  ) THEN
    CREATE TYPE projects."CopilotOpportunityStatus" AS ENUM (
      'active',
      'completed',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'CopilotOpportunityType'
  ) THEN
    CREATE TYPE projects."CopilotOpportunityType" AS ENUM (
      'dev',
      'qa',
      'design',
      'ai',
      'datascience'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'ScopeChangeRequestStatus'
  ) THEN
    CREATE TYPE projects."ScopeChangeRequestStatus" AS ENUM (
      'pending',
      'approved',
      'rejected',
      'activated',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'CustomerPaymentStatus'
  ) THEN
    CREATE TYPE projects."CustomerPaymentStatus" AS ENUM (
      'canceled',
      'processing',
      'requires_action',
      'requires_capture',
      'requires_confirmation',
      'requires_payment_method',
      'succeeded',
      'refunded',
      'refund_failed',
      'refund_pending'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'ProjectMemberRole'
  ) THEN
    CREATE TYPE projects."ProjectMemberRole" AS ENUM (
      'manager',
      'observer',
      'customer',
      'copilot',
      'account_manager',
      'program_manager',
      'account_executive',
      'solution_architect',
      'project_manager'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'AttachmentType'
  ) THEN
    CREATE TYPE projects."AttachmentType" AS ENUM ('file', 'link');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'EstimationType'
  ) THEN
    CREATE TYPE projects."EstimationType" AS ENUM (
      'fee',
      'community',
      'topcoder_service'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'ValueType'
  ) THEN
    CREATE TYPE projects."ValueType" AS ENUM (
      'int',
      'double',
      'string',
      'percentage'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'TimelineReference'
  ) THEN
    CREATE TYPE projects."TimelineReference" AS ENUM (
      'project',
      'phase',
      'product',
      'work'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'PhaseApprovalDecision'
  ) THEN
    CREATE TYPE projects."PhaseApprovalDecision" AS ENUM ('approve', 'reject');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'projects' AND t.typname = 'CustomerPaymentCurrency'
  ) THEN
    CREATE TYPE projects."CustomerPaymentCurrency" AS ENUM (
      'USD', 'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
      'BAM', 'BBD', 'BDT', 'BGN', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BWP',
      'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CVE', 'CZK',
      'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL',
      'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
      'ILS', 'INR', 'ISK', 'JMD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KRW', 'KYD',
      'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK',
      'MNT', 'MOP', 'MRO', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN',
      'NIO', 'NOK', 'NPR', 'NZD', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
      'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SEK', 'SGD', 'SHP',
      'SLL', 'SOS', 'SRD', 'STD', 'SZL', 'THB', 'TJS', 'TOP', 'TRY', 'TTD', 'TWD',
      'TZS', 'UAH', 'UGX', 'UYU', 'UZS', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF',
      'XPF', 'YER', 'ZAR', 'ZMW'
    );
  END IF;
END $$;

-- Normalize legacy and placeholder values before enum casts.
UPDATE projects.projects
SET status = lower(trim(status::text))
WHERE status IS NOT NULL;

UPDATE projects.project_phases
SET status = lower(trim(status::text))
WHERE status IS NOT NULL;

UPDATE projects.milestones
SET status = lower(trim(status::text))
WHERE status IS NOT NULL;

UPDATE projects.status_history
SET status = lower(trim(status::text))
WHERE status IS NOT NULL;

UPDATE projects.projects
SET status = 'in_review'
WHERE status::text IN ('inreview');
UPDATE projects.project_phases
SET status = 'in_review'
WHERE status::text IN ('inreview');
UPDATE projects.milestones
SET status = 'in_review'
WHERE status::text IN ('inreview');
UPDATE projects.status_history
SET status = 'in_review'
WHERE status::text IN ('inreview');

UPDATE projects.projects
SET status = 'reviewed'
WHERE status::text IN ('planned', 'review');
UPDATE projects.project_phases
SET status = 'reviewed'
WHERE status::text IN ('planned', 'review');
UPDATE projects.milestones
SET status = 'reviewed'
WHERE status::text IN ('planned', 'review');
UPDATE projects.status_history
SET status = 'reviewed'
WHERE status::text IN ('planned', 'review');

UPDATE projects.projects
SET status = 'active'
WHERE status::text IN ('inprogress', 'in_progress');
UPDATE projects.project_phases
SET status = 'active'
WHERE status::text IN ('inprogress', 'in_progress');
UPDATE projects.milestones
SET status = 'active'
WHERE status::text IN ('inprogress', 'in_progress');
UPDATE projects.status_history
SET status = 'active'
WHERE status::text IN ('inprogress', 'in_progress');

UPDATE projects.projects
SET status = 'cancelled'
WHERE status::text = 'canceled';
UPDATE projects.project_phases
SET status = 'cancelled'
WHERE status::text = 'canceled';
UPDATE projects.milestones
SET status = 'cancelled'
WHERE status::text = 'canceled';
UPDATE projects.status_history
SET status = 'cancelled'
WHERE status::text = 'canceled';

UPDATE projects.projects
SET status = 'draft'
WHERE status::text IN ('temporary', 'string', '');
UPDATE projects.project_phases
SET status = 'draft'
WHERE status::text IN ('temporary', 'string', '');
UPDATE projects.milestones
SET status = 'draft'
WHERE status::text IN ('temporary', 'string', '');
UPDATE projects.status_history
SET status = 'draft'
WHERE status::text IN ('temporary', 'string', '');

UPDATE projects.project_member_invites
SET role = replace(replace(lower(trim(role::text)), '-', '_'), ' ', '_')
WHERE role IS NOT NULL;

UPDATE projects.project_members
SET role = replace(replace(lower(trim(role::text)), '-', '_'), ' ', '_')
WHERE role IS NOT NULL;

UPDATE projects.project_member_invites
SET status = replace(replace(lower(trim(status::text)), '-', '_'), ' ', '_')
WHERE status IS NOT NULL;
UPDATE projects.project_member_invites
SET status = 'canceled'
WHERE status::text = 'cancelled';

UPDATE projects.work_streams
SET status = replace(replace(lower(trim(status::text)), '-', '_'), ' ', '_')
WHERE status IS NOT NULL;
UPDATE projects.work_streams
SET status = 'active'
WHERE status::text IN ('inprogress', 'in_progress');

UPDATE projects.copilot_requests
SET status = replace(replace(lower(trim(status::text)), '-', '_'), ' ', '_')
WHERE status IS NOT NULL;
UPDATE projects.copilot_requests
SET status = 'canceled'
WHERE status::text = 'cancelled';
UPDATE projects.copilot_requests
SET status = 'fulfilled'
WHERE status::text IN ('fulfiled', 'fullfilled');

UPDATE projects.copilot_applications
SET status = replace(replace(lower(trim(status::text)), '-', '_'), ' ', '_')
WHERE status IS NOT NULL;
UPDATE projects.copilot_applications
SET status = 'canceled'
WHERE status::text = 'cancelled';

UPDATE projects.copilot_opportunities
SET status = replace(replace(lower(trim(status::text)), '-', '_'), ' ', '_')
WHERE status IS NOT NULL;
UPDATE projects.copilot_opportunities
SET status = 'canceled'
WHERE status::text = 'cancelled';

UPDATE projects.copilot_opportunities
SET type = replace(replace(lower(trim(type::text)), '-', ''), '_', '')
WHERE type IS NOT NULL;
UPDATE projects.copilot_opportunities
SET type = 'datascience'
WHERE type::text IN ('data science', 'data_science');

UPDATE projects.scope_change_requests
SET status = replace(replace(lower(trim(status::text)), '-', '_'), ' ', '_')
WHERE status IS NOT NULL;
UPDATE projects.scope_change_requests
SET status = 'canceled'
WHERE status::text = 'cancelled';

UPDATE projects.customer_payments
SET status = replace(replace(lower(trim(status::text)), '-', '_'), ' ', '_')
WHERE status IS NOT NULL;
UPDATE projects.customer_payments
SET status = 'canceled'
WHERE status::text = 'cancelled';

UPDATE projects.customer_payments
SET currency = upper(trim(currency::text))
WHERE currency IS NOT NULL;

UPDATE projects.project_attachments
SET type = lower(trim(type::text))
WHERE type IS NOT NULL;
UPDATE projects.project_attachments
SET type = 'link'
WHERE type::text = 'url';

UPDATE projects.timelines
SET reference = lower(trim(reference::text))
WHERE reference IS NOT NULL;

UPDATE projects.project_settings
SET "valueType" = lower(trim("valueType"::text))
WHERE "valueType" IS NOT NULL;

UPDATE projects.project_estimation_items
SET type = replace(replace(lower(trim(type::text)), '-', '_'), ' ', '_')
WHERE type IS NOT NULL;

-- Validate remaining values so casts fail early with clear messages.
DO $$
DECLARE
  bad_values text;
BEGIN
  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.projects
    WHERE status IS NOT NULL
      AND status::text NOT IN (
        'draft', 'in_review', 'reviewed', 'active', 'completed', 'paused', 'cancelled'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.projects.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.project_phases
    WHERE status IS NOT NULL
      AND status::text NOT IN (
        'draft', 'in_review', 'reviewed', 'active', 'completed', 'paused', 'cancelled'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_phases.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.milestones
    WHERE status IS NOT NULL
      AND status::text NOT IN (
        'draft', 'in_review', 'reviewed', 'active', 'completed', 'paused', 'cancelled'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.milestones.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.status_history
    WHERE status IS NOT NULL
      AND status::text NOT IN (
        'draft', 'in_review', 'reviewed', 'active', 'completed', 'paused', 'cancelled'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.status_history.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT role::text AS v
    FROM projects.project_members
    WHERE role IS NOT NULL
      AND role::text NOT IN (
        'manager', 'observer', 'customer', 'copilot', 'account_manager',
        'program_manager', 'account_executive', 'solution_architect', 'project_manager'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_members.role: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT role::text AS v
    FROM projects.project_member_invites
    WHERE role IS NOT NULL
      AND role::text NOT IN (
        'manager', 'observer', 'customer', 'copilot', 'account_manager',
        'program_manager', 'account_executive', 'solution_architect', 'project_manager'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_member_invites.role: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.project_member_invites
    WHERE status IS NOT NULL
      AND status::text NOT IN (
        'pending', 'accepted', 'refused', 'requested', 'request_rejected',
        'request_approved', 'canceled'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_member_invites.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.work_streams
    WHERE status IS NOT NULL
      AND status::text NOT IN ('draft', 'reviewed', 'active', 'completed', 'paused')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.work_streams.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.copilot_requests
    WHERE status IS NOT NULL
      AND status::text NOT IN ('new', 'approved', 'rejected', 'seeking', 'canceled', 'fulfilled')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.copilot_requests.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.copilot_applications
    WHERE status IS NOT NULL
      AND status::text NOT IN ('pending', 'invited', 'accepted', 'canceled')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.copilot_applications.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.copilot_opportunities
    WHERE status IS NOT NULL
      AND status::text NOT IN ('active', 'completed', 'canceled')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.copilot_opportunities.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT type::text AS v
    FROM projects.copilot_opportunities
    WHERE type IS NOT NULL
      AND type::text NOT IN ('dev', 'qa', 'design', 'ai', 'datascience')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.copilot_opportunities.type: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.scope_change_requests
    WHERE status IS NOT NULL
      AND status::text NOT IN ('pending', 'approved', 'rejected', 'activated', 'canceled')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.scope_change_requests.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT type::text AS v
    FROM projects.project_attachments
    WHERE type IS NOT NULL
      AND type::text NOT IN ('file', 'link')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_attachments.type: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT reference::text AS v
    FROM projects.timelines
    WHERE reference IS NOT NULL
      AND reference::text NOT IN ('project', 'phase', 'product', 'work')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.timelines.reference: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT "valueType"::text AS v
    FROM projects.project_settings
    WHERE "valueType" IS NOT NULL
      AND "valueType"::text NOT IN ('int', 'double', 'string', 'percentage')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_settings.valueType: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT type::text AS v
    FROM projects.project_estimation_items
    WHERE type IS NOT NULL
      AND type::text NOT IN ('fee', 'community', 'topcoder_service')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_estimation_items.type: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT status::text AS v
    FROM projects.customer_payments
    WHERE status IS NOT NULL
      AND status::text NOT IN (
        'canceled', 'processing', 'requires_action', 'requires_capture',
        'requires_confirmation', 'requires_payment_method',
        'succeeded', 'refunded', 'refund_failed', 'refund_pending'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.customer_payments.status: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT currency::text AS v
    FROM projects.customer_payments
    WHERE currency IS NOT NULL
      AND currency::text NOT IN (
        'USD', 'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
        'BAM', 'BBD', 'BDT', 'BGN', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BWP',
        'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CVE', 'CZK',
        'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL',
        'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
        'ILS', 'INR', 'ISK', 'JMD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KRW', 'KYD',
        'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK',
        'MNT', 'MOP', 'MRO', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN',
        'NIO', 'NOK', 'NPR', 'NZD', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
        'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SEK', 'SGD', 'SHP',
        'SLL', 'SOS', 'SRD', 'STD', 'SZL', 'THB', 'TJS', 'TOP', 'TRY', 'TTD', 'TWD',
        'TZS', 'UAH', 'UGX', 'UYU', 'UZS', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF',
        'XPF', 'YER', 'ZAR', 'ZMW'
      )
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.customer_payments.currency: %', bad_values;
  END IF;

  SELECT string_agg(v, ', ' ORDER BY v) INTO bad_values
  FROM (
    SELECT DISTINCT decision::text AS v
    FROM projects.project_phase_approval
    WHERE decision IS NOT NULL
      AND lower(trim(decision::text)) NOT IN ('approve', 'reject', 'approved', 'rejected')
  ) s;
  IF bad_values IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid values for projects.project_phase_approval.decision: %', bad_values;
  END IF;
END $$;

-- Cast every enum-backed column to the Prisma enum type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'projects'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ProjectStatus')
  ) THEN
    ALTER TABLE projects.projects
      ALTER COLUMN status TYPE projects."ProjectStatus"
      USING status::text::projects."ProjectStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_phases'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ProjectStatus')
  ) THEN
    ALTER TABLE projects.project_phases
      ALTER COLUMN status TYPE projects."ProjectStatus"
      USING status::text::projects."ProjectStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'milestones'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ProjectStatus')
  ) THEN
    ALTER TABLE projects.milestones
      ALTER COLUMN status TYPE projects."ProjectStatus"
      USING status::text::projects."ProjectStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'status_history'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ProjectStatus')
  ) THEN
    ALTER TABLE projects.status_history
      ALTER COLUMN status TYPE projects."ProjectStatus"
      USING status::text::projects."ProjectStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_members'
      AND column_name = 'role'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ProjectMemberRole')
  ) THEN
    ALTER TABLE projects.project_members
      ALTER COLUMN role TYPE projects."ProjectMemberRole"
      USING role::text::projects."ProjectMemberRole";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_member_invites'
      AND column_name = 'role'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ProjectMemberRole')
  ) THEN
    ALTER TABLE projects.project_member_invites
      ALTER COLUMN role TYPE projects."ProjectMemberRole"
      USING role::text::projects."ProjectMemberRole";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_member_invites'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'InviteStatus')
  ) THEN
    ALTER TABLE projects.project_member_invites
      ALTER COLUMN status TYPE projects."InviteStatus"
      USING status::text::projects."InviteStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'work_streams'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'WorkStreamStatus')
  ) THEN
    ALTER TABLE projects.work_streams
      ALTER COLUMN status TYPE projects."WorkStreamStatus"
      USING status::text::projects."WorkStreamStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'copilot_requests'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'CopilotRequestStatus')
  ) THEN
    ALTER TABLE projects.copilot_requests
      ALTER COLUMN status TYPE projects."CopilotRequestStatus"
      USING status::text::projects."CopilotRequestStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'copilot_applications'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'CopilotApplicationStatus')
  ) THEN
    ALTER TABLE projects.copilot_applications
      ALTER COLUMN status TYPE projects."CopilotApplicationStatus"
      USING status::text::projects."CopilotApplicationStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'copilot_opportunities'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'CopilotOpportunityStatus')
  ) THEN
    ALTER TABLE projects.copilot_opportunities
      ALTER COLUMN status TYPE projects."CopilotOpportunityStatus"
      USING status::text::projects."CopilotOpportunityStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'copilot_opportunities'
      AND column_name = 'type'
      AND NOT (udt_schema = 'projects' AND udt_name = 'CopilotOpportunityType')
  ) THEN
    ALTER TABLE projects.copilot_opportunities
      ALTER COLUMN type TYPE projects."CopilotOpportunityType"
      USING type::text::projects."CopilotOpportunityType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'scope_change_requests'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ScopeChangeRequestStatus')
  ) THEN
    ALTER TABLE projects.scope_change_requests
      ALTER COLUMN status TYPE projects."ScopeChangeRequestStatus"
      USING status::text::projects."ScopeChangeRequestStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_attachments'
      AND column_name = 'type'
      AND NOT (udt_schema = 'projects' AND udt_name = 'AttachmentType')
  ) THEN
    ALTER TABLE projects.project_attachments
      ALTER COLUMN type TYPE projects."AttachmentType"
      USING type::text::projects."AttachmentType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'timelines'
      AND column_name = 'reference'
      AND NOT (udt_schema = 'projects' AND udt_name = 'TimelineReference')
  ) THEN
    ALTER TABLE projects.timelines
      ALTER COLUMN reference TYPE projects."TimelineReference"
      USING reference::text::projects."TimelineReference";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_settings'
      AND column_name = 'valueType'
      AND NOT (udt_schema = 'projects' AND udt_name = 'ValueType')
  ) THEN
    ALTER TABLE projects.project_settings
      ALTER COLUMN "valueType" TYPE projects."ValueType"
      USING "valueType"::text::projects."ValueType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_estimation_items'
      AND column_name = 'type'
      AND NOT (udt_schema = 'projects' AND udt_name = 'EstimationType')
  ) THEN
    ALTER TABLE projects.project_estimation_items
      ALTER COLUMN type TYPE projects."EstimationType"
      USING type::text::projects."EstimationType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'customer_payments'
      AND column_name = 'currency'
      AND NOT (udt_schema = 'projects' AND udt_name = 'CustomerPaymentCurrency')
  ) THEN
    ALTER TABLE projects.customer_payments
      ALTER COLUMN currency TYPE projects."CustomerPaymentCurrency"
      USING currency::text::projects."CustomerPaymentCurrency";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'customer_payments'
      AND column_name = 'status'
      AND NOT (udt_schema = 'projects' AND udt_name = 'CustomerPaymentStatus')
  ) THEN
    ALTER TABLE projects.customer_payments
      ALTER COLUMN status TYPE projects."CustomerPaymentStatus"
      USING status::text::projects."CustomerPaymentStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'project_phase_approval'
      AND column_name = 'decision'
      AND NOT (udt_schema = 'projects' AND udt_name = 'PhaseApprovalDecision')
  ) THEN
    ALTER TABLE projects.project_phase_approval
      ALTER COLUMN decision TYPE projects."PhaseApprovalDecision"
      USING (
        CASE lower(trim(decision::text))
          WHEN 'approved' THEN 'approve'
          WHEN 'rejected' THEN 'reject'
          ELSE lower(trim(decision::text))
        END
      )::projects."PhaseApprovalDecision";
  END IF;
END $$;

-- Restore expected defaults on enum columns.
ALTER TABLE projects.copilot_requests
  ALTER COLUMN status SET DEFAULT 'new'::projects."CopilotRequestStatus";

ALTER TABLE projects.copilot_opportunities
  ALTER COLUMN status SET DEFAULT 'active'::projects."CopilotOpportunityStatus";

ALTER TABLE projects.copilot_applications
  ALTER COLUMN status SET DEFAULT 'pending'::projects."CopilotApplicationStatus";

COMMIT;
