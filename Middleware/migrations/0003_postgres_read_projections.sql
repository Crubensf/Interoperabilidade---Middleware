BEGIN;

CREATE TABLE IF NOT EXISTS patient_projection (
  resource_store_id UUID PRIMARY KEY REFERENCES resource_store(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL CHECK (source_system IN ('sistema_a', 'sistema_b')),
  source_resource_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (
    record_status IN ('active', 'deleted')
  ),
  full_name TEXT NOT NULL,
  cpf TEXT,
  cns TEXT,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  gender TEXT,
  address_text TEXT,
  city TEXT,
  mother_name TEXT,
  resource_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, source_resource_id)
);

CREATE TRIGGER trg_patient_projection_updated_at
BEFORE UPDATE ON patient_projection
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_patient_projection_cpf
  ON patient_projection (cpf);

CREATE INDEX IF NOT EXISTS idx_patient_projection_cns
  ON patient_projection (cns);

CREATE INDEX IF NOT EXISTS idx_patient_projection_name
  ON patient_projection (LOWER(full_name));

CREATE TABLE IF NOT EXISTS practitioner_projection (
  resource_store_id UUID PRIMARY KEY REFERENCES resource_store(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL CHECK (source_system IN ('sistema_a', 'sistema_b')),
  source_resource_id TEXT NOT NULL,
  practitioner_id TEXT NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (
    record_status IN ('active', 'deleted')
  ),
  full_name TEXT NOT NULL,
  crm TEXT,
  specialty_text TEXT,
  phone TEXT,
  email TEXT,
  resource_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, source_resource_id)
);

CREATE TRIGGER trg_practitioner_projection_updated_at
BEFORE UPDATE ON practitioner_projection
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_practitioner_projection_crm
  ON practitioner_projection (crm);

CREATE INDEX IF NOT EXISTS idx_practitioner_projection_name
  ON practitioner_projection (LOWER(full_name));

CREATE TABLE IF NOT EXISTS location_projection (
  resource_store_id UUID PRIMARY KEY REFERENCES resource_store(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL CHECK (source_system IN ('sistema_a', 'sistema_b')),
  source_resource_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (
    record_status IN ('active', 'deleted')
  ),
  name TEXT NOT NULL,
  status TEXT,
  cnes TEXT,
  address_text TEXT,
  city TEXT,
  resource_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, source_resource_id)
);

CREATE TRIGGER trg_location_projection_updated_at
BEFORE UPDATE ON location_projection
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_location_projection_cnes
  ON location_projection (cnes);

CREATE INDEX IF NOT EXISTS idx_location_projection_name
  ON location_projection (LOWER(name));

CREATE TABLE IF NOT EXISTS appointment_projection (
  resource_store_id UUID PRIMARY KEY REFERENCES resource_store(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL CHECK (source_system IN ('sistema_a', 'sistema_b')),
  source_resource_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (
    record_status IN ('active', 'deleted')
  ),
  status TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  modality TEXT,
  specialty_code TEXT,
  specialty_text TEXT,
  description TEXT,
  comment TEXT,
  patient_ref TEXT,
  patient_source_resource_id TEXT,
  patient_display TEXT,
  practitioner_ref TEXT,
  practitioner_source_resource_id TEXT,
  practitioner_display TEXT,
  location_ref TEXT,
  location_source_resource_id TEXT,
  location_display TEXT,
  resource_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, source_resource_id)
);

CREATE TRIGGER trg_appointment_projection_updated_at
BEFORE UPDATE ON appointment_projection
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_appointment_projection_start_at
  ON appointment_projection (start_at);

CREATE INDEX IF NOT EXISTS idx_appointment_projection_status_start
  ON appointment_projection (status, start_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointment_projection_patient
  ON appointment_projection (patient_source_resource_id);

CREATE INDEX IF NOT EXISTS idx_appointment_projection_practitioner
  ON appointment_projection (practitioner_source_resource_id);

CREATE TABLE IF NOT EXISTS patient_identity_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cns TEXT,
  cpf TEXT,
  preferred_name TEXT,
  sistema_a_source_resource_id TEXT,
  sistema_b_source_resource_id TEXT,
  ultima_visto_a TIMESTAMPTZ,
  ultima_visto_b TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (cns IS NOT NULL OR cpf IS NOT NULL)
);

CREATE TRIGGER trg_patient_identity_projection_updated_at
BEFORE UPDATE ON patient_identity_projection
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_identity_projection_cns
  ON patient_identity_projection (cns)
  WHERE cns IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_identity_projection_cpf
  ON patient_identity_projection (cpf)
  WHERE cpf IS NOT NULL;

CREATE TABLE IF NOT EXISTS practitioner_identity_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm TEXT NOT NULL,
  preferred_name TEXT,
  sistema_a_source_resource_id TEXT,
  sistema_b_source_resource_id TEXT,
  ultima_visto_a TIMESTAMPTZ,
  ultima_visto_b TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crm)
);

CREATE TRIGGER trg_practitioner_identity_projection_updated_at
BEFORE UPDATE ON practitioner_identity_projection
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

INSERT INTO schema_migrations (version, description)
VALUES ('0003', 'read projections and identity projections')
ON CONFLICT (version) DO NOTHING;

COMMIT;
