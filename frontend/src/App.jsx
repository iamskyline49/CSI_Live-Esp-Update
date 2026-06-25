import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

const MAX_ACTIVITY = 8;

function StatusBadge({ online }) {
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-black ring-1 ${
        online
          ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
          : "bg-red-100 text-red-700 ring-red-200"
      }`}
    >
      <span
        className={`h-3 w-3 rounded-full ${
          online
            ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.16)]"
            : "bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.16)]"
        }`}
      ></span>
      {online ? "Online" : "Offline"}
    </div>
  );
}

function SummaryCard({ title, value, description, type }) {
  const styles = {
    green: "from-emerald-600 to-emerald-400 text-white shadow-emerald-100",
    red: "from-red-600 to-rose-400 text-white shadow-red-100",
    blue: "from-blue-700 via-blue-600 to-sky-400 text-white shadow-blue-100",
    amber: "from-amber-500 to-orange-400 text-white shadow-amber-100",
    slate: "from-slate-800 to-slate-600 text-white shadow-slate-200",
  };

  return (
    <div
      className={`rounded-[1.75rem] bg-gradient-to-br p-6 shadow-xl transition duration-200 hover:-translate-y-1 hover:shadow-2xl ${
        styles[type] || styles.slate
      }`}
    >
      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/80">
        {title}
      </p>

      <h2 className="mb-3 text-2xl font-black tracking-tight sm:text-3xl">
        {value}
      </h2>

      <p className="text-sm leading-6 text-white/85">{description}</p>
    </div>
  );
}

function MainButton({ variant, disabled, loading, onClick, children }) {
  const styles = {
    on: "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-emerald-200 hover:shadow-emerald-300",
    off: "bg-gradient-to-r from-red-600 to-rose-400 shadow-red-200 hover:shadow-red-300",
    reset: "bg-slate-700 shadow-slate-200 hover:bg-slate-800",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-5 py-4 text-sm font-black text-white shadow-lg transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none ${
        styles[variant]
      }`}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}

function InfoPanel({ title, children }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-200/70">
      <h2 className="mb-4 text-xl font-black tracking-tight text-slate-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function App() {
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onLoading, setOnLoading] = useState(false);
  const [offLoading, setOffLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [notice, setNotice] = useState("");

  const previousRelayStateRef = useRef(null);
  const firstLoadRef = useRef(true);

  const getBangladeshTime = () => {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/status/`);
      const result = response.data;

      setStatus(result);

      const currentRelayState = result?.relay_state;
      const previousRelayState = previousRelayStateRef.current;
      const validRelayState =
        currentRelayState === "on" || currentRelayState === "off";

      /*
        First load only saves current state.
        It will not show success message on page refresh.
      */
      if (firstLoadRef.current) {
        previousRelayStateRef.current = validRelayState
          ? currentRelayState
          : null;
        firstLoadRef.current = false;
      } else {
        /*
          Dashboard command success.
          This shows message after ESP32 confirms ON/OFF.
        */
        if (pendingCommand === "on" && currentRelayState === "on") {
          setPendingCommand(null);
          setNotice("Device turned ON successfully.");
        } else if (pendingCommand === "off" && currentRelayState === "off") {
          setPendingCommand(null);
          setNotice("Device turned OFF successfully.");
        } else if (
          /*
          Physical button success.
          This works when relay changes from ESP32 physical button.
        */
          !pendingCommand &&
          result?.system_online &&
          validRelayState &&
          previousRelayState &&
          previousRelayState !== currentRelayState
        ) {
          if (currentRelayState === "on") {
            setNotice("Device turned ON successfully.");
          } else {
            setNotice("Device turned OFF successfully.");
          }
        }

        if (validRelayState) {
          previousRelayStateRef.current = currentRelayState;
        }
      }

      const row = {
        id: Date.now(),
        time: getBangladeshTime(),
        system: result.system_online ? "Online" : "Offline",
        pressure: result.pressure_text || "Waiting for data",
        relay: result.relay_text || "Unknown",
      };

      setActivity((previous) => [row, ...previous].slice(0, MAX_ACTIVITY));
    } catch (error) {
      setStatus({
        api_success: false,
        system_online: false,
        system_status_text: "System Offline",
        pressure_status: "unknown",
        pressure_text: "Waiting for data",
        relay_state: "unknown",
        relay_text: "Unknown",
        relay_is_on: false,
        last_update: "Not available",
        message: "Unable to connect to the system.",
      });
    } finally {
      setLoading(false);
    }
  };

  const turnOnDevice = async () => {
    try {
      setNotice("");
      setOnLoading(true);
      setPendingCommand("on");

      const response = await axios.post(`${API_BASE_URL}/device/on/`);

      if (!response.data.api_success) {
        setPendingCommand(null);
        setNotice("Unable to turn ON the device. Please try again.");
      }

      setTimeout(fetchStatus, 700);
    } catch (error) {
      setPendingCommand(null);
      setNotice("Unable to turn ON the device. Please try again.");
    } finally {
      setOnLoading(false);
    }
  };

  const turnOffDevice = async () => {
    try {
      setNotice("");
      setOffLoading(true);
      setPendingCommand("off");

      const response = await axios.post(`${API_BASE_URL}/device/off/`);

      if (!response.data.api_success) {
        setPendingCommand(null);
        setNotice("Unable to turn OFF the device. Please try again.");
      }

      setTimeout(fetchStatus, 700);
    } catch (error) {
      setPendingCommand(null);
      setNotice("Unable to turn OFF the device. Please try again.");
    } finally {
      setOffLoading(false);
    }
  };

  const resetSystem = async () => {
    try {
      setResetLoading(true);
      setPendingCommand(null);
      setNotice("");

      const response = await axios.post(`${API_BASE_URL}/device/reset/`);

      setStatus(response.data);
      setActivity([]);
      setNotice("System data has been reset.");

      previousRelayStateRef.current = null;
      firstLoadRef.current = true;
    } catch (error) {
      setNotice("Unable to reset system data.");
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    const interval = setInterval(() => {
      fetchStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingCommand]);

  const computed = useMemo(() => {
    const systemOnline = status?.system_online === true;
    const pressureStatus = status?.pressure_status || "unknown";
    const relayIsOn = status?.relay_is_on === true;
    const waiting = pendingCommand !== null;

    return {
      systemOnline,
      pressureStatus,
      relayIsOn,
      waiting,
      pressureCardType:
        pressureStatus === "normal"
          ? "green"
          : pressureStatus === "low"
            ? "red"
            : "amber",
      relayCardType: !systemOnline ? "slate" : relayIsOn ? "green" : "red",
      systemCardType: systemOnline ? "green" : "red",
    };
  }, [status, pendingCommand]);

  const {
    systemOnline,
    pressureStatus,
    relayIsOn,
    waiting,
    pressureCardType,
    relayCardType,
    systemCardType,
  } = computed;

  const turnOnDisabled =
    !systemOnline || waiting || relayIsOn || onLoading || offLoading;

  const turnOffDisabled =
    !systemOnline || waiting || !relayIsOn || onLoading || offLoading;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-10">
        <div className="mx-auto mt-24 max-w-sm rounded-[1.75rem] bg-white p-8 text-center shadow-xl shadow-slate-200">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"></div>
          <h2 className="text-xl font-black text-slate-900">
            Loading System...
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Please wait while the dashboard connects.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-2xl shadow-blue-200 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                CSI IoT Monitoring System
              </p>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                CSI Smart Tech Pressure Control Dashboard (Pilot)
              </h1>
            </div>

            <StatusBadge online={systemOnline} />
          </div>
        </header>

        {notice && (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700 shadow-lg shadow-blue-100">
            {notice}
          </div>
        )}

        {waiting && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800 shadow-lg shadow-amber-100">
            Command sent. Waiting for device confirmation...
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="System Status"
            value={status?.system_status_text || "System Offline"}
            description={
              systemOnline
                ? "The system is connected and receiving live data."
                : "The system is not receiving recent device data."
            }
            type={systemCardType}
          />

          <SummaryCard
            title="Pressure"
            value={status?.pressure_text || "Waiting for data"}
            description={
              pressureStatus === "normal"
                ? "Pressure is currently normal."
                : pressureStatus === "low"
                  ? "Low pressure detected. Please check the system."
                  : "Waiting for pressure data."
            }
            type={pressureCardType}
          />

          <SummaryCard
            title="Connected Device"
            value={status?.relay_text || "Unknown"}
            description={
              !systemOnline
                ? "Device status is unavailable."
                : relayIsOn
                  ? "The connected device is currently ON."
                  : "The connected device is currently OFF."
            }
            type={relayCardType}
          />

          <SummaryCard
            title="Last Update"
            value={status?.last_update || "Not available"}
            description="Latest data received from the system."
            type="blue"
          />
        </section>

        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <InfoPanel title="Relay Device Control">
            <div
              className={`mb-5 rounded-3xl border p-5 ${
                !systemOnline
                  ? "border-slate-200 bg-slate-50"
                  : relayIsOn
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
              }`}
            >
              <h3 className="text-2xl font-black text-slate-900">
                {!systemOnline
                  ? "System Offline"
                  : relayIsOn
                    ? "Relay Device is ON"
                    : "Relay Device is OFF"}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {!systemOnline
                  ? "Control is disabled until the system is online."
                  : waiting
                    ? "Please wait for confirmation before sending another command."
                    : relayIsOn
                      ? "You can turn the connected device OFF."
                      : "You can turn the connected device ON."}
              </p>
            </div>

            <div className="grid gap-3">
              <MainButton
                variant="on"
                onClick={turnOnDevice}
                disabled={turnOnDisabled}
                loading={onLoading}
              >
                Turn ON Device
              </MainButton>

              <MainButton
                variant="off"
                onClick={turnOffDevice}
                disabled={turnOffDisabled}
                loading={offLoading}
              >
                Turn OFF Device
              </MainButton>
            </div>
          </InfoPanel>

          <InfoPanel title="System Summary">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-bold text-slate-500">
                  Connection
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    systemOnline
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {systemOnline ? "Online" : "Offline"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-bold text-slate-500">
                  Pressure Status
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    pressureStatus === "normal"
                      ? "bg-emerald-100 text-emerald-700"
                      : pressureStatus === "low"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {status?.pressure_text || "Waiting"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-bold text-slate-500">
                  Relay Device Status
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    relayIsOn
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {status?.relay_text || "Unknown"}
                </span>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-700">
                  {status?.message || "System status is not available."}
                </p>
              </div>
            </div>
          </InfoPanel>
        </section>

        <InfoPanel title="Recent Activity">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Time
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    System
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Pressure
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Device
                  </th>
                </tr>
              </thead>

              <tbody>
                {activity.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-8 text-center text-sm font-bold text-slate-500"
                    >
                      No activity yet
                    </td>
                  </tr>
                ) : (
                  activity.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                        {row.time}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                        {row.system}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                        {row.pressure}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                        {row.relay}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </InfoPanel>
      </div>
    </main>
  );
}

export default App;
