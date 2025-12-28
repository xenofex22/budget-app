import React, { useState, useEffect, useMemo } from "react";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function MonthTabs({ handleBack, selectedYear }) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const currentMonthIndexThisYear = now.getMonth();

  const defaultMonthIndex = selectedYear === thisYear ? currentMonthIndexThisYear : 0;

  const [selectedMonth, setSelectedMonth] = useState(months[defaultMonthIndex]);
  const [monthlyData, setMonthlyData] = useState({});

  const storageKey = useMemo(() => `monthlyData_${selectedYear}`, [selectedYear]);

  // Load data per year
  useEffect(() => {
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setMonthlyData(parsed);
      } catch {
        const initialData = {};
        months.forEach((m) => {
          initialData[m] = { current: 0, expenses: [], income: 0, expense: 0 };
        });
        setMonthlyData(initialData);
        localStorage.setItem(storageKey, JSON.stringify(initialData));
      }
    } else {
      const initialData = {};
      months.forEach((m) => {
        initialData[m] = { current: 0, expenses: [], income: 0, expense: 0 };
      });
      setMonthlyData(initialData);
      localStorage.setItem(storageKey, JSON.stringify(initialData));
    }
  }, [storageKey]);

  // Reset selected month when year changes
  useEffect(() => {
    setSelectedMonth(months[defaultMonthIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // Save data per year
  useEffect(() => {
    if (Object.keys(monthlyData).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(monthlyData));
    }
  }, [monthlyData, storageKey]);

  // ✅ Live countdown to 27th (salary day), from TODAY
  const calculateDaysLeft = (month) => {
    const today = new Date();
    const thisYearNow = today.getFullYear();
    const thisMonthIdx = today.getMonth();
    const monthIndex = months.indexOf(month);

    if (selectedYear < thisYearNow) return 1;
    if (selectedYear === thisYearNow && monthIndex < thisMonthIdx) return 1;

    const targetDate = new Date(selectedYear, monthIndex, 27);
    if (today > targetDate) return 1;

    const daysLeft = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
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

  // -------------------------------------------------
  // HELPERS
  // -------------------------------------------------

  // Ensure upcoming months have at least N rows in expenses array
  const ensureExpenseRowCountForward = (state, sourceMonth, minRows) => {
    const sourceIndex = months.indexOf(sourceMonth);
    const nextState = { ...state };

    for (let i = sourceIndex + 1; i < months.length; i++) {
      const m = months[i];
      const md = nextState[m] || { current: 0, expenses: [], income: 0, expense: 0 };
      const expenses = Array.isArray(md.expenses) ? [...md.expenses] : [];

      while (expenses.length < minRows) {
        expenses.push({ name: "", expected: 0, actual: 0 });
      }

      nextState[m] = { ...md, expenses };
    }

    return nextState;
  };

  // ✅ Smooth expense title propagation for a SINGLE row index
  // Overwrite future month row title ONLY IF:
  // - target title is empty, OR
  // - target title equals previous title of the edited row (meaning it was auto-filled)
  const propagateSingleExpenseTitleForward = (
    prevState,
    sourceMonth,
    rowIndex,
    newName,
    prevName
  ) => {
    const sourceIndex = months.indexOf(sourceMonth);
    const nextState = { ...prevState };

    for (let i = sourceIndex + 1; i < months.length; i++) {
      const m = months[i];
      const md = nextState[m] || { current: 0, expenses: [], income: 0, expense: 0 };
      const expenses = Array.isArray(md.expenses) ? [...md.expenses] : [];

      // ensure row exists
      while (expenses.length <= rowIndex) {
        expenses.push({ name: "", expected: 0, actual: 0 });
      }

      const existingName = (expenses[rowIndex]?.name || "").toString();

      if (existingName.trim() === "" || existingName === prevName) {
        expenses[rowIndex] = { ...expenses[rowIndex], name: newName };
        nextState[m] = { ...md, expenses };
      }
    }

    return nextState;
  };

  // ✅ Smooth forecast propagation:
  // overwrite future months only if they are 0 OR equal to the previous value of the edited month
  const propagateForecastForward = (prevState, fromMonth, field, newValueNum, prevValueNum) => {
    const fromIndex = months.indexOf(fromMonth);
    const nextState = { ...prevState };

    for (let i = fromIndex + 1; i < months.length; i++) {
      const m = months[i];
      const md = nextState[m] || { current: 0, expenses: [], income: 0, expense: 0 };
      const existing = Number(md[field] || 0);

      if (existing === 0 || existing === prevValueNum) {
        nextState[m] = { ...md, [field]: newValueNum };
      }
    }

    return nextState;
  };

  // -------------------------------------------------
  // HANDLERS
  // -------------------------------------------------

  const handleExpenseChange = (month, index, field, value) => {
    setMonthlyData((prev) => {
      const monthData = prev[month] || { current: 0, expenses: [], income: 0, expense: 0 };
      const oldExpenses = [...(monthData.expenses || [])];

      const prevName = (oldExpenses[index]?.name || "").toString();

      // update current month expense row
      const updatedExpenses = [...oldExpenses];
      updatedExpenses[index] = {
        ...updatedExpenses[index],
        [field]: value,
      };

      let nextState = {
        ...prev,
        [month]: {
          ...monthData,
          expenses: updatedExpenses,
        },
      };

      // ✅ Ensure upcoming months have same number of rows (so titles copy to same row)
      nextState = ensureExpenseRowCountForward(nextState, month, updatedExpenses.length);

      // ✅ Smooth title propagation while typing
      if (field === "name") {
        const newName = (value || "").toString();
        nextState = propagateSingleExpenseTitleForward(
          nextState,
          month,
          index,
          newName,
          prevName
        );
      }

      return nextState;
    });
  };

  const handleAddExpense = (month) => {
    setMonthlyData((prev) => {
      const monthData = prev[month] || { current: 0, expenses: [], income: 0, expense: 0 };
      const updatedExpenses = [
        ...(monthData.expenses || []),
        { name: "", expected: 0, actual: 0 },
      ];

      let nextState = {
        ...prev,
        [month]: {
          ...monthData,
          expenses: updatedExpenses,
        },
      };

      // ✅ make sure upcoming months also have the new empty row
      nextState = ensureExpenseRowCountForward(nextState, month, updatedExpenses.length);

      return nextState;
    });
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
    const newNum = parseFloat(value) || 0;

    setMonthlyData((prev) => {
      const baseMonth = prev[month] || { current: 0, expenses: [], income: 0, expense: 0 };
      const prevNum = Number(baseMonth[field] || 0);

      let nextState = {
        ...prev,
        [month]: {
          ...baseMonth,
          [field]: newNum,
        },
      };

      nextState = propagateForecastForward(nextState, month, field, newNum, prevNum);

      return nextState;
    });
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

  const moveExpectedToActual = (month, index) => {
    const monthData = monthlyData[month] || {};
    const updatedExpenses = [...(monthData.expenses || [])];

    const row = updatedExpenses[index] || {};
    const expectedVal = parseFloat(row.expected || 0) || 0;
    const actualVal = parseFloat(row.actual || 0) || 0;

    updatedExpenses[index] = {
      ...row,
      actual: actualVal + expectedVal,
      expected: 0,
    };

    setMonthlyData((prev) => ({
      ...prev,
      [month]: {
        ...monthData,
        expenses: updatedExpenses,
      },
    }));
  };

  const currentData = monthlyData[selectedMonth] || {};
  const selectedMonthIndex = months.indexOf(selectedMonth);
  const upcomingMonths = months.slice(selectedMonthIndex + 1);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-xl ring-2 ring-gray-200 dark:ring-gray-700 dark:bg-gray-900">
      {/* Header / Year */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
          Year: {selectedYear}
        </h2>
      </div>

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
          value={currentData.current ?? ""}
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
        {upcomingMonths.map((month) => (
          <div
            key={month}
            className="flex justify-between mt-2 bg-indigo-50 p-3 rounded-md"
          >
            <label>{month} Income:</label>
            <input
              type="number"
              value={monthlyData[month]?.income || ""}
              onChange={(e) => handleForecastChange(month, "income", e.target.value)}
              className="w-1/3 p-2 border rounded"
              placeholder={`Enter ${month} income`}
            />
            <label className="ml-4">{month} Expense:</label>
            <input
              type="number"
              value={monthlyData[month]?.expense || ""}
              onChange={(e) => handleForecastChange(month, "expense", e.target.value)}
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
          {upcomingMonths.map((month) => (
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
              <th className="px-6 py-3 text-lg">Move</th>
              <th className="px-6 py-3 text-lg">Actual</th>
              <th className="px-6 py-3 text-lg">Delete</th>
            </tr>
          </thead>
          <tbody>
            {(currentData.expenses || []).map((expense, index) => (
              <tr key={index} className={index % 2 === 0 ? "bg-indigo-50" : ""}>
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
                    value={expense.expected ?? ""}
                    onChange={(e) =>
                      handleExpenseChange(selectedMonth, index, "expected", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-indigo-300 rounded-lg"
                    placeholder="Expected"
                  />
                </td>

                <td className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => moveExpectedToActual(selectedMonth, index)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    title="Move Expected to Actual"
                    aria-label="Move Expected to Actual"
                  >
                    →
                  </button>
                </td>

                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={expense.actual ?? ""}
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
