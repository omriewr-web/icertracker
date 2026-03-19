/**
 * NYC Rent Guidelines Board (RGB) Orders — 2005 through 2026
 *
 * These are the official annual rent increase percentages for rent-stabilized
 * apartments in New York City. Each order applies to leases commencing on or
 * after October 1 of the order year through September 30 of the following year.
 *
 * Source: https://rentguidelinesboard.cityofnewyork.us/
 *
 * NOTE: The 2026 order (#57) may not be finalized. Verify at nyc.gov/rgb
 * before using in production calculations.
 */

export interface RGBOrder {
  year: number;
  orderNumber: number;
  oneYearIncrease: number;  // percentage, e.g. 2.75
  twoYearIncrease: number;  // percentage, e.g. 5.25
  effectiveDate: string;     // "YYYY-10-01" (always Oct 1)
  notes?: string;
}

export const RGB_ORDERS: RGBOrder[] = [
  { year: 2005, orderNumber: 36, oneYearIncrease: 2.25, twoYearIncrease: 4.25, effectiveDate: "2005-10-01" },
  { year: 2006, orderNumber: 37, oneYearIncrease: 3.25, twoYearIncrease: 5.75, effectiveDate: "2006-10-01" },
  { year: 2007, orderNumber: 38, oneYearIncrease: 3.00, twoYearIncrease: 5.75, effectiveDate: "2007-10-01" },
  { year: 2008, orderNumber: 39, oneYearIncrease: 4.50, twoYearIncrease: 8.50, effectiveDate: "2008-10-01" },
  { year: 2009, orderNumber: 40, oneYearIncrease: 3.00, twoYearIncrease: 6.00, effectiveDate: "2009-10-01" },
  { year: 2010, orderNumber: 41, oneYearIncrease: 0.00, twoYearIncrease: 0.00, effectiveDate: "2010-10-01", notes: "Zero increase — financial crisis" },
  { year: 2011, orderNumber: 42, oneYearIncrease: 3.75, twoYearIncrease: 7.25, effectiveDate: "2011-10-01" },
  { year: 2012, orderNumber: 43, oneYearIncrease: 2.00, twoYearIncrease: 4.00, effectiveDate: "2012-10-01" },
  { year: 2013, orderNumber: 44, oneYearIncrease: 4.00, twoYearIncrease: 7.75, effectiveDate: "2013-10-01" },
  { year: 2014, orderNumber: 45, oneYearIncrease: 1.00, twoYearIncrease: 2.75, effectiveDate: "2014-10-01" },
  { year: 2015, orderNumber: 46, oneYearIncrease: 0.00, twoYearIncrease: 0.00, effectiveDate: "2015-10-01", notes: "Zero increase" },
  { year: 2016, orderNumber: 47, oneYearIncrease: 0.00, twoYearIncrease: 0.00, effectiveDate: "2016-10-01", notes: "Zero increase" },
  { year: 2017, orderNumber: 48, oneYearIncrease: 1.25, twoYearIncrease: 2.00, effectiveDate: "2017-10-01" },
  { year: 2018, orderNumber: 49, oneYearIncrease: 1.50, twoYearIncrease: 2.50, effectiveDate: "2018-10-01" },
  { year: 2019, orderNumber: 50, oneYearIncrease: 1.50, twoYearIncrease: 2.50, effectiveDate: "2019-10-01" },
  { year: 2020, orderNumber: 51, oneYearIncrease: 1.50, twoYearIncrease: 2.50, effectiveDate: "2020-10-01" },
  { year: 2021, orderNumber: 52, oneYearIncrease: 0.00, twoYearIncrease: 0.00, effectiveDate: "2021-10-01", notes: "Zero increase — COVID" },
  { year: 2022, orderNumber: 53, oneYearIncrease: 3.25, twoYearIncrease: 5.00, effectiveDate: "2022-10-01" },
  { year: 2023, orderNumber: 54, oneYearIncrease: 3.00, twoYearIncrease: 5.00, effectiveDate: "2023-10-01" },
  { year: 2024, orderNumber: 55, oneYearIncrease: 2.75, twoYearIncrease: 5.25, effectiveDate: "2024-10-01" },
  { year: 2025, orderNumber: 56, oneYearIncrease: 2.50, twoYearIncrease: 4.75, effectiveDate: "2025-10-01" },
  { year: 2026, orderNumber: 57, oneYearIncrease: 2.75, twoYearIncrease: 5.25, effectiveDate: "2026-10-01", notes: "Verify at nyc.gov/rgb — may not be finalized" },
];

/** The most recent RGB order in the dataset. */
export const CURRENT_RGB_ORDER = RGB_ORDERS[RGB_ORDERS.length - 1];

/** Look up an RGB order by the year it applies to. */
export function getRGBOrderByYear(year: number): RGBOrder | undefined {
  return RGB_ORDERS.find((o) => o.year === year);
}

/** Look up an RGB order by its order number (e.g. 57). */
export function getRGBOrderByNumber(orderNumber: number): RGBOrder | undefined {
  return RGB_ORDERS.find((o) => o.orderNumber === orderNumber);
}

/**
 * Calculate the new legal rent after applying the RGB increase for a given year.
 *
 * @param currentRent - The current legal rent
 * @param year - The RGB order year to apply
 * @param leaseType - "1year" or "2year" lease renewal
 * @returns The new legal rent after the increase, rounded to 2 decimals
 */
export function calculateLegalRentIncrease(
  currentRent: number,
  year: number,
  leaseType: "1year" | "2year"
): number {
  const order = getRGBOrderByYear(year);
  if (!order) throw new Error(`No RGB order found for year ${year}`);
  const pct =
    leaseType === "1year" ? order.oneYearIncrease : order.twoYearIncrease;
  return parseFloat((currentRent * (1 + pct / 100)).toFixed(2));
}

/**
 * Get the applicable RGB order for a lease commencing on a given date.
 * RGB orders apply Oct 1 – Sep 30.
 */
export function getRGBOrderForLeaseDate(leaseStartDate: Date): RGBOrder | undefined {
  const month = leaseStartDate.getMonth(); // 0-indexed
  const year = leaseStartDate.getFullYear();
  // Oct-Dec: use that calendar year's order; Jan-Sep: use prior year's order
  const rgbYear = month >= 9 ? year : year - 1;
  return getRGBOrderByYear(rgbYear);
}
