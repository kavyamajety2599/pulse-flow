# PulseFlow

A SMART on FHIR-inspired chronic hypertension monitoring dashboard built for CS 6440 Health Informatics Practicum — Team Code Blue.

## Live Deployment

https://pulse-flow-eta.vercel.app/

## Overview

PulseFlow bridges Patient-Generated Health Data (PGHD) and the Electronic Health Record (EHR) by providing a dual-view dashboard for hypertension management:

- **Patient View** — self-monitoring: trend chart, 30-day rolling average, add readings
- **Provider View** — clinical decision support: titration alerts, full history, FHIR data export

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| FHIR Integration | HAPI FHIR R4 Public Server |
| Deployment | Vercel |

## Features

- **AHA-aligned BP classification** — Normal, Elevated, Stage 1, Stage 2 Hypertension
- **Titration alert** — fires when last 3 consecutive readings ≥ 140/90 mmHg
- **30-day rolling average** with all-time fallback
- **Threshold reference lines** at 140 mmHg (systolic) and 90 mmHg (diastolic)
- **FHIR R4 data layer** — readings modeled as Observation resources (LOINC 55284-4, 8480-6, 8462-4)
- **Live FHIR connection** — POST patient and observations to HAPI FHIR R4, write-back on new readings
- **Download FHIR Bundle** — exports valid FHIR R4 Bundle JSON
- **Patient / Provider view toggle**

## Local Setup

```bash
git clone https://github.com/kavyamajety2599/pulse-flow.git
cd pulse-flow/pulseflow
npm install
npm run dev
```

Open http://localhost:5173

## Build for Production

```bash
npm run build
npm run preview
```

## FHIR Integration

### Simulated Mode (default)
On load, the app uses local seed data structured as FHIR R4 resources with LOINC-coded Observation components. A FHIR Bundle can be downloaded at any time via the "Download FHIR Bundle" button.

### Live Mode (Connect to FHIR Server)
Clicking **"Connect to FHIR Server"** in the Provider View header:
1. POSTs the patient as a FHIR R4 Patient resource to `https://hapi.fhir.org/baseR4`
2. POSTs all readings as FHIR R4 Observation resources (parallel requests)
3. Replaces local IDs with real server-assigned UUIDs
4. All subsequent new readings are POSTed to HAPI FHIR R4 (write-back)

### FHIR Resource Structure

**Patient resource:** `urn:pulseflow:mrn` identifier, name, birthDate, condition extension

**Observation resource (LOINC 55284-4):**
- Component 8480-6: Systolic blood pressure (mmHg)
- Component 8462-4: Diastolic blood pressure (mmHg)
- Status: `final`, Category: `vital-signs`

## Architecture

```
Browser (React SPA)
├── App.jsx          — main component, state, view toggle
├── fhirAdapter.js   — pure FHIR R4 resource builders (LOINC-coded)
└── fhirService.js   — HAPI FHIR R4 API calls (POST/GET)
         │
         └──► HAPI FHIR R4 Public Server (https://hapi.fhir.org/baseR4)
```

## Repository Structure

```
pulse-flow/
├── pulseflow/          — React/Vite application
│   └── src/
│       ├── App.jsx
│       ├── fhirAdapter.js
│       └── fhirService.js
├── docs/
│   ├── sprint4.md
│   └── presentation.md
└── README.md
```

## Team

Code Blue — CS 6440 Health Informatics, Georgia Tech

- Divya Ramesh (dramesh35)
- Kavya Majety (kmajety3)
- Saikrishnan Sankar (ssankar49)
