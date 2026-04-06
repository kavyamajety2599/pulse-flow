# Practicum Sprint #4 — Status and Deployment Check In #2 and Demo

**Team Name:** Code Blue  
**Team Members:** Divya Ramesh (dramesh35), Kavya Majety (kmajety3), Saikrishnan Sankar (ssankar49)

---

## Deployment

The PulseFlow application is deployed and publicly accessible at:  
**https://pulse-flow-3qfwlv9lf-kavyamajety25s-projects.vercel.app/**

The application was deployed using Vercel, which provides seamless integration with our GitHub repository and automatically redeploys on every push to the main branch. No backend infrastructure is required as the application is a client-side React SPA.

---

## Short Demo

[Insert link to demo video here — record a screen recording under 5 minutes showing: the Patient/Provider toggle, adding a reading, the titration alert, and the Download FHIR Bundle feature]

---

## Accomplishments

Since Sprint #3, our team completed the Sprint 4 (UI/Viz) objectives and addressed the FHIR data modeling gap from Sprint 3.

**Divya Ramesh (dramesh35):**
- Built the Patient View and Provider View toggle, separating the patient self-monitoring experience from the clinical decision support interface
- Implemented the 30-day rolling average card with automatic fallback to all-time average
- Estimated hours: 5 hours/week

**Kavya Majety (kmajety3):**
- Developed the FHIR R4 data modeling adapter (`fhirAdapter.js`), mapping blood pressure readings to FHIR Observation resources using LOINC codes 55284-4, 8480-6, and 8462-4
- Implemented the "Download FHIR Bundle" feature, enabling export of a valid FHIR R4 Bundle JSON containing Patient and Observation resources
- Estimated hours: 6 hours/week

**Saikrishnan Sankar (ssankar49):**
- Configured and deployed the application to Vercel with automatic GitHub integration
- Added AHA Stage 2 threshold reference lines (140 mmHg systolic, 90 mmHg diastolic) to the blood pressure trend chart
- Integrated FHIR Resource IDs into the patient card and readings table
- Estimated hours: 5 hours/week

---

## Challenges

**SMART on FHIR Launch Integration:** SMART OAuth launch was planned for Sprint 3 but was not completed. Public FHIR sandboxes (e.g., HAPI FHIR R4) do not support SMART OAuth launch flows without a pre-registered client ID and redirect URI, and institutional sandbox registration (Epic, Cerner) requires approval beyond our project timeline. As a result, we implemented a local FHIR R4 data modeling layer that demonstrates Observation resource structure, LOINC coding, and Bundle format without requiring a live server connection. This approach aligns with the risk mitigation strategy noted in our Sprint 2 plan, which stated: *"If I cannot POST new observations, I will pivot to a Local Storage simulation for the 'Add Reading' feature to demonstrate the workflow."*

**Addressing Professor Feedback:** In response to the Sprint 2 feedback asking whether the application is patient-facing and provider-facing, we have implemented a dual-view interface. The Patient View supports self-monitoring with a simplified alert and the Add Reading form. The Provider View exposes the full clinical decision support layer — titration alerts, complete readings history, and FHIR resource data export. Regarding manual entry vs. wearables: the current implementation uses manual entry, consistent with validated home blood pressure monitoring protocols. Wearable integration via FHIR Device resources is a future sprint consideration.

---

## Sprint Plans

Our plans for Sprint 5 (April 7 – April 20) align with the Write-back phase:

- **SMART Launch Integration:** Register with the SMART Health IT Launcher (https://launch.smarthealthit.org), which supports SMART on FHIR OAuth flows without institutional approval. Implement `fhirclient.js` to handle the SMART launch sequence and fetch live Patient and Observation data.
- **Live FHIR Data Fetch:** Replace the current seed data with real-time Observation resources fetched from the HAPI FHIR R4 server, using the data parsing utilities already established in `fhirAdapter.js`.
- **Write-back (POST):** Implement the ability to POST new blood pressure readings as FHIR Observation resources back to the FHIR server, closing the loop between patient entry and EHR data.

---

## References

1. Whelton PK et al. (2018). 2017 ACC/AHA Hypertension Guidelines. *Hypertension*, 71(6), e13–e115. https://doi.org/10.1161/HYP.0000000000000065
2. HL7 International. (2019). FHIR R4 Observation Resource. https://hl7.org/fhir/R4/observation.html
3. LOINC. (2024). Blood pressure panel (55284-4). https://loinc.org/55284-4/
