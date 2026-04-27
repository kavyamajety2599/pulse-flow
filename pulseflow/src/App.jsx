import React, { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, HeartPulse, TrendingUp, User } from "lucide-react";
import { downloadFHIRBundle, generateFHIRId, toFHIRObservation, toFHIRPatient } from "./fhirAdapter.js";
import { connectToFHIR, postObservationToFHIR, HAPI_BASE } from "./fhirService.js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

const STORAGE_KEY = "pulseflow-demo-data-v1";

const seedData = {
  patient: {
    id: "pt-001",
    name: "John Doe",
    mrn: "12345",
    age: 54,
    condition: "Stage 1/2 Hypertension Monitoring",
  },
  readings: [
    { id: 1, date: "2026-03-01", systolic: 146, diastolic: 94, notes: "Morning reading" },
    { id: 2, date: "2026-03-04", systolic: 142, diastolic: 91, notes: "Before medication" },
    { id: 3, date: "2026-03-07", systolic: 138, diastolic: 88, notes: "Felt normal" },
    { id: 4, date: "2026-03-10", systolic: 144, diastolic: 92, notes: "Mild stress" },
    { id: 5, date: "2026-03-13", systolic: 136, diastolic: 86, notes: "Post-walk" },
    { id: 6, date: "2026-03-16", systolic: 141, diastolic: 90, notes: "Evening reading" },
    { id: 7, date: "2026-03-20", systolic: 148, diastolic: 96, notes: "Missed sleep" },
    { id: 8, date: "2026-03-24", systolic: 139, diastolic: 87, notes: "After breakfast" },
  ],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : seedData;
  } catch {
    return seedData;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function classifyReading(sys, dia) {
  if (sys >= 140 || dia >= 90) return "Stage 2 Hypertension";
  if (sys >= 130 || dia >= 80) return "Stage 1 Hypertension";
  if (sys >= 120 && dia < 80) return "Elevated";
  return "Normal";
}

function statusColors(status) {
  if (status === "Stage 2 Hypertension") {
    return { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" };
  }
  if (status === "Stage 1 Hypertension" || status === "Elevated") {
    return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  }
  return { background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd" };
}

function cardStyle() {
  return {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    border: "1px solid #e5e7eb",
  };
}

function sectionTitleStyle() {
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: "14px",
  };
}

function badge(status) {
  const styles = statusColors(status);
  return (
    <span
      style={{
        ...styles,
        display: "inline-block",
        borderRadius: "999px",
        padding: "6px 12px",
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

export default function PulseFlowStarterApp() {
  const [data, setData] = useState(seedData);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    systolic: "",
    diastolic: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("patient");
  const [fhirConn, setFhirConn] = useState({ status: "simulated", serverPatientId: null, error: null });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = loadData();
    setData(stored);
  }, []); 

  useEffect(() => {
    saveData(data);
  }, [data]);

  const sortedReadings = useMemo(() => {
    return [...data.readings].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data.readings]);

  const latest = sortedReadings[sortedReadings.length - 1];

  const avg = useMemo(() => {
    if (!sortedReadings.length) return { systolic: 0, diastolic: 0, label: "No Data" };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const recent = sortedReadings.filter((r) => new Date(r.date) >= cutoff);
    const source = recent.length > 0 ? recent : sortedReadings;
    const label = recent.length > 0 ? "30-Day Average" : "All-Time Average";
    const totals = source.reduce(
      (acc, r) => {
        acc.systolic += Number(r.systolic);
        acc.diastolic += Number(r.diastolic);
        return acc;
      },
      { systolic: 0, diastolic: 0 }
    );
    return {
      systolic: Math.round(totals.systolic / source.length),
      diastolic: Math.round(totals.diastolic / source.length),
      label,
    };
  }, [sortedReadings]);

  const currentStatus = latest
    ? classifyReading(Number(latest.systolic), Number(latest.diastolic))
    : "No Data";

  const avgStatus = classifyReading(avg.systolic, avg.diastolic);

  const titrationAlert = useMemo(() => {
    if (sortedReadings.length < 3) return false;
    const lastThree = sortedReadings.slice(-3);
    return lastThree.every((r) => Number(r.systolic) >= 140 || Number(r.diastolic) >= 90);
  }, [sortedReadings]);

  const chartData = sortedReadings.map((r) => ({
    ...r,
    displayDate: formatDate(r.date),
  }));

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const systolic = Number(form.systolic);
    const diastolic = Number(form.diastolic);

    if (!form.date || !systolic || !diastolic) {
      setError("Please fill in date, systolic, and diastolic.");
      return;
    }

    if (systolic < 70 || systolic > 250 || diastolic < 40 || diastolic > 150) {
      setError("Please enter realistic blood pressure values.");
      return;
    }

    const newReading = {
      id: generateFHIRId(),
      date: form.date,
      systolic,
      diastolic,
      notes: form.notes.trim(),
    };

    setSubmitting(true);
    try {
      if (fhirConn.status === "connected") {
        const serverReading = await postObservationToFHIR(newReading, fhirConn.serverPatientId);
        setData((prev) => ({ ...prev, readings: [...prev.readings, serverReading] }));
      } else {
        setData((prev) => ({ ...prev, readings: [...prev.readings, newReading] }));
      }
      setForm({ date: new Date().toISOString().slice(0, 10), systolic: "", diastolic: "", notes: "" });
    } catch (err) {
      setError(`Failed to save reading: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function resetDemo() {
    setData(seedData);
    setFhirConn({ status: "simulated", serverPatientId: null, error: null });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
  }

  async function handleConnectFHIR() {
    setFhirConn({ status: "connecting", serverPatientId: null, error: null });
    try {
      const { serverPatientId, serverReadings } = await connectToFHIR(data.patient, sortedReadings);
      setData((prev) => ({ ...prev, readings: serverReadings }));
      setFhirConn({ status: "connected", serverPatientId, error: null });
    } catch (err) {
      setFhirConn({ status: "error", serverPatientId: null, error: err.message });
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>PulseFlow</h1>
            <p style={{ marginTop: "8px", color: "#475569" }}>
              Chronic hypertension monitoring dashboard with demo-mode deployment
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Connection status badge */}
            {fhirConn.status === "connected" && (
              <span style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", borderRadius: "999px", padding: "8px 12px", fontSize: "13px", fontWeight: 700 }}>
                ✓ FHIR Connected
              </span>
            )}
            {fhirConn.status === "connecting" && (
              <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: "999px", padding: "8px 12px", fontSize: "13px", fontWeight: 700 }}>
                Connecting…
              </span>
            )}
            {fhirConn.status === "error" && (
              <span style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "999px", padding: "8px 12px", fontSize: "13px", fontWeight: 700 }}>
                FHIR Error
              </span>
            )}
            {fhirConn.status === "simulated" && (
              <span style={{ background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "8px 12px", fontSize: "13px", fontWeight: 700 }}>
                FHIR Simulated
              </span>
            )}

            {/* Connect button — hidden when already connected */}
            {fhirConn.status !== "connected" && (
              <button
                onClick={handleConnectFHIR}
                disabled={fhirConn.status === "connecting"}
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #bbf7d0",
                  background: fhirConn.status === "connecting" ? "#f1f5f9" : "#dcfce7",
                  color: fhirConn.status === "connecting" ? "#94a3b8" : "#166534",
                  cursor: fhirConn.status === "connecting" ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {fhirConn.status === "connecting" ? "Connecting…" : fhirConn.status === "error" ? "Retry FHIR Connect" : "Connect to FHIR Server"}
              </button>
            )}

            <button
              onClick={() => downloadFHIRBundle(sortedReadings, data.patient)}
              style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", cursor: "pointer", fontWeight: 600 }}
            >
              Download FHIR Bundle
            </button>
            <button
              onClick={resetDemo}
              style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontWeight: 600 }}
            >
              Reset Demo Data
            </button>
          </div>

          {/* FHIR error detail */}
          {fhirConn.status === "error" && fhirConn.error && (
            <div style={{ width: "100%", marginTop: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#b91c1c" }}>
              {fhirConn.error}
            </div>
          )}

          {/* FHIR server link when connected */}
          {fhirConn.status === "connected" && (
            <div style={{ width: "100%", marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
              Connected to <a href={HAPI_BASE} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{HAPI_BASE}</a> · Patient ID: <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>{fhirConn.serverPatientId}</code>
            </div>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {["patient", "provider"].map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                padding: "10px 24px",
                borderRadius: "10px",
                border: "none",
                background: activeView === view ? "#2563eb" : "#e2e8f0",
                color: activeView === view ? "white" : "#475569",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "14px",
                textTransform: "capitalize",
              }}
            >
              {view === "patient" ? "Patient View" : "Provider View"}
            </button>
          ))}
        </div>

        {/* Patient view: soft alert */}
        {activeView === "patient" && titrationAlert && (
          <div style={{ marginBottom: "24px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <HeartPulse size={20} color="#92400e" />
            <div style={{ color: "#92400e", lineHeight: 1.5 }}>
              Your recent readings have been consistently elevated. Please contact your care provider.
            </div>
          </div>
        )}

        {/* Provider view: full clinical alert */}
        {activeView === "provider" && titrationAlert && (
          <div style={{ marginBottom: "24px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <HeartPulse size={20} color="#b91c1c" />
            <div>
              <div style={{ fontWeight: 800, color: "#991b1b", marginBottom: "4px" }}>Titration Required</div>
              <div style={{ color: "#7f1d1d", lineHeight: 1.5 }}>
                The last 3 readings are consistently above 140/90. Provider follow-up is recommended.
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          {activeView === "provider" && <div style={cardStyle()}>
            <div style={sectionTitleStyle()}>
              <User size={20} /> Patient Context
            </div>
            <div style={{ display: "grid", gap: "10px", color: "#334155", fontSize: "15px" }}>
              <div><strong>Name:</strong> {data.patient.name}</div>
              <div><strong>MRN:</strong> {data.patient.mrn}</div>
              <div><strong>Age:</strong> {data.patient.age}</div>
              <div><strong>Condition:</strong> {data.patient.condition}</div>
              <div>
                <strong>FHIR ID:</strong>{" "}
                <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#1e40af" }}>
                  {fhirConn.status === "connected" ? fhirConn.serverPatientId : toFHIRPatient(data.patient).id}
                </code>
              </div>
            </div>
          </div>}

          <div style={cardStyle()}>
            <div style={sectionTitleStyle()}>
              <Activity size={20} /> Latest Reading
            </div>
            <div style={{ fontSize: "34px", fontWeight: 800, marginBottom: "10px" }}>
              {latest ? `${latest.systolic}/${latest.diastolic}` : "--/--"}
              <span style={{ fontSize: "16px", color: "#64748b", marginLeft: "8px" }}>mmHg</span>
            </div>
            <div style={{ color: "#64748b", marginBottom: "12px", fontSize: "14px" }}>
              {latest ? `Recorded on ${formatDate(latest.date)}` : "No reading available"}
            </div>
            {badge(currentStatus)}
          </div>

          <div style={cardStyle()}>
            <div style={sectionTitleStyle()}>
              <TrendingUp size={20} /> {avg.label}
            </div>
            <div style={{ fontSize: "34px", fontWeight: 800, marginBottom: "10px" }}>
              {avg.systolic}/{avg.diastolic}
              <span style={{ fontSize: "16px", color: "#64748b", marginLeft: "8px" }}>mmHg</span>
            </div>
            <div style={{ color: "#64748b", marginBottom: "12px", fontSize: "14px" }}>
              {avg.label} across stored readings
            </div>
            {badge(avgStatus)}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={cardStyle()}>
            <div style={sectionTitleStyle()}>
              <CalendarDays size={20} /> Blood Pressure Trend
            </div>
            <div style={{ width: "100%", height: "380px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="displayDate" />
                  <YAxis domain={[70, 170]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                  <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: "Sys 140", position: "insideTopRight", fontSize: 11, fill: "#ef4444" }} />
                  <ReferenceLine y={90} stroke="#3b82f6" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: "Dia 90", position: "insideTopRight", fontSize: 11, fill: "#3b82f6" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {activeView === "patient" && <div style={cardStyle()}>
            <div style={sectionTitleStyle()}>Add Reading</div>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Date</label>
                <input
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Systolic</label>
                  <input
                    name="systolic"
                    type="number"
                    placeholder="120"
                    value={form.systolic}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Diastolic</label>
                  <input
                    name="diastolic"
                    type="number"
                    placeholder="80"
                    value={form.diastolic}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>Notes</label>
                <textarea
                  name="notes"
                  placeholder="Optional context for the provider"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              {error && <div style={{ color: "#dc2626", fontSize: "14px" }}>{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: submitting ? "#93c5fd" : "#2563eb",
                  color: "white",
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Saving…" : fhirConn.status === "connected" ? "Save & POST to FHIR" : "Save Reading"}
              </button>

              <div style={{ color: "#64748b", fontSize: "12px", lineHeight: 1.5 }}>
                {fhirConn.status === "connected"
                  ? `Readings are POSTed as FHIR R4 Observation resources to ${HAPI_BASE}`
                  : "Readings are stored locally and structured as FHIR R4 Observation resources."}
              </div>
            </form>
          </div>}
        </div>

        {activeView === "provider" && <div style={cardStyle()}>
          <div style={sectionTitleStyle()}>Recent Readings</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#64748b" }}>
                  <th style={{ padding: "12px 8px" }}>Date</th>
                  <th style={{ padding: "12px 8px" }}>Systolic</th>
                  <th style={{ padding: "12px 8px" }}>Diastolic</th>
                  <th style={{ padding: "12px 8px" }}>Status</th>
                  <th style={{ padding: "12px 8px" }}>Notes</th>
                  <th style={{ padding: "12px 8px" }}>{fhirConn.status === "connected" ? "HAPI FHIR Server ID" : "FHIR Resource ID"}</th>
                </tr>
              </thead>
              <tbody>
                {[...sortedReadings].reverse().map((reading) => {
                  const status = classifyReading(reading.systolic, reading.diastolic);
                  return (
                    <tr key={reading.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 8px" }}>{formatDate(reading.date)}</td>
                      <td style={{ padding: "12px 8px" }}>{reading.systolic}</td>
                      <td style={{ padding: "12px 8px" }}>{reading.diastolic}</td>
                      <td style={{ padding: "12px 8px" }}>{badge(status)}</td>
                      <td style={{ padding: "12px 8px" }}>{reading.notes || "—"}</td>
                      <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: "11px", color: "#64748b" }}>
                        {reading.fhirServerId || toFHIRObservation(reading, data.patient.id).id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>}
      </div>
    </div>
  );
}
