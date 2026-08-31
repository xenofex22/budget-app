import { useState, useEffect } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const DAY_MS = 24 * 60 * 60 * 1000;

function getCurrentSalaryCycle(date = new Date()) {
  const today = new Date(date);
  let startYear = today.getFullYear();
  let startMonth = today.getMonth();

  if (today.getDate() < 27) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  const start = new Date(startYear, startMonth, 27);
  const end = new Date(startYear, startMonth + 1, 26);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const days = Math.round((endUtc - startUtc) / DAY_MS) + 1;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });

  return {
    days,
    label: `${formatter.format(start)} – ${formatter.format(end)}`,
  };
}

function formatMoney(value, currency) {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function GeneralFeatures({ onSubmit, savedData }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(savedData?.year || currentYear);
  const [primarySalary, setPrimarySalary] = useState(savedData?.primarySalary || "");
  const [familySalary, setFamilySalary] = useState(savedData?.familySalary || "");
  const [currency, setCurrency] = useState(savedData?.currency || "AED");
  const [dailySpendTarget, setDailySpendTarget] = useState(savedData?.dailySpendTarget ?? 450);
  const [expenses, setExpenses] = useState(
    savedData?.expenses || Array.from({ length: 3 }, () => ({ name: "", actual: "" }))
  );

  useEffect(() => {
    if (savedData) {
      setYear(savedData.year);
      setPrimarySalary(savedData.primarySalary);
      setFamilySalary(savedData.familySalary);
      setCurrency(savedData.currency);
      setDailySpendTarget(savedData.dailySpendTarget ?? 450);
      setExpenses(savedData.expenses || []);
    }
  }, [savedData]);

  function handleExpenseChange(index, field, value) {
    const newExpenses = [...expenses];
    newExpenses[index] = {
      ...newExpenses[index],
      [field]: field === "name" ? value : value === "" ? "" : Number(value),
    };
    setExpenses(newExpenses);
  }

  function handleSubmit(e) {
    e.preventDefault();

    onSubmit({
      year,
      primarySalary: Number(primarySalary),
      familySalary: Number(familySalary),
      currency,
      dailySpendTarget: Number(dailySpendTarget),
      expenses: expenses.filter((expense) => expense.name.trim() !== ""),
    });
  }

  function addExpenseRow() {
    setExpenses([...expenses, { name: "", actual: "" }]);
  }

  function removeExpenseRow(index) {
    setExpenses(expenses.filter((_, i) => i !== index));
  }

  function clampYear(val) {
    const minY = 2000;
    const maxY = currentYear + 10;
    if (Number.isNaN(val)) return currentYear;
    return Math.min(maxY, Math.max(minY, val));
  }

  function incYear(delta) {
    setYear((prev) => clampYear(Number(prev || currentYear) + delta));
  }

  const salaryCycle = getCurrentSalaryCycle();
  const totalIncome = Number(primarySalary || 0) + Number(familySalary || 0);
  const fixedExpenseTotal = expenses.reduce(
    (sum, expense) => sum + Number(expense.actual || 0),
    0
  );
  const livingBudget = Number(dailySpendTarget || 0) * salaryCycle.days;
  const amountAfterPlan = totalIncome - fixedExpenseTotal - livingBudget;
  const suggestedSavings = Math.max(0, amountAfterPlan);
  const planningShortfall = Math.max(0, -amountAfterPlan);
  const savingsRate = totalIncome > 0 ? (suggestedSavings / totalIncome) * 100 : 0;

  const chartData = {
    labels: expenses.map((expense) => expense.name || "Unnamed"),
    datasets: [
      {
        label: "Fixed Expenses by Category",
        data: expenses.map((expense) => expense.actual || 0),
        backgroundColor: [
          "#4CAF50",
          "#2196F3",
          "#FF5722",
          "#FFC107",
          "#9C27B0",
          "#FF9800",
          "#8BC34A",
          "#03A9F4",
        ],
        borderColor: [
          "#4CAF50", "#2196F3", "#FF5722",
          "#FFC107", "#9C27B0", "#FF9800",
          "#8BC34A", "#03A9F4",
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: {
        labels: {
          font: {
            weight: "bold",
            size: 16,
          },
          color: "#333",
        },
      },
    },
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-4xl mx-auto p-8 bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 rounded-3xl shadow-xl ring-2 ring-gray-200 dark:ring-gray-700 dark:bg-gray-900 transition-all duration-300"
    >
      <h2 className="text-5xl font-extrabold mb-12 text-white text-center tracking-tight">
        Smart Budget
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-10">
        <div>
          <label htmlFor="year" className="block mb-3 font-semibold text-white text-lg">
            Year
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => incYear(-1)}
              className="px-4 py-3 rounded-xl bg-white/90 hover:bg-white font-bold"
              aria-label="Decrease year"
              title="Decrease year"
            >
              −
            </button>
            <input
              id="year"
              type="number"
              min="2000"
              max={currentYear + 10}
              value={year}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") return;
                setYear(clampYear(Number(val)));
              }}
              className="w-full px-5 py-4 rounded-xl border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600 bg-white text-lg"
              required
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => incYear(1)}
              className="px-4 py-3 rounded-xl bg-white/90 hover:bg-white font-bold"
              aria-label="Increase year"
              title="Increase year"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="primarySalary" className="block mb-3 font-semibold text-white text-lg">
            Primary Salary
          </label>
          <input
            id="primarySalary"
            type="number"
            min="0"
            value={primarySalary}
            onChange={(e) => setPrimarySalary(e.target.value)}
            placeholder="Enter your primary salary"
            className="w-full px-5 py-4 rounded-xl border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600 bg-white text-lg"
            required
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="familySalary" className="block mb-3 font-semibold text-white text-lg">
            Family Salary (Optional)
          </label>
          <input
            id="familySalary"
            type="number"
            min="0"
            value={familySalary}
            onChange={(e) => setFamilySalary(e.target.value)}
            placeholder="Enter family salary"
            className="w-full px-5 py-4 rounded-xl border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600 bg-white text-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
        <div>
          <label htmlFor="currency" className="block mb-3 font-semibold text-white text-lg">
            Currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-5 py-4 rounded-xl border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600 bg-white text-lg"
            required
          >
            <option value="USD">USD</option>
            <option value="AED">AED</option>
            <option value="EUR">EUR</option>
            <option value="TRY">TRY</option>
          </select>
        </div>

        <div>
          <label htmlFor="dailySpendTarget" className="block mb-3 font-semibold text-white text-lg">
            Daily Spend Target
          </label>
          <input
            id="dailySpendTarget"
            type="number"
            min="0"
            step="1"
            value={dailySpendTarget}
            onChange={(e) => setDailySpendTarget(e.target.value)}
            className="w-full px-5 py-4 rounded-xl border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600 bg-white text-lg"
          />
          <p className="mt-2 text-sm font-semibold text-white/90">
            Current salary cycle: {salaryCycle.label} · {salaryCycle.days} days
          </p>
        </div>
      </div>

      <section>
        <h3 className="text-3xl font-bold mb-3 text-white tracking-wide text-center">
          Fixed / Recurring Expenses
        </h3>
        <p className="text-center text-white/90 mb-10">
          These stay as planning figures only and are not copied into monthly pages.
        </p>

        {expenses.map((expense, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-6 items-center mb-8 bg-white p-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 relative"
          >
            <input
              type="text"
              placeholder="Expense Name"
              value={expense.name}
              onChange={(e) => handleExpenseChange(i, "name", e.target.value)}
              className="col-span-6 px-4 py-3 rounded-lg border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600"
              aria-label={`Expense name ${i + 1}`}
            />
            <input
              type="number"
              placeholder="Monthly Amount"
              min="0"
              value={expense.actual}
              onChange={(e) => handleExpenseChange(i, "actual", e.target.value)}
              className="col-span-6 px-4 py-3 rounded-lg border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600"
              aria-label={`Monthly amount for expense ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => removeExpenseRow(i)}
              className="absolute top-2 right-2 text-xl text-white bg-red-600 hover:bg-red-700 rounded-full px-3 py-2"
              aria-label={`Remove expense row ${i + 1}`}
              title="Remove expense"
            >
              &times;
            </button>
          </div>
        ))}

        <div className="text-center">
          <button
            type="button"
            onClick={addExpenseRow}
            className="px-14 py-4 font-semibold text-lg bg-gradient-to-r from-yellow-400 to-red-500 text-white rounded-3xl shadow-xl hover:from-yellow-500 hover:to-red-600"
            aria-label="Add a new expense row"
          >
            + Add Expense
          </button>
        </div>
      </section>

      <section className="mt-12 bg-white/95 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h3 className="text-3xl font-extrabold text-indigo-700">Planning Dashboard</h3>
            <p className="text-sm text-gray-500 mt-1">
              Based only on General Features — monthly pages are not included yet.
            </p>
          </div>
          <div className="text-sm font-bold text-gray-600">
            {salaryCycle.label} · {salaryCycle.days} days
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-indigo-50 p-5">
            <div className="text-sm font-bold text-gray-500">Total Income</div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-800">
              {formatMoney(totalIncome, currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-indigo-50 p-5">
            <div className="text-sm font-bold text-gray-500">Fixed Expenses</div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-800">
              {formatMoney(fixedExpenseTotal, currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-indigo-50 p-5">
            <div className="text-sm font-bold text-gray-500">Daily Living Budget</div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-800">
              {formatMoney(livingBudget, currency)}
            </div>
            <div className="mt-1 text-xs font-semibold text-gray-500">
              {formatMoney(dailySpendTarget, currency)} × {salaryCycle.days} days
            </div>
          </div>
          <div className="rounded-2xl bg-indigo-50 p-5">
            <div className="text-sm font-bold text-gray-500">Savings Rate</div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-800">
              {savingsRate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className={`mt-6 rounded-2xl p-6 ${planningShortfall > 0 ? "bg-red-50" : "bg-green-50"}`}>
          <div className="text-sm font-extrabold uppercase tracking-wide text-gray-500">
            {planningShortfall > 0 ? "Planning Shortfall" : "Suggested Savings Transfer"}
          </div>
          <div className={`mt-2 text-4xl font-extrabold ${planningShortfall > 0 ? "text-red-700" : "text-green-700"}`}>
            {formatMoney(planningShortfall > 0 ? planningShortfall : suggestedSavings, currency)}
          </div>
          <p className="mt-2 text-sm font-semibold text-gray-600">
            {planningShortfall > 0
              ? "Your planned fixed expenses plus daily allowance are currently above household income."
              : "Income minus fixed expenses minus the full daily-spend allowance for this salary cycle."}
          </p>
        </div>
      </section>

      <div className="mt-10 text-center bg-white/95 rounded-3xl p-6">
        <Pie data={chartData} options={chartOptions} />
      </div>

      <button
        type="submit"
        className="mt-16 w-full py-5 text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-3xl shadow-2xl hover:from-blue-700 hover:to-indigo-800 transition-all duration-300"
      >
        Save Budget
      </button>
    </form>
  );
}

export default GeneralFeatures;
