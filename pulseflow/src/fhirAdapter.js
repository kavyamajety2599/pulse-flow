// fhirAdapter.js
// Simulates FHIR R4 Observation and Patient resources for PulseFlow.
// Demonstrates FHIR data modeling (LOINC-coded) without requiring a live SMART OAuth server.
//
// LOINC codes used:
//   55284-4  Blood pressure systolic and diastolic (panel)
//   8480-6   Systolic blood pressure (component)
//   8462-4   Diastolic blood pressure (component)

const FHIR_BASE = "urn:pulseflow:fhir:";

export function generateFHIRId() {
  return `${FHIR_BASE}obs-${Date.now()}`;
}

export function toFHIRObservation(reading, patientId) {
  return {
    resourceType: "Observation",
    id: `${FHIR_BASE}obs-${reading.id}`,
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs",
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "55284-4",
          display: "Blood pressure systolic and diastolic",
        },
      ],
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: reading.date,
    note: reading.notes ? [{ text: reading.notes }] : [],
    component: [
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8480-6",
              display: "Systolic blood pressure",
            },
          ],
        },
        valueQuantity: {
          value: Number(reading.systolic),
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]",
        },
      },
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8462-4",
              display: "Diastolic blood pressure",
            },
          ],
        },
        valueQuantity: {
          value: Number(reading.diastolic),
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]",
        },
      },
    ],
  };
}

export function fromFHIRObservation(obs) {
  const sys = obs.component?.find((c) => c.code?.coding?.[0]?.code === "8480-6");
  const dia = obs.component?.find((c) => c.code?.coding?.[0]?.code === "8462-4");
  return {
    id: obs.id,
    fhirServerId: obs.id,
    date: obs.effectiveDateTime,
    systolic: sys?.valueQuantity?.value ?? 0,
    diastolic: dia?.valueQuantity?.value ?? 0,
    notes: obs.note?.[0]?.text ?? "",
  };
}

export function toFHIRPatient(patient) {
  return {
    resourceType: "Patient",
    id: `${FHIR_BASE}${patient.id}`,
    identifier: [{ system: "urn:pulseflow:mrn", value: patient.mrn }],
    name: [{ text: patient.name }],
    birthDate: `${new Date().getFullYear() - patient.age}-01-01`,
    extension: [
      {
        url: "urn:pulseflow:condition",
        valueString: patient.condition,
      },
    ],
  };
}

export function downloadFHIRBundle(readings, patient) {
  const bundle = {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: [
      { resource: toFHIRPatient(patient) },
      ...readings.map((r) => ({ resource: toFHIRObservation(r, patient.id) })),
    ],
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pulseflow-fhir-bundle.json";
  a.click();
  URL.revokeObjectURL(url);
}
