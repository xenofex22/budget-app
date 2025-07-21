import React, { useState, useEffect } from "react";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function MonthTabs({ handleBack }) {
  const currentMonthIndex = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(months[currentMonthIndex]);
  const [monthlyData, setMonthlyData] = useState({});

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("monthlyData");
    if (savedData) {
      setMonthlyData(JSON.parse(savedData));
    } else {
      const initialData = {};
      months.forEach((m) => {
        initialData[m] = { current: 0, expenses: [], income: 0, expense: 0 };
      });
      setMonthlyData(initialData);
      localStorage.setItem("monthlyData", JSON.stringify(initialData));
    }
  }, []);

  // Save data to localStorage whenever monthlyData changes
  useEffect(() => {
    if (Object.keys(monthlyData).length > 0) {
      localStorage.setItem("monthlyData", JSON.stringify(monthlyData));
    }
  }, [monthlyData]);

  const calculateDaysLeft = (month) => {
    const today = new Date();
    const year = today.getFullYear();
    const monthIndex = months.indexOf(month);

    // For past months, return 1 to avoid division issues
    if (monthIndex < currentMonthIndex) return 1;

    const lastDayOfMonth = new Date(year, monthIndex, 27);
    const daysLeft = Math.ceil((lastDayOfMonth - today) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? daysLeft : 1;
  };

  const handleCurrentChange = (month, value) => {
    setMonthlyData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        current: parseFloat(value) || 0,
      },
    }));
  };

  const handleExpenseChange = (month, index, field, value) => {
    const monthData = monthlyData[month] || {};
    const updatedExpenses = [...(monthData.expenses || [])];
    updatedExpenses[index] = {
      ...updatedExpenses[index],
      [field]: value,
    };

    setMonthlyData((prev) => ({
      ...prev,
      [month]: {
        ...monthData,
        expenses: updatedExpenses,
      },
    }));
  };

  const handleAddExpense = (month) => {
    const monthData = monthlyData[month] || {};
    const updatedExpenses = [
      ...(monthData.expenses || []),
      { name: "", expected: 0, actual: 0 },
    ];

    setMonthlyData((prev) => ({
      ...prev,
      [month]: {
        ...monthData,
        expenses: updatedExpenses,
      },
    }));
  };

  const handleDeleteExpense = (month, index) => {
    const monthData = monthlyData[month] || {};
    const updatedExpenses = [...(monthData.expenses || [])];
    updatedExpenses.splice(index, 1);

    setMonthlyData((prev) => ({
      ...prev,
      [month]: {
        ...monthData,
        expenses: updatedExpenses,
      },
    }));
  };

  const handleForecastChange = (month, field, value) => {
    setMonthlyData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: parseFloat(value) || 0,
      },
    }));
  };

  const calculateRemainingBalance = (month) => {
    const monthData = monthlyData[month] || {};
    const totalExpected = (monthData.expenses || []).reduce(
      (sum, e) => sum + parseFloat(e.expected || 0),
      0
    );
    const currentBalance = monthData.current || 0;
    return currentBalance - totalExpected;
  };

  const forecastNextMonthDailySpend = (month) => {
    const currentBalance = calculateRemainingBalance(selectedMonth);
    const selectedIndex = months.indexOf(selectedMonth);
    const targetIndex = months.indexOf(month);

    let forecastBalance = currentBalance;
    for (let i = selectedIndex + 1; i <= targetIndex; i++) {
      const m = months[i];
      const inc = monthlyData[m]?.income || 0;
      const exp = monthlyData[m]?.expense || 0;
      forecastBalance += inc - exp;
    }

    const daysLeft = calculateDaysLeft(month);
    return daysLeft > 0 ? forecastBalance / daysLeft : 0;
  };

  const currentData = monthlyData[selectedMonth] || {};

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-xl ring-2 ring-gray-200 dark:ring-gray-700 dark:bg-gray-900">
      {/* Month Navigation Tabs */}
      <div className="flex justify-between mb-6 flex-wrap">
        {months.map((month) => (
          <button
            key={month}
            onClick={() => setSelectedMonth(month)}
            className={`py-2 px-4 rounded-lg text-lg font-semibold transition-all duration-300 ${
              selectedMonth === month
                ? "bg-indigo-600 text-white"
                : "bg-indigo-100 text-gray-800 hover:bg-indigo-200"
            }`}
          >
            {month}
          </button>
        ))}
      </div>

      <h3 className="text-3xl font-bold mb-6 text-indigo-600 dark:text-indigo-400">
        {selectedMonth} Budget
      </h3>

      {/* Current Account */}
      <div className="mb-6">
        <label className="block mb-2">Current Account:</label>
        <input
          type="number"
          value={currentData.current || ""}
          onChange={(e) => handleCurrentChange(selectedMonth, e.target.value)}
          className="w-full p-3 rounded-md border"
          placeholder="Enter current balance"
        />
      </div>

      {/* Forecast Inputs for Future Months */}
      <div className="mb-6">
        <h4 className="text-xl font-semibold text-indigo-700">
          Forecast Income and Expenses
        </h4>
        {months.slice(months.indexOf(selectedMonth) + 1).map((month) => (
          <div
            key={month}
            className="flex justify-between mt-2 bg-indigo-50 p-3 rounded-md"
          >
            <label>{month} Income:</label>
            <input
              type="number"
              value={monthlyData[month]?.income || ""}
              onChange={(e) =>
                handleForecastChange(month, "income", e.target.value)
              }
              className="w-1/3 p-2 border rounded"
              placeholder={`Enter ${month} income`}
            />
            <label className="ml-4">{month} Expense:</label>
            <input
              type="number"
              value={monthlyData[month]?.expense || ""}
              onChange={(e) =>
                handleForecastChange(month, "expense", e.target.value)
              }
              className="w-1/3 p-2 border rounded"
              placeholder={`Enter ${month} expense`}
            />
          </div>
        ))}
      </div>

      {/* Forecasted Daily Spend */}
      <div className="mb-6">
        <h4 className="text-xl font-semibold text-indigo-700">
          Forecasted Daily Spend:
        </h4>
        <ul>
          {months.slice(months.indexOf(selectedMonth) + 1).map((month) => (
            <li key={month} className="text-blue-600">
              {month}: {forecastNextMonthDailySpend(month).toFixed(2)} AED
            </li>
          ))}
        </ul>
      </div>

      {/* Expense Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left table-auto border-collapse">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="px-6 py-3 text-lg">Expense Name</th>
              <th className="px-6 py-3 text-lg">Expected</th>
              <th className="px-6 py-3 text-lg">Actual</th>
              <th className="px-6 py-3 text-lg">Delete</th>
            </tr>
          </thead>
          <tbody>
            {(currentData.expenses || []).map((expense, index) => (
              <tr
                key={index}
                className={index % 2 === 0 ? "bg-indigo-50" : ""}
              >
                <td className="px-6 py-4">
                  <input
                    type="text"
                    value={expense.name || ""}
                    onChange={(e) =>
                      handleExpenseChange(selectedMonth, index, "name", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-indigo-300 rounded-lg"
                    placeholder="Expense Name"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={expense.expected || ""}
                    onChange={(e) =>
                      handleExpenseChange(selectedMonth, index, "expected", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-indigo-300 rounded-lg"
                    placeholder="Expected"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={expense.actual || ""}
                    onChange={(e) =>
                      handleExpenseChange(selectedMonth, index, "actual", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-indigo-300 rounded-lg"
                    placeholder="Actual"
                  />
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDeleteExpense(selectedMonth, index)}
                    className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Expense Button */}
      <div className="mt-4 text-center">
        <button
          onClick={() => handleAddExpense(selectedMonth)}
          className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-red-500 text-white rounded-3xl shadow-md"
        >
          + Add Expense
        </button>
      </div>

      {/* Balance Summary */}
      <div className="mt-6 text-lg font-semibold">
        <div className="mb-4">
          <label className="block mb-2">What Would Be Left:</label>
          <p className="font-bold text-indigo-700 dark:text-indigo-300">
            {isNaN(calculateRemainingBalance(selectedMonth))
              ? "Invalid value"
              : calculateRemainingBalance(selectedMonth).toFixed(2)}
          </p>
        </div>
        <div className="mb-4">
          <label className="block mb-2">Days Left:</label>
          <p className="font-bold text-indigo-700 dark:text-indigo-300">
            {calculateDaysLeft(selectedMonth)}
          </p>
        </div>
        <div className="mb-4">
          <label className="block mb-2">Daily Spend:</label>
          <p className="font-bold text-indigo-700 dark:text-indigo-300">
            {calculateDaysLeft(selectedMonth) > 0
              ? (calculateRemainingBalance(selectedMonth) / calculateDaysLeft(selectedMonth)).toFixed(2)
              : "0.00"}
          </p>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-10 text-center">
        <button
          onClick={handleBack}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-3xl shadow-md"
        >
          Back to General Features
        </button>
      </div>
    </div>
  );
}

export default MonthTabs;
