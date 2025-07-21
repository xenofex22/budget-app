import { useState, useEffect } from "react";
import { Pie } from "react-chartjs-2";  // Import Pie chart component from Chart.js
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

function GeneralFeatures({ onSubmit, savedData }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(savedData?.year || currentYear);
  const [salary, setSalary] = useState(savedData?.salary || "");   // Primary salary
  const [familySalary, setFamilySalary] = useState(savedData?.familySalary || ""); // Family salary (optional)
  const [currency, setCurrency] = useState(savedData?.currency || "AED");  // Default currency is AED
  const [expenses, setExpenses] = useState(savedData?.expenses || Array(3).fill({ name: "", actual: "" }));  // Default 3 rows

  useEffect(() => {
    if (savedData) {
      setYear(savedData.year);
      setSalary(savedData.salary);
      setFamilySalary(savedData.familySalary);
      setCurrency(savedData.currency);
      setExpenses(savedData.expenses);
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
    // Calculate total salary by adding primary salary and family salary
    const totalSalary = Number(salary) + Number(familySalary);

    onSubmit({
      year,
      salary: totalSalary, // Use combined salary value
      familySalary: Number(familySalary),
      currency,
      expenses: expenses.filter((e) => e.name.trim() !== ""),
    });
  }

  function addExpenseRow() {
    setExpenses([...expenses, { name: "", actual: "" }]);
  }

  function removeExpenseRow(index) {
    setExpenses(expenses.filter((_, i) => i !== index));
  }

  // Pie chart data preparation
  const chartData = {
    labels: expenses.map((expense) => expense.name || "Unnamed"), // Expense names as categories
    datasets: [
      {
        label: 'Expenses by Category',
        data: expenses.map((expense) => expense.actual || 0), // Actual expenses as values
        backgroundColor: [
          '#4CAF50', // Green
          '#2196F3', // Blue
          '#FF5722', // Red
          '#FFC107', // Amber
          '#9C27B0', // Purple
          '#FF9800', // Orange
          '#8BC34A', // Light Green
          '#03A9F4', // Light Blue
        ], // Neutral colors for the segments
        borderColor: [
          '#4CAF50', // Green (Border)
          '#2196F3', // Blue (Border)
          '#FF5722', // Red (Border)
          '#FFC107', // Amber (Border)
          '#9C27B0', // Purple (Border)
          '#FF9800', // Orange (Border)
          '#8BC34A', // Light Green (Border)
          '#03A9F4', // Light Blue (Border)
        ], // Border colors for the segments
        borderWidth: 1,
      },
    ],
  };

  // Pie chart options for custom legend styling
  const chartOptions = {
    plugins: {
      legend: {
        labels: {
          font: {
            weight: 'bold',  // Make the legend text bold
            size: 16,        // Set the font size to 16
          },
          color: '#333',     // Set legend text color to dark (almost black)
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
        General Features
      </h2>

      {/* Year, Salary, and Currency Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-14">
        <div>
          <label htmlFor="year" className="block mb-3 font-semibold text-white text-lg">
            Year
          </label>
          <input
            id="year"
            type="number"
            min="2000"
            max={currentYear + 5}
            value={year}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || (val >= 2000 && val <= currentYear + 5)) {
                setYear(Number(val));
              }
            }}
            className="w-full px-5 py-4 rounded-xl border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600 bg-white text-lg"
            required
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="salary" className="block mb-3 font-semibold text-white text-lg">
            Primary Salary
          </label>
          <input
            id="salary"
            type="number"
            min="0"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="Enter your salary"
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

      {/* Currency Selection */}
      <div className="mb-12">
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

      {/* Expenses Section */}
      <section>
        <h3 className="text-3xl font-bold mb-10 text-white tracking-wide text-center">
          Expenses
        </h3>

        {expenses.map((expense, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-6 items-center mb-8 bg-white p-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300"
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
              placeholder="Actual Amount"
              min="0"
              value={expense.actual}
              onChange={(e) =>
                handleExpenseChange(i, "actual", e.target.value)
              }
              className="col-span-6 px-4 py-3 rounded-lg border-2 border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-600"
              aria-label={`Actual amount for expense ${i + 1}`}
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

      {/* Display Pie Chart */}
      <div className="mt-10 text-center">
        <Pie data={chartData} options={chartOptions} />
      </div>

      {/* Submit Button */}
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
