BEGIN;

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_system TEXT NOT NULL CHECK (source_system IN ('sistema_a', 'sistema_b')),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['fhir.write'],
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (key_prefix),
  UNIQUE (key_hash)
);

CREATE TRIGGER trg_api_keys_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  source_system TEXT CHECK (source_system IN ('sistema_a', 'sistema_b')),
  event_id TEXT,
  idempotency_key TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER NOT NULL CHECK (status BETWEEN 100 AND 599),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  client_cidr INET,
  details JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts
  ON audit_log (ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_path_ts
  ON audit_log (path, ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_status_ts
  ON audit_log (status, ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_source_system_ts
  ON audit_log (source_system, ts DESC);

CREATE TABLE IF NOT EXISTS resource_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL CHECK (source_system IN ('sistema_a', 'sistema_b')),
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('Patient', 'Practitioner', 'Location', 'Appointment')
  ),
  source_resource_id TEXT NOT NULL,
  fhir_resource_id TEXT NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (
    record_status IN ('active', 'deleted')
  ),
  last_event_id TEXT NOT NULL,
  last_idempotency_key TEXT NOT NULL,
  canonical_identifiers JSONB NOT NULL DEFAULT '[]'::JSONB,
  raw_resource JSONB NOT NULL,
  canonical_resource JSONB NOT NULL,
  checksum_sha256 TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, resource_type, source_resource_id)
);

CREATE TRIGGER trg_resource_store_updated_at
BEFORE UPDATE ON resource_store
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_resource_store_type_updated_at
  ON resource_store (resource_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resource_store_source_type
  ON resource_store (source_system, resource_type);

CREATE INDEX IF NOT EXISTS idx_resource_store_record_status
  ON resource_store (record_status);

CREATE INDEX IF NOT EXISTS idx_resource_store_identifiers_gin
  ON resource_store
  USING GIN (canonical_identifiers);

CREATE INDEX IF NOT EXISTS idx_resource_store_canonical_resource_gin
  ON resource_store
  USING GIN (canonical_resource);

CREATE TABLE IF NOT EXISTS ingestion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL CHECK (source_system IN ('sistema_a', 'sistema_b')),
  event_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('Patient', 'Practitioner', 'Location', 'Appointment', 'Bundle')
  ),
  source_resource_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'upsert' CHECK (
    event_type IN ('upsert', 'delete', 'bundle-import', 'backfill')
  ),
  correlation_id TEXT,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  resource_store_id UUID REFERENCES resource_store(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL DEFAULT 'application/fhir+json',
  payload_json JSONB NOT NULL,
  payload_sha256 TEXT,
  processing_status TEXT NOT NULL DEFAULT 'accepted' CHECK (
    processing_status IN ('accepted', 'projected', 'rejected', 'superseded')
  ),
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, event_id),
  UNIQUE (source_system, idempotency_key)
);

CREATE TRIGGER trg_ingestion_events_updated_at
BEFORE UPDATE ON ingestion_events
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_ingestion_events_received_at
  ON ingestion_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_events_processing_status
  ON ingestion_events (processing_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_events_resource_lookup
  ON ingestion_events (source_system, resource_type, source_resource_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_events_api_key
  ON ingestion_events (api_key_id, received_at DESC);

INSERT INTO schema_migrations (version, description)
VALUES ('0002', 'core postgres tables for auth, audit, ingestion and resource store')
ON CONFLICT (version) DO NOTHING;

COMMIT;
