// fhirService.js
// Live FHIR R4 integration with the HAPI FHIR R4 public server.
// Handles patient registration, observation write-back (POST), and observation fetch (GET).

import { toFHIRPatient, toFHIRObservation, fromFHIRObservation } from "./fhirAdapter.js";

export const HAPI_BASE = "https://hapi.fhir.org/baseR4";

const FHIR_HEADERS = {
  "Content-Type": "application/fhir+json",
  Accept: "application/fhir+json",
};

// fhirService.js

async function upsertResource(resource) {
  // Use PUT to [base]/[Type]/[id] for idempotency
  const url = `${HAPI_BASE}/${resource.resourceType}/${resource.id}`;
  
  const res = await fetch(url, {
    method: "PUT", // Changed from POST
    headers: FHIR_HEADERS,
    body: JSON.stringify(resource),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR PUT ${resource.resourceType} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

// POST patient + all existing readings to HAPI FHIR R4.
// Returns { serverPatientId, serverReadings } with real server-assigned IDs.
// fhirService.js

export async function connectToFHIR(patient, readings) {
  // Prepare the patient resource
  const fhirPatient = toFHIRPatient(patient);
  
  // Use the MRN as part of the ID to ensure uniqueness on the public server
  // Example: "pf-patient-12345"
  fhirPatient.id = `pf-pt-${patient.mrn}`; 

  const serverPatient = await upsertResource(fhirPatient);
  const serverPatientId = serverPatient.id;

  const serverReadings = await Promise.all(
    readings.map(async (reading) => {
      const fhirObs = toFHIRObservation(reading, serverPatientId);
      
      // Ensure the Observation has a unique ID for the PUT request
      fhirObs.id = `pf-obs-${reading.id}`; 
      
      const serverObs = await upsertResource(fhirObs);
      return { ...reading, id: serverObs.id, fhirServerId: serverObs.id };
    })
  );

  return { serverPatientId, serverReadings };
}

// POST a single new reading as an Observation to HAPI FHIR R4.
// Returns the reading updated with the server-assigned FHIR ID.

export async function postObservationToFHIR(reading, serverPatientId) {
  const fhirObs = toFHIRObservation(reading, serverPatientId);
  
  // Assign a stable ID for the PUT operation
  fhirObs.id = `pf-obs-${reading.id}`;
  
  const serverObs = await upsertResource(fhirObs);
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
