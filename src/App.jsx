import './index.css';
import { useEffect, useRef, useState } from "react";
import GeneralFeatures from "./GeneralFeatures";
import MonthTabs from "./MonthTabs";
import LoginScreen from "./LoginScreen";
import CardManager from "./CardManager";
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
  const [monthTabsKey, setMonthTabsKey] = useState(0);

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
        <div className="w-full">
          <CardManager
            selectedYear={selectedYear}
            onBudgetChanged={() => setMonthTabsKey((value) => value + 1)}
          />
          <MonthTabs
            key={monthTabsKey}
            selectedYear={selectedYear}
            handleBack={handleBackToGeneral}
          />
        </div>
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
  const lastCloudUpdatedAt = useRef("");

  async function hydrateAccount(name) {
    setSyncState("Loading cloud data...");
    const localBefore = collectBudgetSnapshot();
    const cloud = await fetchCloudBudget();

    if (cloud.data) {
      applyBudgetSnapshot(cloud.data);
      lastCloudUpdatedAt.current = cloud.data.updatedAt || "";
    } else if (hasLocalBudget(localBefore)) {
      const shouldImport = window.confirm("Existing budget data was found on this device. Import it into your account?");
      if (shouldImport) {
        const saved = await saveCloudBudget(localBefore);
        lastCloudUpdatedAt.current = saved.updatedAt || "";
      }
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

    const saveTimer = setInterval(async () => {
      const snapshot = collectBudgetSnapshot();
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSnapshot.current) return;

      try {
        setSyncState("Saving...");
        const saved = await saveCloudBudget(snapshot);
        lastSnapshot.current = serialized;
        lastCloudUpdatedAt.current = saved.updatedAt || lastCloudUpdatedAt.current;
        setSyncState("Cloud synced");
      } catch {
        setSyncState("Sync problem");
      }
    }, 1500);

    const refreshTimer = setInterval(async () => {
      const current = JSON.stringify(collectBudgetSnapshot());
      if (current !== lastSnapshot.current) return;

      try {
        const cloud = await fetchCloudBudget();
        const updatedAt = cloud.data?.updatedAt || "";
        if (!cloud.data || !updatedAt || updatedAt === lastCloudUpdatedAt.current) return;

        applyBudgetSnapshot(cloud.data);
        lastCloudUpdatedAt.current = updatedAt;
        lastSnapshot.current = JSON.stringify(collectBudgetSnapshot());
        setAppKey((value) => value + 1);
        setSyncState("Cloud refreshed");
      } catch {
        // Keep the current browser state if the refresh check fails.
      }
    }, 5000);

    return () => {
      clearInterval(saveTimer);
      clearInterval(refreshTimer);
    };
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
    lastCloudUpdatedAt.current = "";
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
    <div className="min-h-screen bg-indigo-50 dark:bg-gray-900">
      <header className="sticky top-0 z-50 w-full border-b border-indigo-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">Signed in as</div>
            <div className="font-extrabold text-indigo-700 dark:text-indigo-300 truncate">{username}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm font-semibold text-gray-500 dark:text-gray-400">{syncState}</div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold shadow hover:bg-red-700 active:scale-95 transition"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <BudgetApp key={appKey} />
    </div>
  );
}

export default App;
