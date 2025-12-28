import './index.css';
import { useState, useEffect } from "react";
import GeneralFeatures from "./GeneralFeatures";
import MonthTabs from "./MonthTabs";

const BUDGET_COOKIE_KEY = "userBudgetData"; // cookie + localStorage (same key)

function getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function setCookie(name, value, days = 365) {
  try {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie =
      `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // ignore cookie failures
  }
}

function hasMonthlyDataForYear(year) {
  try {
    const key = `monthlyData_${year}`;
    const raw = localStorage.getItem(key);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;

    // If any month has some real data, consider it "filled"
    const months = Object.keys(parsed);
    for (const m of months) {
      const md = parsed[m];
      if (!md) continue;

      const current = Number(md.current || 0);
      const inc = Number(md.income || 0);
      const exp = Number(md.expense || 0);
      const hasExpenses = Array.isArray(md.expenses) && md.expenses.length > 0;

      if (current !== 0 || inc !== 0 || exp !== 0 || hasExpenses) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function App() {
  const [generalData, setGeneralData] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [currentView, setCurrentView] = useState("general");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    // 1) Try cookie first (as requested)
    const cookieData = getCookie(BUDGET_COOKIE_KEY);
    if (cookieData) {
      try {
        const parsed = JSON.parse(cookieData);
        setGeneralData(parsed);

        const yr = parsed?.year || new Date().getFullYear();
        setSelectedYear(yr);

        setIsEditing(false);

        // ✅ NEW: If monthly data exists for this year, go straight to MonthTabs
        if (hasMonthlyDataForYear(yr)) {
          setCurrentView("months");
        } else {
          setCurrentView("summary");
        }
        return;
      } catch {
        // fall through
      }
    }

    // 2) Fallback: localStorage
    const savedData = localStorage.getItem(BUDGET_COOKIE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setGeneralData(parsed);

        const yr = parsed?.year || new Date().getFullYear();
        setSelectedYear(yr);

        setIsEditing(false);

        // ✅ NEW: If monthly data exists for this year, go straight to MonthTabs
        if (hasMonthlyDataForYear(yr)) {
          setCurrentView("months");
        } else {
          setCurrentView("summary");
        }
      } catch {
        // ignore bad data
      }
    }
  }, []);

  function handleGeneralSubmit(data) {
    const payload = JSON.stringify(data);

    localStorage.setItem(BUDGET_COOKIE_KEY, payload);
    setCookie(BUDGET_COOKIE_KEY, payload);

    setGeneralData(data);

    const yr = data?.year || new Date().getFullYear();
    setSelectedYear(yr);

    setIsEditing(false);

    // ✅ NEW: if monthly already exists for that year, go months; else summary
    if (hasMonthlyDataForYear(yr)) {
      setCurrentView("months");
    } else {
      setCurrentView("summary");
    }
  }

  function handleGoToMonthlyTabs() {
    setCurrentView("months");
  }

  function handleBackToGeneral() {
    setCurrentView("general");
    setIsEditing(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8 transition-colors duration-500">
      {currentView === "general" && (
        <GeneralFeatures
          onSubmit={handleGeneralSubmit}
          savedData={generalData}
        />
      )}

      {currentView === "months" && (
        <MonthTabs
          selectedYear={selectedYear}
          handleBack={handleBackToGeneral}
        />
      )}

      {currentView === "summary" && (
        <div className="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-xl ring-2 ring-gray-200 dark:ring-gray-700 dark:bg-gray-900">
          <h2 className="text-4xl font-extrabold mb-8 text-center text-indigo-600 dark:text-indigo-400">
            Budget Summary
          </h2>

          <div className="text-center mb-6">
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">
              Year: {generalData?.year || "N/A"}
            </p>

            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-4">
              Primary Salary: {generalData?.currency || "AED"}{" "}
              {Number(generalData?.primarySalary || 0).toLocaleString()}
            </p>
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">
              Family Salary: {generalData?.currency || "AED"}{" "}
              {Number(generalData?.familySalary || 0).toLocaleString()}
            </p>

            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-4">
              Total Salary: {generalData?.currency || "AED"}{" "}
              {(
                Number(generalData?.primarySalary || 0) +
                Number(generalData?.familySalary || 0)
              ).toLocaleString()}
            </p>

            <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">
              Total Expenses: {generalData?.currency || "AED"}{" "}
              {generalData?.expenses
                ?.reduce((sum, e) => sum + Number(e.actual || 0), 0)
                .toLocaleString()}
            </p>

            <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">
              Remaining Budget: {generalData?.currency || "AED"}{" "}
              {(
                Number(generalData?.primarySalary || 0) +
                Number(generalData?.familySalary || 0) -
                generalData?.expenses.reduce(
                  (sum, e) => sum + Number(e.actual || 0),
                  0
                )
              ).toLocaleString()}
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-4 items-center">
            <button
              onClick={handleGoToMonthlyTabs}
              className="btn btn-indigo btn-wide text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-3xl shadow-xl transition-transform active:scale-95"
            >
              Go to Monthly Tabs
            </button>

            <button
              onClick={handleBackToGeneral}
              className="px-6 py-3 bg-white text-indigo-700 rounded-3xl shadow-md ring-2 ring-indigo-200 hover:ring-indigo-300"
            >
              Edit General Features
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
