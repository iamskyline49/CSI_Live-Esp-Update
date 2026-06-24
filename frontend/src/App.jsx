import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const DEVICE_ID = "esp32-001";
const MAX_HISTORY = 12;

function App() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onLoading, setOnLoading] = useState(false);
  const [offLoading, setOffLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [error, setError] = useState("");

  const fetchDeviceStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/status/`);
      const result = response.data;

      setStatus(result);
      setError("");

      const deviceData = result?.data;
      const currentRelayState = deviceData?.device_state || "unknown";

      // Clear pending command only when ESP32 acknowledgement is received
      // and backend receives device_state from ESP32 MQTT response.
      if (pendingCommand === "on" && currentRelayState === "on") {
        setPendingCommand(null);
      }

      if (pendingCommand === "off" && currentRelayState === "off") {
        setPendingCommand(null);
      }

      const newHistoryRow = {
        id: Date.now(),
        dashboardTime: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        esp32Status: result?.esp32_connected ? "CONNECTED" : "UNKNOWN",
        pressure: result?.esp32_connected ? result?.pressure_text : "Unknown",
        relayDevice: result?.esp32_connected
          ? result?.relay_device_text
          : "Unknown",
        optoPin: result?.esp32_connected ? deviceData?.opto_pin : "Unknown",
        esp32Time: result?.esp32_connected
          ? deviceData?.last_seen_display
          : "Unknown",
      };

      setHistory((previous) => {
        const updated = [newHistoryRow, ...previous];
        return updated.slice(0, MAX_HISTORY);
      });
    } catch (err) {
      setError("Backend not connected. Please run Django server.");
    } finally {
      setLoading(false);
    }
  };

  const turnOnRelayDevice = async () => {
    try {
      setOnLoading(true);
      setPendingCommand("on");

      const response = await axios.post(`${API_BASE_URL}/device/on/`, {
        device_id: DEVICE_ID,
      });

      if (!response.data.api_success) {
        setPendingCommand(null);
        alert("Failed to send relay device ON command.");
      }

      // Do not update frontend state here.
      // Wait until ESP32 sends MQTT response: device_state = "on".
      setTimeout(fetchDeviceStatus, 1000);
    } catch (err) {
      setPendingCommand(null);
      alert("Failed to send relay device ON command.");
    } finally {
      setOnLoading(false);
    }
  };

  const turnOffRelayDevice = async () => {
    try {
      setOffLoading(true);
      setPendingCommand("off");

      const response = await axios.post(`${API_BASE_URL}/device/off/`, {
        device_id: DEVICE_ID,
      });

      if (!response.data.api_success) {
        setPendingCommand(null);
        alert("Failed to send relay device OFF command.");
      }

      // Do not update frontend state here.
      // Wait until ESP32 sends MQTT response: device_state = "off".
      setTimeout(fetchDeviceStatus, 1000);
    } catch (err) {
      setPendingCommand(null);
      alert("Failed to send relay device OFF command.");
    } finally {
      setOffLoading(false);
    }
  };

  const resetDeviceState = async () => {
    try {
      setResetLoading(true);
      setPendingCommand(null);

      const response = await axios.post(`${API_BASE_URL}/device/reset/`, {
        device_id: DEVICE_ID,
      });

      setStatus(response.data);
      setHistory([]);
    } catch (err) {
      alert("Failed to reset device state.");
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceStatus();

    const interval = setInterval(() => {
      fetchDeviceStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingCommand]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-card">
          <div className="loader"></div>
          <h2>Loading Dashboard...</h2>
        </div>
      </div>
    );
  }

  const deviceData = status?.data;

  const esp32Connected = status?.esp32_connected === true;
  const pressureStatus = deviceData?.pressure_status || "unknown";
  const relayDeviceState = deviceData?.device_state || "unknown";

  const isPressureLow = esp32Connected && pressureStatus === "low";
  const isPressureNormal = esp32Connected && pressureStatus === "normal";
  const isRelayDeviceOn = esp32Connected && relayDeviceState === "on";
  const isWaitingForAck = pendingCommand !== null;

  const optoPin = esp32Connected ? deviceData?.opto_pin : "Unknown";
  const lastSeenDisplay = esp32Connected
    ? deviceData?.last_seen_display
    : "Unknown";
  const lastMessage = esp32Connected
    ? deviceData?.last_message || "No MQTT message received"
    : "Unknown";


  const turnOnDisabled =
    !esp32Connected ||
    isWaitingForAck ||
    isRelayDeviceOn ||
    onLoading ||
    offLoading;

  const turnOffDisabled =
    !esp32Connected ||
    isWaitingForAck ||
    !isRelayDeviceOn ||
    onLoading ||
    offLoading;

  return (
    <div className="page">
      <div className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">CSI IoT Monitoring System</p>
            <h1>CSI Smart Tech Pressure Control Dashboard (Pilot)</h1>
          </div>

          <div
            className={
              esp32Connected ? "live-badge online" : "live-badge offline"
            }
          >
            <span></span>
            {esp32Connected ? "Live" : "Offline"}
          </div>
        </header>

        {error && <div className="error-box">{error}</div>}

        {isWaitingForAck && (
          <div className="pending-box">
            Waiting for ESP32 acknowledgement for{" "}
            <strong>
              {pendingCommand === "on" ? "TURN_ON_DEVICE" : "TURN_OFF_DEVICE"}
            </strong>
            ...
          </div>
        )}

        <section className="summary-grid">
          <div
            className={
              esp32Connected
                ? "summary-card esp32-green"
                : "summary-card esp32-red"
            }
          >
            <span>ESP32 Status</span>
            <strong>{esp32Connected ? "CONNECTED" : "OFFLINE"}</strong>
            <p>
              {esp32Connected
                ? "Receiving live MQTT data"
                : "No fresh MQTT data"}
            </p>
          </div>

          <div
            className={
              isPressureNormal
                ? "summary-card pressure-green"
                : isPressureLow
                  ? "summary-card pressure-red"
                  : "summary-card warning"
            }
          >
            <span>Pressure Status</span>
            <strong>{esp32Connected ? status.pressure_text : "Unknown"}</strong>
            <p>
              {isPressureLow
                ? "Low pressure detected"
                : isPressureNormal
                  ? "Pressure is normal"
                  : "Waiting for sensor data"}
            </p>
          </div>

          <div
            className={
              !esp32Connected
                ? "summary-card muted"
                : isRelayDeviceOn
                  ? "summary-card relay-green"
                  : "summary-card relay-red"
            }
          >
            <span>Relay Device</span>
            <strong>
              {esp32Connected ? status.relay_device_text : "Unknown"}
            </strong>
            <p>
              {isWaitingForAck
                ? "Waiting for ESP32 acknowledgement"
                : isRelayDeviceOn
                  ? "Relay-controlled device is ON"
                  : "Relay-controlled device is OFF/Unknown"}
            </p>
          </div>

          <div className="summary-card time-card">
            <span>Last Updated</span>
            <strong>{lastSeenDisplay}</strong>
            <p>
              {esp32Connected
                ? "Latest received time in BDT"
                : "Waiting for ESP32 data"}
            </p>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Live Data Table</h2>
                <p>Current real-time data from ESP32 and backend</p>
              </div>

              <button className="small-button" onClick={fetchDeviceStatus}>
                Refresh
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <tbody>
                  <tr>
                    <th>Device ID</th>
                    <td>
                      {esp32Connected ? deviceData?.device_id : "Unknown"}
                    </td>
                  </tr>

                  <tr>
                    <th>ESP32 Connection</th>
                    <td>
                      <span
                        className={
                          esp32Connected ? "pill green" : "pill orange"
                        }
                      >
                        {esp32Connected ? "CONNECTED" : "UNKNOWN"}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <th>Pressure Status</th>
                    <td>
                      <span
                        className={
                          isPressureLow
                            ? "pill red"
                            : isPressureNormal
                              ? "pill green"
                              : "pill orange"
                        }
                      >
                        {esp32Connected ? status.pressure_text : "Unknown"}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <th>Relay Device Status</th>
                    <td>
                      <span
                        className={isRelayDeviceOn ? "pill blue" : "pill red"}
                      >
                        {esp32Connected ? status.relay_device_text : "Unknown"}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <th>Last Updated</th>
                    <td>{lastSeenDisplay}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel control-panel">
            <div className="panel-header">
              <div>
                <h2>Relay Control</h2>
                <p>Control the relay-connected device</p>
              </div>
            </div>

            <div className="control-status">
              {esp32Connected ? (
                <>
                  <h3>Relay Device Control</h3>
                  <p>
                    {isWaitingForAck
                      ? "Command sent. Waiting for ESP32 acknowledgement before changing state."
                      : isRelayDeviceOn
                        ? "Relay device is ON. You can turn it OFF now."
                        : "Relay device is OFF/Unknown. You can turn it ON now."}
                  </p>
                </>
              ) : (
                <>
                  <h3>System Offline</h3>
                  <p>Control buttons are disabled until ESP32 is connected.</p>
                </>
              )}
            </div>

            <div className="button-row">
              <button
                className="turn-on-button"
                onClick={turnOnRelayDevice}
                disabled={turnOnDisabled}
              >
                {onLoading ? "Sending ON..." : "Turn ON Relay Device"}
              </button>

              <button
                className="turn-off-button"
                onClick={turnOffRelayDevice}
                disabled={turnOffDisabled}
              >
                {offLoading ? "Sending OFF..." : "Turn OFF Relay Device"}
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Recent Real-Time Data Log</h2>
              <p>Frontend polling history, updated every second</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Dashboard Time</th>
                  <th>ESP32 Status</th>
                  <th>Pressure</th>
                  <th>Relay Device</th>
                  <th>Opto Pin</th>
                  <th>ESP32 Time</th>
                </tr>
              </thead>

              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-cell">
                      No data yet
                    </td>
                  </tr>
                ) : (
                  history.map((row) => (
                    <tr key={row.id}>
                      <td>{row.dashboardTime}</td>
                      <td>{row.esp32Status}</td>
                      <td>{row.pressure}</td>
                      <td>{row.relayDevice}</td>
                      <td>{row.optoPin}</td>
                      <td>{row.esp32Time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
