// fhirService.js
import { toFHIRPatient, toFHIRObservation, fromFHIRObservation } from "./fhirAdapter.js";

export const HAPI_BASE = "https://hapi.fhir.org/baseR4";

const FHIR_HEADERS = {
  "Content-Type": "application/fhir+json",
  Accept: "application/fhir+json",
};

async function createResource(resource) {
  const { id: _dropped, ...body } = resource;

  const url = `${HAPI_BASE}/${body.resourceType}`;

  // If-None-Exist with a unique nonce forces HAPI to always treat this as a
  // fresh create — it will never find a match, so it never returns 412.
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ifNoneExist = `identifier=pulseflow-nonce-${nonce}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...FHIR_HEADERS,
      "If-None-Exist": ifNoneExist,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `FHIR POST ${body.resourceType} failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
  return res.json();
}

export async function connectToFHIR(patient, readings) {
  const fhirPatient = toFHIRPatient(patient);

  const serverPatient = await createResource(fhirPatient);
  const serverPatientId = serverPatient.id;

  const serverReadings = await Promise.all(
    readings.map(async (reading) => {
      const fhirObs = toFHIRObservation(reading, serverPatientId);
      const serverObs = await createResource(fhirObs);
      return { ...reading, id: serverObs.id, fhirServerId: serverObs.id };
    })
  );

  return { serverPatientId, serverReadings };
}

export async function postObservationToFHIR(reading, serverPatientId) {
  const fhirObs = toFHIRObservation(reading, serverPatientId);
  const serverObs = await createResource(fhirObs);
  return { ...reading, id: serverObs.id, fhirServerId: serverObs.id };
}

export async function fetchObservationsFromFHIR(serverPatientId) {
  const res = await fetch(
    `${HAPI_BASE}/Observation?patient=${serverPatientId}&code=55284-4&_sort=-date&_count=50`,
    { headers: { Accept: "application/fhir+json" } }
  );
  if (!res.ok) throw new Error(`FHIR GET Observations failed (${res.status})`);
  const bundle = await res.json();
  return (bundle.entry || []).map((e) => fromFHIRObservation(e.resource));
}
