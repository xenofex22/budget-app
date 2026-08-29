import './index.css';
import { useEffect, useRef, useState } from "react";
import GeneralFeatures from "./GeneralFeatures";
import MonthTabs from "./MonthTabs";
import LoginScreen from "./LoginScreen";
import {
  applyBudgetSnapshot,
  clearBudgetCache,
  collectBudgetSnapshot,
  fetchCloudBudget,
  hasLocalBudget,
  saveCloudBudget,
} from "./cloudStorage";

const BUDGET_KEY = "userBudgetData";

function hasMonthlyDataForYear(year) {
  try {
    const raw = localStorage.getItem(`monthlyData_${year}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;

    return Object.values(parsed).some((md) => {
      if (!md) return false;
      return (
        Number(md.current || 0) !== 0 ||
        Number(md.income || 0) !== 0 ||
        Number(md.expense || 0) !== 0 ||
        (Array.isArray(md.expenses) && md.expenses.length > 0)
      );
    });
  } catch {
    return false;
  }
}

function BudgetApp() {
  const [generalData, setGeneralData] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [currentView, setCurrentView] = useState("general");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const savedData = localStorage.getItem(BUDGET_KEY);
    if (!savedData) return;

    try {
      const parsed = JSON.parse(savedData);
      setGeneralData(parsed);
      const yr = parsed?.year || new Date().getFullYear();
      setSelectedYear(yr);
      setIsEditing(false);
      setCurrentView(hasMonthlyDataForYear(yr) ? "months" : "summary");
    } catch {
      // Ignore malformed legacy cache.
    }
  }, []);

  function handleGeneralSubmit(data) {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(data));
    setGeneralData(data);
    const yr = data?.year || new Date().getFullYear();
    setSelectedYear(yr);
    setIsEditing(false);
    setCurrentView(hasMonthlyDataForYear(yr) ? "months" : "summary");
  }

  function handleBackToGeneral() {
    setCurrentView("general");
    setIsEditing(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8 transition-colors duration-500">
      {currentView === "general" && (
        <GeneralFeatures onSubmit={handleGeneralSubmit} savedData={generalData} />
      )}

      {currentView === "months" && (
        <MonthTabs selectedYear={selectedYear} handleBack={handleBackToGeneral} />
      )}

      {currentView === "summary" && (
        <div className="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-xl ring-2 ring-gray-200 dark:ring-gray-700 dark:bg-gray-900">
          <h2 className="text-4xl font-extrabold mb-8 text-center text-indigo-600 dark:text-indigo-400">Budget Summary</h2>
          <div className="text-center mb-6">
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">Year: {generalData?.year || "N/A"}</p>
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-4">Primary Salary: {generalData?.currency || "AED"} {Number(generalData?.primarySalary || 0).toLocaleString()}</p>
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Family Salary: {generalData?.currency || "AED"} {Number(generalData?.familySalary || 0).toLocaleString()}</p>
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-4">Total Salary: {generalData?.currency || "AED"} {(Number(generalData?.primarySalary || 0) + Number(generalData?.familySalary || 0)).toLocaleString()}</p>
            <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">Total Expenses: {generalData?.currency || "AED"} {generalData?.expenses?.reduce((sum, e) => sum + Number(e.actual || 0), 0).toLocaleString()}</p>
            <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">Remaining Budget: {generalData?.currency || "AED"} {(Number(generalData?.primarySalary || 0) + Number(generalData?.familySalary || 0) - (generalData?.expenses || []).reduce((sum, e) => sum + Number(e.actual || 0), 0)).toLocaleString()}</p>
          </div>
          <div className="mt-10 flex flex-col gap-4 items-center">
            <button onClick={() => setCurrentView("months")} className="px-8 py-4 text-white text-xl font-extrabold bg-indigo-700 hover:bg-indigo-800 rounded-3xl shadow-xl">Go to Monthly Tabs</button>
            <button onClick={handleBackToGeneral} className="px-6 py-3 bg-white text-indigo-700 rounded-3xl shadow-md ring-2 ring-indigo-200 hover:ring-indigo-300">Edit General Features</button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [authState, setAuthState] = useState("checking");
  const [username, setUsername] = useState("");
  const [appKey, setAppKey] = useState(0);
  const [syncState, setSyncState] = useState("Cloud ready");
  const lastSnapshot = useRef("");

  async function hydrateAccount(name) {
    setSyncState("Loading cloud data...");
    const localBefore = collectBudgetSnapshot();
    const cloud = await fetchCloudBudget();

    if (cloud.data) {
      applyBudgetSnapshot(cloud.data);
    } else if (hasLocalBudget(localBefore)) {
      const shouldImport = window.confirm("Existing budget data was found on this device. Import it into your account?");
      if (shouldImport) await saveCloudBudget(localBefore);
    }

    lastSnapshot.current = JSON.stringify(collectBudgetSnapshot());
    setUsername(name);
    setAppKey((value) => value + 1);
    setAuthState("authenticated");
    setSyncState("Cloud synced");
  }

  useEffect(() => {
    let active = true;
    fetch("/api/session", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("not signed in");
        return response.json();
      })
      .then((data) => active && hydrateAccount(data.username))
      .catch(() => active && setAuthState("anonymous"));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return undefined;

    const timer = setInterval(async () => {
      const snapshot = collectBudgetSnapshot();
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSnapshot.current) return;

      try {
        setSyncState("Saving...");
        await saveCloudBudget(snapshot);
        lastSnapshot.current = serialized;
        setSyncState("Cloud synced");
      } catch {
        setSyncState("Sync problem");
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [authState]);

  async function handleLogout() {
    try {
      await saveCloudBudget(collectBudgetSnapshot());
    } catch {
      // Logout should still work if cloud save is temporarily unavailable.
    }
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    clearBudgetCache();
    lastSnapshot.current = "";
    setUsername("");
    setAuthState("anonymous");
  }

  if (authState === "checking") {
    return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white text-xl">Opening Smart Budget...</div>;
  }

  if (authState === "anonymous") {
    return <LoginScreen onLogin={hydrateAccount} />;
  }

  return (
    <>
      <div className="fixed top-3 right-3 z-50 flex items-center gap-3 bg-white/95 dark:bg-gray-900/95 shadow-lg rounded-2xl px-4 py-2 text-sm">
        <div>
          <div className="font-bold text-gray-800 dark:text-gray-100">{username}</div>
          <div className="text-xs text-gray-500">{syncState}</div>
        </div>
        <button onClick={handleLogout} className="px-3 py-2 rounded-xl bg-gray-800 text-white hover:bg-gray-950">Logout</button>
      </div>
      <BudgetApp key={appKey} />
    </>
  );
}

export default App;
