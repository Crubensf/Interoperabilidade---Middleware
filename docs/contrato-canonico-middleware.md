# Contrato Canonico do Middleware

## Objetivo

Este documento define o contrato canonico de escrita do middleware para a
integracao entre `sistema_a` e `sistema_b`. A escrita passa a acontecer em
recursos FHIR R4, com metadados de origem e idempotencia obrigatorios.

## Escopo

Recursos suportados no MVP:

- `Patient`
- `Practitioner`
- `Location`
- `Appointment`
- `Bundle`

Valores aceitos para `source_system`:

- `sistema_a`
- `sistema_b`

## Contrato de Ingestao

### Endpoints

- `POST /fhir/Patient`
- `POST /fhir/Practitioner`
- `POST /fhir/Location`
- `POST /fhir/Appointment`
- `POST /fhir/Bundle`

### Headers Obrigatorios

- `Content-Type: application/fhir+json`
- `X-API-Key: <chave-de-producao-do-produtor>`
- `X-Source-System: sistema_a | sistema_b`
- `X-Event-Id: <uuid-ou-ulid-do-evento>`
- `Idempotency-Key: <chave-estavel-do-evento>`

### Regras de Metadados Canonicos

- `X-API-Key`: autentica o produtor e define qual `source_system` pode ingressar.
- `source_system`: vem do header `X-Source-System` e identifica o produtor.
- `source_resource_id`: e sempre o `resource.id` do recurso enviado.
- `event_id`: vem do header `X-Event-Id` e identifica unicamente a mutacao no
  produtor.
- `Idempotency-Key`: vem do header HTTP e deve ser reenviado exatamente igual
  em retries do mesmo evento.

### Regras de Idempotencia

- O mesmo `Idempotency-Key` representa o mesmo evento logico.
- Reenvios com a mesma chave nao devem criar duplicatas.
- O par canonico de identidade de um registro externo e:
  `source_system + source_resource_id`.
- O `event_id` identifica a entrega/mutacao; o `source_resource_id` identifica
  o registro de negocio no sistema de origem.

## Campos Obrigatorios por Recurso

### Patient

Campos obrigatorios:

- `resourceType = Patient`
- `id`
- `name[0].text`
- ao menos um `identifier` oficial com `system` de CPF ou CNS

Campos recomendados:

- `telecom`
- `gender`
- `birthDate`
- `address`
- extensao `patient-mothersMaidenName`

### Practitioner

Campos obrigatorios:

- `resourceType = Practitioner`
- `id`
- `name[0].text`
- `identifier` oficial de CRM

Campos recomendados:

- `telecom`
- `qualification[0].code.text`

### Location

Campos obrigatorios:

- `resourceType = Location`
- `id`
- `name`

Campos recomendados:

- `status`
- `address`
- `identifier` de CNES, quando existir

### Appointment

Campos obrigatorios:

- `resourceType = Appointment`
- `id`
- `status`
- `participant` com referencias para `Patient`, `Practitioner` e `Location`

Campos obrigatorios quando o status representar agenda ativa:

- `start`
- `end`

Campos recomendados:

- `appointmentType.text`
- `serviceType`
- `description`
- `comment`

### Bundle

Campos obrigatorios:

- `resourceType = Bundle`
- `entry[]`
- cada `entry.resource` deve ser um dos recursos suportados acima
- cada `entry.resource.id` e o `source_resource_id` daquele recurso

## Regras de Normalizacao

- CPF: armazenar e comparar so com digitos.
- CNS: armazenar e comparar so com digitos.
- CRM: normalizar preferencialmente para `UF + digitos`, por exemplo `PI12345`.
- `Patient.gender`: normalizar `M/masculino/male -> male`,
  `F/feminino/female -> female`, `outro/other -> other`,
  `nao informado/desconhecido -> unknown`.
- `Appointment.status`: mapear valores de negocio para FHIR R4. Exemplo:
  `agendado -> booked`, `cancelado -> cancelled`, `atendido -> fulfilled`,
  `faltou -> noshow`.
- Datetime sem timezone explicito deve ser tratado como `America/Fortaleza`
  (`-03:00`) no momento da serializacao canonica.

## Mapeamento A/B -> FHIR

### Patient

| Dominio | Sistema A | Sistema B | FHIR |
| --- | --- | --- | --- |
| Identidade local | `pacientes.id` | `Paciente.id` | `Patient.id` |
| Nome | `nome` | `nome` | `Patient.name[0].text` |
| CPF | `cpf` | `cpf` | `Patient.identifier[system=cpf]` |
| CNS | `cartao_sus` | `cartao_sus` | `Patient.identifier[system=cns]` |
| Telefone | `telefone` | `telefone` | `Patient.telecom[system=phone]` |
| Email | `email` | `email` | `Patient.telecom[system=email]` |
| Nascimento | `data_nascimento` | `data_nascimento` | `Patient.birthDate` |
| Sexo | `sexo` | `sexo` | `Patient.gender` |
| Endereco | `logradouro/numero/complemento/bairro/cidade/estado/cep` | `endereco/municipio` | `Patient.address` |
| Nome da mae | `nome_mae` quando existir | `nome_mae` | `Patient.extension[mothersMaidenName]` |

### Practitioner

| Dominio | Sistema A | Sistema B | FHIR |
| --- | --- | --- | --- |
| Identidade local | `profissionais.id` | `Profissional.id` | `Practitioner.id` |
| Nome | `nome` | `nome` | `Practitioner.name[0].text` |
| CRM | `crm + crm_uf` | `crm + crm_uf` | `Practitioner.identifier[system=crm]` |
| Telefone | `telefone` | `telefone` | `Practitioner.telecom[system=phone]` |
| Email | `email` | `email` | `Practitioner.telecom[system=email]` |
| Especialidade | `especialidade` ou relacao `especialidade_id` | relacao `especialidade_id -> especialidade.nome` | `Practitioner.qualification[0].code.text` |

### Location

| Dominio | Sistema A | Sistema B | FHIR |
| --- | --- | --- | --- |
| Identidade local | `locais_atendimento.id` | `LocalAtendimento.id` | `Location.id` |
| Nome | `nome` | `nome` | `Location.name` |
| Status | `ativo` | `ativo` ou `status` | `Location.status` |
| Endereco | `endereco` | `endereco` | `Location.address.text/line` |
| Municipio | `cidade` ou endereco textual | `municipio` | `Location.address.city` |
| CNES | `cnes` | quando existir | `Location.identifier[system=cnes]` |

### Appointment

| Dominio | Sistema A | Sistema B | FHIR |
| --- | --- | --- | --- |
| Identidade local | `agendamentos.id` | `Agendamento.id` | `Appointment.id` |
| Status | `status` | `status` | `Appointment.status` |
| Inicio | `data_agendamento + hora_agendamento` | `inicio` | `Appointment.start` |
| Fim | derivado, default `+30min` | `fim` ou derivado por duracao | `Appointment.end` |
| Modalidade | `tipo_atendimento` | `modalidade` | `Appointment.appointmentType.text` |
| Especialidade | `especialidade` vinculada ao profissional | `especialidade.codigo/nome` | `Appointment.serviceType` e/ou `description` |
| Observacao | `observacoes` | `observacao/descricao` quando existir | `Appointment.description` |
| Paciente | `paciente_id + pacientes.nome` | `paciente_id + paciente.nome` | `participant.actor.reference=Patient/...` |
| Profissional | `profissional_id + profissionais.nome` | `profissional_id + profissional.nome` | `participant.actor.reference=Practitioner/...` |
| Local | `local_id + local.nome` | `local_id + local.nome` | `participant.actor.reference=Location/...` |

### Bundle

| Origem | Formato atual | Regra canonica de ingestao |
| --- | --- | --- |
| Sistema A | `Bundle searchset` | aceitar `entry[].resource`, ignorando semantica de busca para persistencia |
| Sistema B | `Bundle transaction` | aceitar `entry[].resource`, ignorando semantica transacional remota |

## Exemplo Minimo de Envio

### Headers

```http
POST /fhir/Patient
Content-Type: application/fhir+json
X-Source-System: sistema_a
X-Event-Id: 01J123ABCDEF456XYZ789KLMNO
Idempotency-Key: sistema_a:Patient:9d5c6d10:update:2026-06-28T10:15:00Z
```

### Body

```json
{
  "resourceType": "Patient",
  "id": "9d5c6d10",
  "identifier": [
    {
      "use": "official",
      "system": "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf",
      "value": "12345678901"
    }
  ],
  "name": [
    {
      "text": "Maria Oliveira"
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "89999990001"
    }
  ]
}
```

## Definicao de Pronto da Task 1

- recursos suportados definidos
- campos obrigatorios por recurso definidos
- `source_system`, `source_resource_id`, `event_id` e `Idempotency-Key` definidos
- mapeamento de `Sistema A` e `Sistema B` para FHIR documentado
