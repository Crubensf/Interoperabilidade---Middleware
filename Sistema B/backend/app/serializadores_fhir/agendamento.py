from datetime import timedelta

from app.serializadores_fhir.common import map_appointment_status, to_fhir_datetime


DEFAULT_APPOINTMENT_DURATION_MINUTES = 30


def _to_int_or_none(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _resolve_duration_minutes(a) -> int:
    # Prioriza duração explícita no agendamento; depois tenta na especialidade.
    candidate_attrs = (
        "duracao_minutos",
        "duracao_consulta_minutos",
        "duracao",
    )
    for attr in candidate_attrs:
        value = _to_int_or_none(getattr(a, attr, None))
        if value and value > 0:
            return value

    especialidade = getattr(a, "especialidade", None)
    if especialidade is not None:
        for attr in candidate_attrs:
            value = _to_int_or_none(getattr(especialidade, attr, None))
            if value and value > 0:
                return value

    return DEFAULT_APPOINTMENT_DURATION_MINUTES


def _resolve_end_datetime(a):
    inicio = getattr(a, "inicio", None)
    if inicio is None:
        return None

    for attr in ("fim", "end"):
        maybe_end = getattr(a, attr, None)
        if maybe_end is not None:
            return maybe_end

    return inicio + timedelta(minutes=_resolve_duration_minutes(a))


def _resolve_description(a) -> str | None:
    for attr in ("description", "descricao", "observacao"):
        value = getattr(a, attr, None)
        if value:
            return value

    especialidade = getattr(a, "especialidade", None)
    if especialidade is not None:
        return getattr(especialidade, "nome", None)

    return None


def agendamento_para_fhir(a, *, for_bundle: bool = False):
    status_fhir = map_appointment_status(a.status)

    resource = {
        "resourceType": "Appointment",
        "id": str(a.id),
        "status": status_fhir,
        "serviceType": [
            {
                "coding": [
                    {
                        "code": getattr(a.especialidade, "codigo", None),
                        "display": getattr(a.especialidade, "nome", None),
                    }
                ]
            }
        ],
        "participant": [
            {
                "actor": {
                    "reference": f"Patient/{a.paciente_id}",
                    "display": getattr(a.paciente, "nome", None),
                },
                "status": "accepted",
            },
            {
                "actor": {
                    "reference": f"Practitioner/{a.profissional_id}",
                    "display": getattr(a.profissional, "nome", None),
                },
                "status": "accepted",
            },
            {
                "actor": {
                    "reference": f"Location/{a.local_id}",
                    "display": getattr(a.local, "nome", None),
                },
                "status": "accepted",
            },
        ],
        "comment": f"Modalidade: {a.modalidade}",
    }

    if getattr(a, "modalidade", None):
        resource["appointmentType"] = {
            "text": a.modalidade,
        }

    description = _resolve_description(a)
    if description:
        resource["description"] = description

    start_dt = getattr(a, "inicio", None)
    end_dt = _resolve_end_datetime(a)

    if start_dt is not None and end_dt is not None:
        resource["start"] = to_fhir_datetime(start_dt)
        resource["end"] = to_fhir_datetime(end_dt)
    elif start_dt is not None and status_fhir == "booked":
        # app-2/app-3: booked exige start + end.
        resource["start"] = to_fhir_datetime(start_dt)
        resource["end"] = to_fhir_datetime(
            start_dt + timedelta(minutes=DEFAULT_APPOINTMENT_DURATION_MINUTES)
        )

    return resource
