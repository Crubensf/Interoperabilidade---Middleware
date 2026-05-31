from __future__ import annotations

import sys
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.serializadores_fhir.bundle import (
    montar_bundle_agendamento,
    montar_bundle_geral_transacao,
)


class FhirTransactionBundleTestCase(unittest.TestCase):
    def _build_entities(
        self,
        *,
        agendamento_duration: int | None = None,
        especialidade_duration: int | None = None,
    ) -> SimpleNamespace:
        paciente = SimpleNamespace(
            id=4,
            cpf="000.000.000-04",
            cartao_sus="12345 7891234 567",
            nome="Caio R Feitosa",
            telefone="(89) 98124-8316",
            data_nascimento=date(2001, 2, 2),
            municipio="Picos",
            endereco="Rua antonio benedito",
            nome_mae="Celia Cristina",
            sexo="masculino",
        )
        especialidade = SimpleNamespace(
            id=1,
            codigo="ENDOCRINOLOGIA",
            nome="Endocrinologia",
        )
        if especialidade_duration is not None:
            especialidade.duracao_minutos = especialidade_duration

        profissional = SimpleNamespace(
            id=23,
            nome="Dra. Renata Ribeiro",
            crm="12.345-6",
            crm_uf="pi",
            telefone="(89) 99999-0000",
            email="renata@example.com",
            especialidade=especialidade,
        )
        local = SimpleNamespace(
            id=1,
            nome="UBS Canto da Várzea",
            municipio="Picos",
            endereco="Av. Principal, 1000",
            ativo=True,
        )

        agendamento = SimpleNamespace(
            id=6,
            status="agendado",
            inicio=datetime(2026, 1, 29, 16, 30, 0),
            modalidade="PRESENCIAL",
            paciente_id=paciente.id,
            profissional_id=profissional.id,
            local_id=local.id,
            especialidade_id=especialidade.id,
            paciente=paciente,
            profissional=profissional,
            local=local,
            especialidade=especialidade,
        )
        if agendamento_duration is not None:
            agendamento.duracao_minutos = agendamento_duration

        return agendamento

    def test_booked_has_start_and_end_with_fallback(self) -> None:
        agendamento = self._build_entities()
        bundle = montar_bundle_agendamento(agendamento)

        appointment = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Appointment"
        )
        self.assertEqual(appointment["status"], "booked")
        self.assertIn("start", appointment)
        self.assertIn("end", appointment)

        start = datetime.fromisoformat(appointment["start"])
        end = datetime.fromisoformat(appointment["end"])
        self.assertEqual(end - start, timedelta(minutes=30))
        self.assertIsNotNone(start.tzinfo)
        self.assertEqual(start.utcoffset(), timedelta(hours=-3))

    def test_uses_duration_when_present(self) -> None:
        agendamento = self._build_entities(agendamento_duration=45)
        bundle = montar_bundle_agendamento(agendamento)

        appointment = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Appointment"
        )
        start = datetime.fromisoformat(appointment["start"])
        end = datetime.fromisoformat(appointment["end"])
        self.assertEqual(end - start, timedelta(minutes=45))

    def test_patient_has_no_example_org_extension(self) -> None:
        agendamento = self._build_entities()
        bundle = montar_bundle_agendamento(agendamento)

        patient = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Patient"
        )
        extensions = patient.get("extension", [])
        self.assertFalse(
            any(
                isinstance(ext, dict)
                and str(ext.get("url", "")).startswith("https://example.org/")
                for ext in extensions
            )
        )
        self.assertTrue(
            any(
                ext.get("url")
                == "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName"
                and ext.get("valueString") == "Celia Cristina"
                for ext in extensions
                if isinstance(ext, dict)
            )
        )

    def test_bundle_normalizes_identifiers_and_enriches_resources(self) -> None:
        agendamento = self._build_entities()
        bundle = montar_bundle_agendamento(agendamento)

        patient = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Patient"
        )
        practitioner = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Practitioner"
        )
        location = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Location"
        )
        appointment = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Appointment"
        )

        patient_identifiers = {
            identifier["system"]: identifier["value"]
            for identifier in patient["identifier"]
        }
        self.assertEqual(
            patient_identifiers["http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf"],
            "00000000004",
        )
        self.assertEqual(
            patient_identifiers["http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns"],
            "123457891234567",
        )
        self.assertEqual(patient["gender"], "male")

        practitioner_identifier = practitioner["identifier"][0]
        self.assertEqual(
            practitioner_identifier["system"],
            "http://rnds.saude.gov.br/fhir/r4/NamingSystem/crm",
        )
        self.assertEqual(practitioner_identifier["value"], "PI123456")
        self.assertEqual(
            practitioner["qualification"][0]["code"]["text"],
            "Endocrinologia",
        )
        self.assertEqual(len(practitioner["telecom"]), 2)

        self.assertEqual(location["status"], "active")

        self.assertEqual(appointment["appointmentType"]["text"], "PRESENCIAL")
        self.assertEqual(appointment["description"], "Endocrinologia")
        self.assertEqual(appointment["comment"], "Modalidade: PRESENCIAL")

    def test_urn_references_are_consistent(self) -> None:
        agendamento = self._build_entities()
        bundle = montar_bundle_agendamento(agendamento)

        full_urls = {entry["fullUrl"] for entry in bundle["entry"]}
        self.assertTrue(all(url.startswith("urn:uuid:") for url in full_urls))

        appointment = next(
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Appointment"
        )

        for participant in appointment.get("participant", []):
            reference = participant.get("actor", {}).get("reference")
            self.assertIsInstance(reference, str)
            self.assertTrue(reference.startswith("urn:uuid:"))
            self.assertIn(reference, full_urls)

    def test_general_bundle_normalizes_all_appointments(self) -> None:
        ag1 = self._build_entities()
        ag2 = self._build_entities()
        ag2.id = 7
        ag2.inicio = datetime(2026, 1, 29, 18, 0, 0)
        ag2.status = "agendado"

        bundle = montar_bundle_geral_transacao(
            pacientes=[ag1.paciente],
            profissionais=[ag1.profissional],
            agendamentos=[ag1, ag2],
            locais=[ag1.local],
        )

        full_urls = {entry["fullUrl"] for entry in bundle["entry"]}
        appointments = [
            entry["resource"]
            for entry in bundle["entry"]
            if entry["resource"]["resourceType"] == "Appointment"
        ]
        self.assertEqual(len(appointments), 2)

        for appointment in appointments:
            self.assertIn("start", appointment)
            self.assertIn("end", appointment)
            self.assertEqual(appointment["appointmentType"]["text"], "PRESENCIAL")
            self.assertTrue(appointment["start"].endswith("-03:00"))
            self.assertTrue(appointment["end"].endswith("-03:00"))
            for participant in appointment.get("participant", []):
                reference = participant.get("actor", {}).get("reference")
                self.assertIsInstance(reference, str)
                self.assertTrue(reference.startswith("urn:uuid:"))
                self.assertIn(reference, full_urls)


if __name__ == "__main__":
    unittest.main()
