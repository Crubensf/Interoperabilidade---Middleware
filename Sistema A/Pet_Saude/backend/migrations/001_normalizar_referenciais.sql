-- =====================================================================
-- Migration 001 — Normalização para interoperabilidade FHIR
-- Rode no SQL Editor do Supabase. Idempotente: usa IF NOT EXISTS.
-- =====================================================================

-- 1) ESPECIALIDADES como tabela própria (era texto livre em profissionais)
CREATE TABLE IF NOT EXISTS especialidades (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL UNIQUE,
  codigo_cbo  TEXT,                    -- código CBO (Brasil) ou SNOMED
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 2) LOCAIS DE ATENDIMENTO como tabela própria (era texto livre em agendamentos)
CREATE TABLE IF NOT EXISTS locais_atendimento (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL UNIQUE,
  endereco    TEXT,
  cnes        TEXT,                    -- código CNES da unidade
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 3) Adicionar colunas em PROFISSIONAIS (especialidade_id, crm_uf)
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS especialidade_id UUID REFERENCES especialidades(id),
  ADD COLUMN IF NOT EXISTS crm_uf           CHAR(2);

-- 4) Adicionar coluna em AGENDAMENTOS (local_id)
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES locais_atendimento(id);

-- =====================================================================
-- BACKFILL — popular a partir dos textos legados, se houver
-- =====================================================================

-- Especialidades: pega valores distintos da coluna antiga e insere
INSERT INTO especialidades (nome)
SELECT DISTINCT TRIM(especialidade)
FROM profissionais
WHERE especialidade IS NOT NULL
  AND TRIM(especialidade) <> ''
ON CONFLICT (nome) DO NOTHING;

-- Liga profissionais à especialidade recém-criada
UPDATE profissionais p
   SET especialidade_id = e.id
  FROM especialidades e
 WHERE e.nome = TRIM(p.especialidade)
   AND p.especialidade_id IS NULL;

-- Locais: idem para agendamentos.local_atendimento (se a coluna existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'agendamentos' AND column_name = 'local_atendimento'
  ) THEN
    INSERT INTO locais_atendimento (nome)
    SELECT DISTINCT TRIM(local_atendimento)
      FROM agendamentos
     WHERE local_atendimento IS NOT NULL
       AND TRIM(local_atendimento) <> ''
    ON CONFLICT (nome) DO NOTHING;

    UPDATE agendamentos a
       SET local_id = l.id
      FROM locais_atendimento l
     WHERE l.nome = TRIM(a.local_atendimento)
       AND a.local_id IS NULL;
  END IF;
END$$;

-- CRM_UF: caso o CRM antigo venha como "12345/SP" ou "12345-SP", extrai UF.
UPDATE profissionais
   SET crm_uf = UPPER(REGEXP_REPLACE(crm, '^\d+[\/\-]?', ''))
 WHERE crm_uf IS NULL
   AND crm IS NOT NULL
   AND crm ~ '[A-Za-z]{2}$';

-- =====================================================================
-- ÍNDICES úteis para buscas FHIR
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_pacientes_cartao_sus ON pacientes (cartao_sus);
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf        ON pacientes (cpf);
CREATE INDEX IF NOT EXISTS idx_profissionais_crm    ON profissionais (crm, crm_uf);
