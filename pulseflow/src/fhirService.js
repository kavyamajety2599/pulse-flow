// fhirService.js
// Live FHIR R4 integration with the HAPI FHIR R4 public server.
// Handles patient registration, observation write-back (POST), and observation fetch (GET).

import { toFHIRPatient, toFHIRObservation, fromFHIRObservation } from "./fhirAdapter.js";

export const HAPI_BASE = "https://hapi.fhir.org/baseR4";

const FHIR_HEADERS = {
  "Content-Type": "application/fhir+json",
  Accept: "application/fhir+json",
};

async function postResource(resource) {
  const res = await fetch(`${HAPI_BASE}/${resource.resourceType}`, {
    method: "POST",
    headers: FHIR_HEADERS,
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR POST ${resource.resourceType} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

// POST patient + all existing readings to HAPI FHIR R4.
// Returns { serverPatientId, serverReadings } with real server-assigned IDs.
export async function connectToFHIR(patient, readings) {
  // POST patient — strip local URN id so server assigns its own UUID
  const { id: _pid, ...fhirPatientBody } = toFHIRPatient(patient);
  const serverPatient = await postResource(fhirPatientBody);
  const serverPatientId = serverPatient.id;

  // POST all readings as Observations in parallel
  const serverReadings = await Promise.all(
    readings.map(async (reading) => {
      const { id: _oid, ...fhirObsBody } = toFHIRObservation(reading, serverPatientId);
      fhirObsBody.subject = { reference: `Patient/${serverPatientId}` };
      const serverObs = await postResource(fhirObsBody);
      return { ...reading, id: serverObs.id, fhirServerId: serverObs.id };
    })
  );

  return { serverPatientId, serverReadings };
}

// POST a single new reading as an Observation to HAPI FHIR R4.
// Returns the reading updated with the server-assigned FHIR ID.
export async function postObservationToFHIR(reading, serverPatientId) {
  const { id: _oid, ...fhirObsBody } = toFHIRObservation(reading, serverPatientId);
  fhirObsBody.subject = { reference: `Patient/${serverPatientId}` };
  const serverObs = await postResource(fhirObsBody);
  return { ...reading, id: serverObs.id, fhirServerId: serverObs.id };
}

// GET all blood pressure Observations for a patient from HAPI FHIR R4.
export async function fetchObservationsFromFHIR(serverPatientId) {
  const res = await fetch(
    `${HAPI_BASE}/Observation?patient=${serverPatientId}&code=55284-4&_sort=-date&_count=50`,
    { headers: { Accept: "application/fhir+json" } }
  );
  if (!res.ok) throw new Error(`FHIR GET Observations failed (${res.status})`);
  const bundle = await res.json();
  return (bundle.entry || []).map((e) => fromFHIRObservation(e.resource));
}
