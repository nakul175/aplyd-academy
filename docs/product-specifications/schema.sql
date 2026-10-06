-- Aplyd Academy reference schema v0.1, 2026-10-05.
-- Proposed PostgreSQL model; no production implementation or executed PostgreSQL validation implied.
-- Service supplies UUIDs. Apply to an empty dedicated schema using a restricted migration role.
-- R1 only. R2 logical additions are described in data-dictionary.md and LLD.md.
-- Tenant consistency is enforced by composite FKs; row visibility and grant scope also require the authorization contract in LLD.md.
-- Global drafts, private learner aggregates, polymorphic consent targets, rubric totals, owner-assessor independence,
-- immutable publication/decision/event records and cross-row eligibility require transactional domain checks.
-- No deletion cascade: governed purge jobs must delete dependent records in an approved order.
BEGIN;

-- Global person identity; no password storage
CREATE TABLE account (
    id uuid PRIMARY KEY,
    display_name text NOT NULL,
    email text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('active', 'disabled', 'pending')),
    CHECK (revision > 0),
    CHECK (length(display_name) BETWEEN 1 AND 100)
);

-- Issuer and subject identity linkage
CREATE TABLE external_identity (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL,
    issuer text NOT NULL,
    subject text NOT NULL,
    verified_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE RESTRICT,
    UNIQUE (issuer, subject)
);

-- Private learner preferences and adult eligibility
CREATE TABLE learner_profile (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL,
    preferred_language text NOT NULL,
    display_timezone text NOT NULL DEFAULT 'Asia/Kolkata',
    role_tags text[] NOT NULL DEFAULT '{}',
    goals jsonb NOT NULL DEFAULT '[]'::jsonb,
    access_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    adult_attested_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE RESTRICT,
    UNIQUE (account_id),
    CHECK (revision > 0)
);

-- Delivery workspace and security boundary
CREATE TABLE tenant (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    service_terms_version text NOT NULL,
    UNIQUE (slug),
    CHECK (status IN ('active', 'suspended', 'closed')),
    CHECK (revision > 0)
);

-- Contextual configuration independent of access grants
CREATE TABLE ecosystem (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, slug),
    CHECK (status IN ('active', 'retired')),
    CHECK (revision > 0)
);

-- Tenant scoped sponsoring body
CREATE TABLE organization (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    external_reference text,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, external_reference),
    CHECK (status IN ('active', 'inactive')),
    CHECK (revision > 0)
);

-- Tenant membership; does not itself grant administrator permissions
CREATE TABLE membership (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    account_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'invited',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, account_id),
    CHECK (status IN ('invited', 'active', 'disabled', 'left')),
    CHECK (revision > 0)
);

-- Shared accountable competency definition
CREATE TABLE competency (
    id uuid PRIMARY KEY,
    code text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    owner_account_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owner_tenant_id uuid NOT NULL,
    UNIQUE (code),
    FOREIGN KEY (owner_account_id) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (status IN ('draft', 'published', 'retired')),
    CHECK (revision > 0),
    FOREIGN KEY (owner_tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT
);

-- Shared program identity and draft ownership
CREATE TABLE program (
    id uuid PRIMARY KEY,
    code text NOT NULL,
    title text NOT NULL,
    owner_account_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owner_tenant_id uuid NOT NULL,
    UNIQUE (code),
    FOREIGN KEY (owner_account_id) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (status IN ('draft', 'published', 'retired')),
    CHECK (revision > 0),
    FOREIGN KEY (owner_tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    CHECK (length(title) BETWEEN 3 AND 160)
);

-- Versioned outcomes and immutable published completion policy
CREATE TABLE program_version (
    id uuid PRIMARY KEY,
    program_id uuid NOT NULL,
    version integer NOT NULL,
    language text NOT NULL,
    outcomes text[] NOT NULL,
    prerequisites text[] NOT NULL DEFAULT '{}',
    estimated_minutes integer NOT NULL,
    completion_policy jsonb NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    approved_by uuid,
    published_at timestamptz,
    review_due_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title text NOT NULL,
    reviewer_account_id uuid,
    summary text NOT NULL,
    audience text[] NOT NULL,
    FOREIGN KEY (program_id) REFERENCES program (id) ON DELETE RESTRICT,
    CHECK (version > 0),
    UNIQUE (program_id, version),
    CHECK (estimated_minutes > 0),
    CHECK (status IN ('draft', 'in_review', 'published', 'retired')),
    FOREIGN KEY (approved_by) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (status <> 'published' OR (approved_by IS NOT NULL AND published_at IS NOT NULL AND review_due_at IS NOT NULL)),
    CHECK (revision > 0),
    CHECK (length(title) BETWEEN 3 AND 160),
    FOREIGN KEY (reviewer_account_id) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (length(summary) BETWEEN 20 AND 2000)
);

-- Ordered learning or practice item in a program version
CREATE TABLE program_activity (
    id uuid PRIMARY KEY,
    program_version_id uuid NOT NULL,
    position integer NOT NULL,
    title text NOT NULL,
    kind text NOT NULL,
    mandatory boolean NOT NULL DEFAULT true,
    completion_rule jsonb NOT NULL,
    resource_key text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_version_id) REFERENCES program_version (id) ON DELETE RESTRICT,
    UNIQUE (program_version_id, id),
    CHECK (position > 0),
    UNIQUE (program_version_id, position),
    CHECK (kind IN ('lesson', 'practice', 'assessment'))
);

-- Program to competency mapping extension
CREATE TABLE program_competency (
    id uuid PRIMARY KEY,
    program_version_id uuid NOT NULL,
    competency_id uuid NOT NULL,
    level text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_version_id) REFERENCES program_version (id) ON DELETE RESTRICT,
    FOREIGN KEY (competency_id) REFERENCES competency (id) ON DELETE RESTRICT,
    UNIQUE (program_version_id, competency_id),
    CHECK (level IN ('foundation', 'applied', 'advanced', 'facilitator'))
);

-- Shared assessment identity
CREATE TABLE assessment (
    id uuid PRIMARY KEY,
    program_id uuid NOT NULL,
    title text NOT NULL,
    owner_account_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES program (id) ON DELETE RESTRICT,
    FOREIGN KEY (owner_account_id) REFERENCES account (id) ON DELETE RESTRICT
);

-- Published assessment method and attempt policy
CREATE TABLE assessment_version (
    id uuid PRIMARY KEY,
    assessment_id uuid NOT NULL,
    program_version_id uuid NOT NULL,
    version integer NOT NULL,
    method text NOT NULL,
    pass_score numeric(5,2) NOT NULL DEFAULT 70,
    max_attempts integer NOT NULL DEFAULT 3,
    appeal_window_days integer NOT NULL DEFAULT 14,
    human_review_required boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'draft',
    approved_by uuid,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    upload_policy jsonb NOT NULL DEFAULT '{"max_bytes":20971520,"media_types":["application/pdf","text/plain","image/png","image/jpeg"]}'::jsonb,
    FOREIGN KEY (assessment_id) REFERENCES assessment (id) ON DELETE RESTRICT,
    FOREIGN KEY (program_version_id) REFERENCES program_version (id) ON DELETE RESTRICT,
    UNIQUE (program_version_id, id),
    CHECK (version > 0),
    UNIQUE (assessment_id, version),
    CHECK (method IN ('quiz', 'scenario', 'assignment', 'demonstration')),
    CHECK (pass_score BETWEEN 0 AND 100),
    CHECK (max_attempts BETWEEN 1 AND 20),
    CHECK (appeal_window_days BETWEEN 1 AND 365),
    CHECK (status IN ('draft', 'published', 'retired')),
    FOREIGN KEY (approved_by) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (status <> 'published' OR (approved_by IS NOT NULL AND published_at IS NOT NULL)),
    CHECK (revision > 0)
);

-- Scored and critical assessment criteria
CREATE TABLE rubric_criterion (
    id uuid PRIMARY KEY,
    assessment_version_id uuid NOT NULL,
    code text NOT NULL,
    dimension text NOT NULL,
    description text NOT NULL,
    max_points numeric(7,2) NOT NULL,
    critical boolean NOT NULL DEFAULT false,
    critical_min_points numeric(7,2),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_version_id) REFERENCES assessment_version (id) ON DELETE RESTRICT,
    UNIQUE (assessment_version_id, id),
    UNIQUE (assessment_version_id, code),
    CHECK (dimension IN ('task_quality', 'verification', 'information_handling', 'judgment')),
    CHECK (max_points > 0),
    CHECK ((critical AND critical_min_points IS NOT NULL AND critical_min_points BETWEEN 0 AND max_points) OR (NOT critical AND critical_min_points IS NULL))
);

-- Tenant offered immutable program version
CREATE TABLE offering (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    program_version_id uuid NOT NULL,
    ecosystem_id uuid,
    organization_id uuid,
    mode text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    enrollment_opens_at timestamptz,
    enrollment_closes_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assessment_window jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (program_version_id) REFERENCES program_version (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id, program_version_id),
    FOREIGN KEY (tenant_id, ecosystem_id) REFERENCES ecosystem (tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, organization_id) REFERENCES organization (tenant_id, id) ON DELETE RESTRICT,
    CHECK (mode IN ('self_paced', 'cohort')),
    CHECK (status IN ('draft', 'open', 'closed', 'retired')),
    CHECK (enrollment_opens_at IS NULL OR enrollment_closes_at IS NULL OR enrollment_closes_at > enrollment_opens_at),
    CHECK (revision > 0)
);

-- Facilitated learner group
CREATE TABLE cohort (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    offering_id uuid NOT NULL,
    name text NOT NULL,
    capacity integer NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'planned',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, offering_id) REFERENCES offering (tenant_id, id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id, offering_id),
    CHECK (capacity > 0),
    CHECK (ends_at > starts_at),
    CHECK (status IN ('planned', 'active', 'closed', 'cancelled')),
    CHECK (revision > 0)
);

-- Scoped role grant independent of learner role tags
CREATE TABLE role_assignment (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    role text NOT NULL,
    organization_id uuid,
    cohort_id uuid,
    granted_by uuid NOT NULL,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, membership_id) REFERENCES membership (tenant_id, id) ON DELETE RESTRICT,
    CHECK (role IN ('learner', 'facilitator', 'assessor', 'content_author', 'content_reviewer', 'moderator', 'organization_admin', 'ecosystem_admin', 'tenant_admin')),
    FOREIGN KEY (tenant_id, organization_id) REFERENCES organization (tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, cohort_id) REFERENCES cohort (tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (granted_by) REFERENCES account (id) ON DELETE RESTRICT
);

CREATE INDEX ix_role_assignment_tenant_id_membership_id ON role_assignment (tenant_id, membership_id);

-- Pinned learner pathway and completion record
CREATE TABLE enrollment (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    learner_account_id uuid NOT NULL,
    offering_id uuid NOT NULL,
    program_version_id uuid NOT NULL,
    cohort_id uuid,
    policy_snapshot jsonb NOT NULL,
    status text NOT NULL DEFAULT 'invited',
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invitation_expires_at timestamptz,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, learner_account_id) REFERENCES membership (tenant_id, account_id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, offering_id, program_version_id) REFERENCES offering (tenant_id, id, program_version_id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id, program_version_id),
    UNIQUE (tenant_id, id, learner_account_id),
    UNIQUE (tenant_id, learner_account_id, offering_id),
    FOREIGN KEY (tenant_id, cohort_id, offering_id) REFERENCES cohort (tenant_id, id, offering_id) ON DELETE RESTRICT,
    CHECK (status IN ('invited', 'active', 'completed', 'withdrawn', 'suspended')),
    CHECK (status <> 'completed' OR completed_at IS NOT NULL),
    CHECK (revision > 0),
    CHECK (status <> 'invited' OR invitation_expires_at IS NOT NULL)
);

CREATE INDEX ix_enrollment_tenant_id_learner_account_id_status ON enrollment (tenant_id, learner_account_id, status);

-- Resumable server checked activity state
CREATE TABLE activity_progress (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    program_version_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    state text NOT NULL DEFAULT 'not_started',
    resume_position integer NOT NULL DEFAULT 0,
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, enrollment_id, program_version_id) REFERENCES enrollment (tenant_id, id, program_version_id) ON DELETE RESTRICT,
    FOREIGN KEY (program_version_id, activity_id) REFERENCES program_activity (program_version_id, id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, enrollment_id, activity_id),
    CHECK (state IN ('not_started', 'in_progress', 'completed')),
    CHECK (resume_position >= 0),
    CHECK ((state = 'completed' AND completed_at IS NOT NULL) OR (state <> 'completed' AND completed_at IS NULL)),
    CHECK (revision > 0)
);

-- Version pinned assessment attempt
CREATE TABLE attempt (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    program_version_id uuid NOT NULL,
    assessment_version_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    state text NOT NULL DEFAULT 'draft',
    assigned_assessor_id uuid,
    current_decision_id uuid,
    submitted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    learner_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
    review_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, enrollment_id, program_version_id) REFERENCES enrollment (tenant_id, id, program_version_id) ON DELETE RESTRICT,
    FOREIGN KEY (program_version_id, assessment_version_id) REFERENCES assessment_version (program_version_id, id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id, assessment_version_id),
    CHECK (attempt_number > 0),
    UNIQUE (tenant_id, enrollment_id, assessment_version_id, attempt_number),
    CHECK (state IN ('draft', 'submitted', 'under_review', 'passed', 'failed', 'voided')),
    FOREIGN KEY (assigned_assessor_id) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (revision > 0)
);

CREATE INDEX ix_attempt_tenant_id_assigned_assessor_id_state ON attempt (tenant_id, assigned_assessor_id, state);

CREATE UNIQUE INDEX ix_attempt_tenant_id_enrollment_id_assessment_version_id ON attempt (tenant_id, enrollment_id, assessment_version_id) WHERE state IN ('draft', 'submitted', 'under_review');

-- Private frozen evidence object
CREATE TABLE submission (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    object_key text NOT NULL,
    content_sha256 text NOT NULL,
    media_type text NOT NULL,
    byte_size bigint NOT NULL,
    scan_status text NOT NULL DEFAULT 'pending',
    ai_use_declaration text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    process_evidence jsonb NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, attempt_id) REFERENCES attempt (tenant_id, id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, attempt_id),
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CHECK (byte_size > 0),
    CHECK (scan_status IN ('pending', 'clean', 'rejected'))
);

-- Immutable evaluated result; appeal appends superseding record
CREATE TABLE assessment_decision (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    assessment_version_id uuid NOT NULL,
    decided_by uuid,
    method text NOT NULL,
    score_percent numeric(5,2) NOT NULL,
    critical_passed boolean NOT NULL,
    passed boolean NOT NULL,
    feedback text NOT NULL,
    supersedes_id uuid,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, attempt_id, assessment_version_id) REFERENCES attempt (tenant_id, id, assessment_version_id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id, attempt_id),
    UNIQUE (tenant_id, id, assessment_version_id),
    FOREIGN KEY (decided_by) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (method IN ('human', 'automated')),
    CHECK (method <> 'human' OR decided_by IS NOT NULL),
    CHECK (score_percent BETWEEN 0 AND 100),
    CHECK (NOT passed OR critical_passed),
    FOREIGN KEY (tenant_id, supersedes_id, attempt_id) REFERENCES assessment_decision (tenant_id, id, attempt_id) ON DELETE RESTRICT,
    CHECK (supersedes_id IS NULL OR supersedes_id <> id)
);

-- Immutable per-criterion evidence underlying a decision
CREATE TABLE criterion_score (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    decision_id uuid NOT NULL,
    assessment_version_id uuid NOT NULL,
    criterion_id uuid NOT NULL,
    points numeric(7,2) NOT NULL,
    rationale text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, decision_id, assessment_version_id) REFERENCES assessment_decision (tenant_id, id, assessment_version_id) ON DELETE RESTRICT,
    FOREIGN KEY (assessment_version_id, criterion_id) REFERENCES rubric_criterion (assessment_version_id, id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, decision_id, criterion_id),
    CHECK (points >= 0)
);

-- Learner challenge to a historical assessment decision
CREATE TABLE appeal (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    decision_id uuid NOT NULL,
    reason text NOT NULL,
    state text NOT NULL DEFAULT 'opened',
    reviewer_id uuid,
    resolution text,
    superseding_decision_id uuid,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolution_outcome text NOT NULL DEFAULT 'pending',
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, decision_id, attempt_id) REFERENCES assessment_decision (tenant_id, id, attempt_id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, decision_id),
    CHECK (state IN ('opened', 'under_review', 'upheld', 'overturned', 'closed')),
    FOREIGN KEY (reviewer_id) REFERENCES account (id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, superseding_decision_id, attempt_id) REFERENCES assessment_decision (tenant_id, id, attempt_id) ON DELETE RESTRICT,
    CHECK (state <> 'overturned' OR superseding_decision_id IS NOT NULL),
    CHECK (revision > 0),
    CHECK (resolution_outcome IN ('upheld', 'overturned', 'pending')),
    CHECK (length(reason) BETWEEN 20 AND 4000)
);

-- Idempotent capability award and current status projection
CREATE TABLE credential (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    learner_account_id uuid NOT NULL,
    kind text NOT NULL,
    standard_version text NOT NULL,
    issuer_label text NOT NULL,
    achievement_title text NOT NULL,
    approved_display_label text NOT NULL,
    state text NOT NULL DEFAULT 'issued',
    issued_at timestamptz NOT NULL,
    expires_at timestamptz,
    verification_token_hash text NOT NULL,
    public_sharing_enabled boolean NOT NULL DEFAULT false,
    eligibility_decision_id uuid,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, enrollment_id, learner_account_id) REFERENCES enrollment (tenant_id, id, learner_account_id) ON DELETE RESTRICT,
    CHECK (kind IN ('participation', 'completion', 'competency')),
    UNIQUE (tenant_id, enrollment_id, kind, standard_version),
    CHECK (state IN ('issued', 'suspended', 'revoked', 'expired')),
    CHECK (expires_at IS NULL OR expires_at > issued_at),
    UNIQUE (verification_token_hash),
    FOREIGN KEY (tenant_id, eligibility_decision_id) REFERENCES assessment_decision (tenant_id, id) ON DELETE RESTRICT,
    CHECK (kind <> 'competency' OR eligibility_decision_id IS NOT NULL),
    CHECK (revision > 0)
);

-- Append-only award changes and corrections
CREATE TABLE credential_event (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    sequence integer NOT NULL,
    event_type text NOT NULL,
    actor_id uuid NOT NULL,
    reason text NOT NULL,
    changes jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, credential_id) REFERENCES credential (tenant_id, id) ON DELETE RESTRICT,
    CHECK (sequence > 0),
    UNIQUE (tenant_id, credential_id, sequence),
    CHECK (event_type IN ('issued', 'suspended', 'reinstated', 'revoked', 'expired', 'corrected', 'sharing_changed')),
    FOREIGN KEY (actor_id) REFERENCES account (id) ON DELETE RESTRICT
);

-- Moderated tenant or cohort discussion space
CREATE TABLE community (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    cohort_id uuid,
    name text NOT NULL,
    visibility text NOT NULL DEFAULT 'members',
    moderator_owner_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rules_policy_version text NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, cohort_id) REFERENCES cohort (tenant_id, id) ON DELETE RESTRICT,
    CHECK (visibility IN ('members', 'tenant')),
    FOREIGN KEY (moderator_owner_id) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (status IN ('active', 'archived')),
    CHECK (revision > 0)
);

-- Explicit participation permission
CREATE TABLE community_membership (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    community_id uuid NOT NULL,
    account_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, community_id) REFERENCES community (tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, account_id) REFERENCES membership (tenant_id, account_id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, community_id, account_id),
    CHECK (status IN ('active', 'muted', 'removed')),
    CHECK (revision > 0)
);

-- Learner or staff community contribution
CREATE TABLE post (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    community_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_post_id uuid,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'published',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title text,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, community_id) REFERENCES community (tenant_id, id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id, community_id),
    FOREIGN KEY (tenant_id, community_id, author_id) REFERENCES community_membership (tenant_id, community_id, account_id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, parent_post_id, community_id) REFERENCES post (tenant_id, id, community_id) ON DELETE RESTRICT,
    CHECK (length(body) BETWEEN 10 AND 5000),
    CHECK (status IN ('published', 'hidden', 'removed')),
    CHECK (revision > 0),
    CHECK (parent_post_id IS NOT NULL OR title IS NOT NULL),
    CHECK (title IS NULL OR length(title) BETWEEN 5 AND 160)
);

-- Reported contribution requiring moderation
CREATE TABLE moderation_report (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    post_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    state text NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category text NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, post_id) REFERENCES post (tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, reporter_id) REFERENCES membership (tenant_id, account_id) ON DELETE RESTRICT,
    CHECK (state IN ('open', 'reviewing', 'resolved', 'dismissed')),
    CHECK (revision > 0),
    CHECK (category IN ('harmful_content', 'misinformation', 'harassment', 'privacy', 'spam', 'other'))
);

-- Append-only review action
CREATE TABLE moderation_action (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    report_id uuid NOT NULL,
    moderator_id uuid NOT NULL,
    action text NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, report_id) REFERENCES moderation_report (tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (moderator_id) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (action IN ('hide', 'remove', 'restore', 'dismiss', 'warn'))
);

-- Purpose limited learner sharing authorization
CREATE TABLE consent_grant (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL,
    tenant_id uuid,
    partner_client_id uuid,
    purpose text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    data_fields text[] NOT NULL,
    policy_version text NOT NULL,
    granted_at timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    CHECK (partner_client_id IS NULL OR tenant_id IS NOT NULL),
    CHECK (expires_at IS NULL OR expires_at > granted_at),
    CHECK (revision > 0)
);

CREATE INDEX ix_consent_grant_account_id_tenant_id_purpose ON consent_grant (account_id, tenant_id, purpose);

-- Learner assistance and privacy request workflow
CREATE TABLE support_ticket (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    category text NOT NULL,
    subject text NOT NULL,
    details text NOT NULL,
    state text NOT NULL DEFAULT 'open',
    assigned_to uuid,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, requester_id) REFERENCES membership (tenant_id, account_id) ON DELETE RESTRICT,
    CHECK (category IN ('access', 'learning', 'assessment', 'credential', 'accessibility', 'privacy', 'integration')),
    CHECK (state IN ('open', 'assigned', 'waiting', 'resolved', 'closed')),
    FOREIGN KEY (assigned_to) REFERENCES account (id) ON DELETE RESTRICT,
    CHECK (revision > 0),
    CHECK (length(subject) BETWEEN 5 AND 160),
    CHECK (length(details) BETWEEN 10 AND 5000)
);

-- Tenant bounded OAuth integration principal
CREATE TABLE partner_client (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    oauth_client_id text NOT NULL,
    name text NOT NULL,
    scopes text[] NOT NULL,
    purposes text[] NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    UNIQUE (oauth_client_id),
    CHECK (status IN ('active', 'disabled')),
    CHECK (revision > 0)
);

-- Validated partner delivery destination
CREATE TABLE webhook_subscription (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    partner_client_id uuid NOT NULL,
    endpoint_url text NOT NULL,
    event_types text[] NOT NULL,
    signing_secret_ref text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, partner_client_id) REFERENCES partner_client (tenant_id, id) ON DELETE RESTRICT,
    CHECK (status IN ('pending', 'active', 'disabled')),
    CHECK (revision > 0)
);

-- Transactional minimal domain event
CREATE TABLE outbox_event (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    event_version integer NOT NULL DEFAULT 1,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state text NOT NULL DEFAULT 'pending',
    attempt_count integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_until timestamptz,
    last_error_code text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    CHECK (event_version > 0),
    CHECK (state IN ('pending', 'processing', 'published', 'dead_letter')),
    CHECK (attempt_count >= 0)
);

CREATE INDEX ix_outbox_event_state_available_at ON outbox_event (state, available_at);

-- At least once event delivery and consent gate
CREATE TABLE webhook_delivery (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    consent_grant_id uuid,
    state text NOT NULL DEFAULT 'pending',
    attempt_count integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_until timestamptz,
    last_http_status integer,
    last_error_code text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, event_id) REFERENCES outbox_event (tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, subscription_id) REFERENCES webhook_subscription (tenant_id, id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, event_id, subscription_id),
    FOREIGN KEY (consent_grant_id) REFERENCES consent_grant (id) ON DELETE RESTRICT,
    CHECK (state IN ('pending', 'delivering', 'delivered', 'suppressed', 'dead_letter')),
    CHECK (attempt_count >= 0),
    CHECK (last_http_status IS NULL OR last_http_status BETWEEN 100 AND 599),
    CHECK (revision > 0)
);

CREATE INDEX ix_webhook_delivery_state_next_attempt_at ON webhook_delivery (state, next_attempt_at);

-- Durable scoped mutation deduplication
CREATE TABLE idempotency_record (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    principal_key text NOT NULL,
    route text NOT NULL,
    idempotency_key text NOT NULL,
    request_hash text NOT NULL,
    state text NOT NULL DEFAULT 'processing',
    response_status integer,
    response_body jsonb,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, principal_key, route, idempotency_key),
    CHECK (state IN ('processing', 'completed'))
);

-- Append-only authorization and privileged change record
CREATE TABLE audit_event (
    id uuid PRIMARY KEY,
    tenant_id uuid,
    principal_key text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    outcome text NOT NULL,
    correlation_id text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    CHECK (outcome IN ('allowed', 'denied', 'failed'))
);

CREATE INDEX ix_audit_event_tenant_id_created_at ON audit_event (tenant_id, created_at);

CREATE INDEX ix_audit_event_correlation_id ON audit_event (correlation_id);

-- Mandatory service and community participation agreements separate from optional sharing
CREATE TABLE agreement_acceptance (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL,
    tenant_id uuid,
    agreement_type text NOT NULL,
    policy_version text NOT NULL,
    community_id uuid,
    accepted_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenant (id) ON DELETE RESTRICT,
    CHECK (agreement_type IN ('service_terms', 'community_rules')),
    FOREIGN KEY (tenant_id, community_id) REFERENCES community (tenant_id, id) ON DELETE RESTRICT,
    CHECK ((agreement_type = 'service_terms' AND community_id IS NULL) OR (agreement_type = 'community_rules' AND tenant_id IS NOT NULL AND community_id IS NOT NULL))
);

ALTER TABLE attempt ADD CONSTRAINT fk_attempt_current_decision FOREIGN KEY (tenant_id, current_decision_id, id) REFERENCES assessment_decision (tenant_id, id, attempt_id) ON DELETE RESTRICT;
ALTER TABLE consent_grant ADD CONSTRAINT fk_consent_partner FOREIGN KEY (tenant_id, partner_client_id) REFERENCES partner_client (tenant_id, id) ON DELETE RESTRICT;
-- RLS must be enabled with explicit service and reporting policies during deployment.
-- This reference intentionally does not invent a connection-level user identity or permit unrestricted SECURITY DEFINER access.
-- App operations must use scoped repositories and short transactions with immutable authenticated context.
COMMIT;
