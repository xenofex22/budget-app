import './index.css';
import { useState, useEffect } from "react";
import GeneralFeatures from "./GeneralFeatures";
import MonthTabs from "./MonthTabs";
import Forecast from "./Forecast";

function App() {
  const [generalData, setGeneralData] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [currentView, setCurrentView] = useState("general");

  useEffect(() => {
    const savedData = localStorage.getItem("userBudgetData");
    if (savedData) {
      setGeneralData(JSON.parse(savedData));
    }
  }, []);

  function handleGeneralSubmit(data) {
    localStorage.setItem("userBudgetData", JSON.stringify(data));
    setGeneralData(data);
    setIsEditing(false);
    setCurrentView("summary");
  }

  function handleGoToMonthlyTabs() {
    setCurrentView("months");
  }

  function handleBackToGeneral() {
    setCurrentView("general");
    setIsEditing(true);
  }

  function handleGoToForecast() {
    setCurrentView("forecast");
  }

  function handleBackToMonths() {
    setCurrentView("months");
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8 transition-colors duration-500">
      {currentView === "general" && (
        <GeneralFeatures
          onSubmit={handleGeneralSubmit}
          savedData={generalData}
          onGoToMonthlyTabs={handleGoToMonthlyTabs}
        />
      )}

      {currentView === "months" && (
        <MonthTabs handleBack={handleBackToGeneral} handleGoToForecast={handleGoToForecast} />
      )}

      {currentView === "forecast" && (
        <Forecast handleBack={handleBackToMonths} />
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
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              Salary: {generalData?.currency || "AED"} {generalData?.salary?.toLocaleString()}
            </p>
            <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">
              Total Expenses: {generalData?.currency || "AED"}{" "}
              {generalData?.expenses?.reduce((sum, e) => sum + Number(e.actual || 0), 0).toLocaleString()}
            </p>
            <p className="text-xl font-semibold text-gray-600 dark:text-gray-300 mt-4">
              Remaining Budget: {generalData?.currency || "AED"}{" "}
              {(
                generalData?.salary -
                generalData?.expenses.reduce((sum, e) => sum + Number(e.actual || 0), 0)
              ).toLocaleString()}
            </p>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={handleGoToMonthlyTabs}
              className="btn btn-indigo btn-wide text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-3xl shadow-xl transition-transform active:scale-95"
            >
              Go to Monthly Tabs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
