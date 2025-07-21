import React, { useState, useEffect } from "react";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function Forecast({ handleBack }) {
  const currentMonthIndex = new Date().getMonth();
  const [forecastData, setForecastData] = useState({});

  useEffect(() => {
    const savedForecast = localStorage.getItem("forecastData");
    if (savedForecast) {
      setForecastData(JSON.parse(savedForecast));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("forecastData", JSON.stringify(forecastData));
  }, [forecastData]);

  const handleForecastChange = (month, field, value) => {
    setForecastData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: parseFloat(value) || 0,
      },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-xl ring-2 ring-gray-200 dark:ring-gray-700 dark:bg-gray-900">
      <h3 className="text-3xl font-bold mb-6 text-indigo-600 dark:text-indigo-400">
        Manage Forecast for Upcoming Months
      </h3>

      {/* Forecast Table */}
      <div className="space-y-4">
        {months.slice(currentMonthIndex + 1).map((month) => (
          <div key={month} className="bg-indigo-50 p-4 rounded-lg">
            <h4 className="text-xl font-semibold text-indigo-700 mb-2">{month}</h4>
            <div className="flex justify-between items-center mb-2">
              <label>Income:</label>
              <input
                type="number"
                value={forecastData[month]?.income || ""}
                onChange={(e) => handleForecastChange(month, "income", e.target.value)}
                className="w-1/2 p-2 border rounded-lg"
                placeholder={`Enter ${month} income`}
              />
            </div>
            <div className="flex justify-between items-center">
              <label>Expense:</label>
              <input
                type="number"
                value={forecastData[month]?.expense || ""}
                onChange={(e) => handleForecastChange(month, "expense", e.target.value)}
                className="w-1/2 p-2 border rounded-lg"
                placeholder={`Enter ${month} expense`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={handleBack}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-3xl shadow-md"
        >
          Back to Monthly Tabs
        </button>
      </div>
    </div>
  );
}

export default Forecast;