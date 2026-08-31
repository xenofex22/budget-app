export const budgetMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getBudgetPeriod(date = new Date()) {
  const period = new Date(date);
  let year = period.getFullYear();
  let monthIndex = period.getMonth();

  // Salary is normally received around the 27th, so from the 27th onward
  // Smart Budget treats the next calendar month as the active budget period.
  // Use month-index arithmetic instead of Date#setMonth so dates such as
  // 31 August do not overflow through September into October.
  if (period.getDate() >= 27) {
    monthIndex += 1;
    if (monthIndex === 12) {
      monthIndex = 0;
      year += 1;
    }
  }

  return {
    year,
    monthIndex,
    month: budgetMonths[monthIndex],
  };
}
