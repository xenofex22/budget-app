export const budgetMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getBudgetPeriod(date = new Date()) {
  const period = new Date(date);

  // Salary is normally received around the 27th, so from the 27th onward
  // Smart Budget treats the next calendar month as the active budget period.
  if (period.getDate() >= 27) {
    period.setMonth(period.getMonth() + 1);
  }

  return {
    year: period.getFullYear(),
    monthIndex: period.getMonth(),
    month: budgetMonths[period.getMonth()],
  };
}
