type Row = Readonly<Record<string, string>>;

interface BeforeAfterProps {
  headers: readonly string[];
  before: readonly Row[];
  after: readonly Row[];
  /** headers for the after table when different from before */
  afterHeaders?: readonly string[];
  /** indices into `before` to strike-through (0-based) */
  struck?: readonly number[];
  /** indices into `after` to highlight as new/changed (0-based) */
  highlight?: readonly number[];
  captionBefore: string;
  captionAfter: string;
}

export function BeforeAfter({
  headers,
  before,
  after,
  afterHeaders,
  struck = [],
  highlight = [],
  captionBefore,
  captionAfter,
}: BeforeAfterProps) {
  const aHeaders = afterHeaders ?? headers;
  const headersMatch =
    aHeaders.length === headers.length &&
    aHeaders.every((h, i) => h === headers[i]);
  return (
    <div className="clean-before-after">
      <div className="clean-ba-col">
        <span className="clean-ba-label">Before</span>
        <table className="clean-ba-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {before.map((row, i) => (
              <tr
                key={i}
                className={struck.includes(i) ? "clean-ba-strike" : ""}
              >
                {headers.map((h) => (
                  <td key={h}>{row[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <span className="clean-ba-caption">{captionBefore}</span>
      </div>
      <span className="clean-ba-arrow">→</span>
      <div className="clean-ba-col">
        <span className="clean-ba-label">After</span>
        <table className="clean-ba-table">
          <thead>
            <tr>
              {aHeaders.map((h) => {
                const isNew = !headersMatch && !headers.includes(h);
                return (
                  <th key={h} className={isNew ? "clean-ba-cell-new" : ""}>
                    {h}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {after.map((row, i) => {
              const beforeRow = before[i];
              return (
                <tr
                  key={i}
                  className={highlight.includes(i) ? "clean-ba-highlight" : ""}
                >
                  {aHeaders.map((h) => {
                    const changed =
                      headersMatch && beforeRow
                        ? row[h] !== beforeRow[h]
                        : !headersMatch && !headers.includes(h);
                    return (
                      <td
                        key={h}
                        className={changed ? "clean-ba-cell-changed" : ""}
                      >
                        {row[h]}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <span className="clean-ba-caption">{captionAfter}</span>
      </div>
    </div>
  );
}

/* ---------- example data for each step ---------- */

export const EXAMPLES = {
  sampling: {
    headers: ["id", "name", "score"],
    before: [
      { id: "1", name: "Alice", score: "88" },
      { id: "2", name: "Bob", score: "72" },
      { id: "3", name: "Carol", score: "95" },
      { id: "4", name: "Dan", score: "61" },
      { id: "5", name: "Eve", score: "84" },
    ],
    after: [
      { id: "1", name: "Alice", score: "88" },
      { id: "2", name: "Bob", score: "72" },
      { id: "3", name: "Carol", score: "95" },
    ],
    struck: [3, 4],
    captionBefore: "5 rows",
    captionAfter: "3 rows · head(3)",
  },

  sort: {
    headers: ["name", "age"],
    before: [
      { name: "Carol", age: "44" },
      { name: "Alice", age: "29" },
      { name: "Bob", age: "31" },
    ],
    after: [
      { name: "Alice", age: "29" },
      { name: "Bob", age: "31" },
      { name: "Carol", age: "44" },
    ],
    captionBefore: "unsorted",
    captionAfter: "sorted by name asc",
  },

  missing: {
    headers: ["id", "age", "city"],
    before: [
      { id: "1", age: "29", city: "NYC" },
      { id: "2", age: "—", city: "LA" },
      { id: "3", age: "44", city: "—" },
      { id: "4", age: "31", city: "NYC" },
    ],
    after: [
      { id: "1", age: "29", city: "NYC" },
      { id: "2", age: "35", city: "LA" },
      { id: "3", age: "44", city: "other" },
      { id: "4", age: "31", city: "NYC" },
    ],
    highlight: [1, 2],
    captionBefore: "2 missing values",
    captionAfter: 'age → mean (35), city → constant "other"',
  },

  outliers: {
    headers: ["id", "salary"],
    before: [
      { id: "1", salary: "52k" },
      { id: "2", salary: "48k" },
      { id: "3", salary: "950k" },
      { id: "4", salary: "55k" },
    ],
    after: [
      { id: "1", salary: "52k" },
      { id: "2", salary: "48k" },
      { id: "3", salary: "55k" },
      { id: "4", salary: "55k" },
    ],
    struck: [2],
    highlight: [2],
    captionBefore: "950k is an outlier (IQR)",
    captionAfter: "winsorized → clipped to 55k",
  },

  duplicates: {
    headers: ["name", "email"],
    before: [
      { name: "Alice", email: "a@x.co" },
      { name: "Bob", email: "b@x.co" },
      { name: "Alice", email: "a@x.co" },
      { name: "Carol", email: "c@x.co" },
    ],
    after: [
      { name: "Alice", email: "a@x.co" },
      { name: "Bob", email: "b@x.co" },
      { name: "Carol", email: "c@x.co" },
    ],
    struck: [2],
    captionBefore: "4 rows · 1 duplicate",
    captionAfter: "3 rows · duplicate removed",
  },

  stringReplace: {
    headers: ["city"],
    before: [
      { city: "New York" },
      { city: "new york" },
      { city: "N.Y.C." },
      { city: "LA" },
    ],
    after: [{ city: "NYC" }, { city: "NYC" }, { city: "NYC" }, { city: "LA" }],
    highlight: [0, 1, 2],
    captionBefore: "inconsistent city names",
    captionAfter: 'replaced → "NYC"',
  },

  standardize: {
    headers: ["gender"],
    before: [
      { gender: "Male" },
      { gender: "male" },
      { gender: "M" },
      { gender: "Female" },
      { gender: "F" },
    ],
    after: [
      { gender: "Male" },
      { gender: "Male" },
      { gender: "Male" },
      { gender: "Female" },
      { gender: "Female" },
    ],
    highlight: [1, 2, 4],
    captionBefore: "5 labels for 2 categories",
    captionAfter: "standardized to Male / Female",
  },

  typeConversion: {
    headers: ["price", "active", "date"],
    before: [
      { price: '"42.5"', active: '"yes"', date: '"2024-01-15"' },
      { price: '"19"', active: '"no"', date: '"2024-03-22"' },
    ],
    after: [
      { price: "42.5", active: "true", date: "2024-01-15" },
      { price: "19", active: "false", date: "2024-03-22" },
    ],
    highlight: [0, 1],
    captionBefore: "all string values",
    captionAfter: "number, boolean, date types",
  },

  textCleanup: {
    headers: ["name", "note"],
    before: [
      { name: "  Alice  ", note: "Good!!!" },
      { name: "bOB", note: "ok  " },
      { name: "  carol", note: "N/A" },
    ],
    after: [
      { name: "Alice", note: "Good" },
      { name: "Bob", note: "ok" },
      { name: "Carol", note: "N/A" },
    ],
    highlight: [0, 1, 2],
    captionBefore: "extra spaces, mixed case",
    captionAfter: "trimmed + title case",
  },

  columns: {
    headers: ["PassengerId", "Surv.", "Age"],
    before: [
      { PassengerId: "1", "Surv.": "0", Age: "22" },
      { PassengerId: "2", "Surv.": "1", Age: "38" },
    ],
    after: [
      { survived: "0", age: "22" },
      { survived: "1", age: "38" },
    ],
    afterHeaders: ["survived", "age"],
    captionBefore: "3 columns · id column present",
    captionAfter: "dropped PassengerId, renamed, lowered",
  },

  encoding: {
    headers: ["color"],
    before: [
      { color: "red" },
      { color: "blue" },
      { color: "green" },
      { color: "red" },
    ],
    after: [
      { red: "1", blue: "0", green: "0" },
      { red: "0", blue: "1", green: "0" },
      { red: "0", blue: "0", green: "1" },
      { red: "1", blue: "0", green: "0" },
    ],
    afterHeaders: ["red", "blue", "green"],
    captionBefore: "1 categorical column",
    captionAfter: "one-hot encoded → 3 binary columns",
  },

  mathTransform: {
    headers: ["income"],
    before: [
      { income: "25000" },
      { income: "52000" },
      { income: "180000" },
      { income: "43000" },
    ],
    after: [
      { income: "25000", income_log: "10.13" },
      { income: "52000", income_log: "10.86" },
      { income: "180000", income_log: "12.10" },
      { income: "43000", income_log: "10.67" },
    ],
    afterHeaders: ["income", "income_log"],
    captionBefore: "right-skewed distribution",
    captionAfter: "ln transform reduces skew",
  },

  bin: {
    headers: ["age"],
    before: [
      { age: "22" },
      { age: "35" },
      { age: "47" },
      { age: "19" },
      { age: "61" },
    ],
    after: [
      { age: "22", age_bin: "18-30" },
      { age: "35", age_bin: "31-45" },
      { age: "47", age_bin: "46-60" },
      { age: "19", age_bin: "18-30" },
      { age: "61", age_bin: "61+" },
    ],
    afterHeaders: ["age", "age_bin"],
    captionBefore: "continuous values",
    captionAfter: "binned into 4 groups",
  },

  dateExtract: {
    headers: ["date"],
    before: [
      { date: "2024-01-15" },
      { date: "2024-06-22" },
      { date: "2024-12-03" },
    ],
    after: [
      { date: "2024-01-15", year: "2024", month: "1", dow: "Mon" },
      { date: "2024-06-22", year: "2024", month: "6", dow: "Sat" },
      { date: "2024-12-03", year: "2024", month: "12", dow: "Tue" },
    ],
    afterHeaders: ["date", "year", "month", "dow"],
    captionBefore: "1 date column",
    captionAfter: "extracted year, month, day-of-week",
  },

  derived: {
    headers: ["price", "qty"],
    before: [
      { price: "10", qty: "3" },
      { price: "25", qty: "1" },
      { price: "8", qty: "5" },
    ],
    after: [
      { price: "10", qty: "3", total: "30" },
      { price: "25", qty: "1", total: "25" },
      { price: "8", qty: "5", total: "40" },
    ],
    afterHeaders: ["price", "qty", "total"],
    captionBefore: "2 columns",
    captionAfter: "total = price × qty",
  },

  lagLead: {
    headers: ["day", "sales"],
    before: [
      { day: "Mon", sales: "120" },
      { day: "Tue", sales: "95" },
      { day: "Wed", sales: "140" },
      { day: "Thu", sales: "110" },
    ],
    after: [
      { day: "Mon", sales: "120", sales_lag1: "—" },
      { day: "Tue", sales: "95", sales_lag1: "120" },
      { day: "Wed", sales: "140", sales_lag1: "95" },
      { day: "Thu", sales: "110", sales_lag1: "140" },
    ],
    afterHeaders: ["day", "sales", "sales_lag1"],
    captionBefore: "time series",
    captionAfter: "lag(1) = previous day's sales",
  },

  interaction: {
    headers: ["x1", "x2"],
    before: [
      { x1: "2", x2: "5" },
      { x1: "3", x2: "4" },
      { x1: "1", x2: "8" },
    ],
    after: [
      { x1: "2", x2: "5", "x1×x2": "10" },
      { x1: "3", x2: "4", "x1×x2": "12" },
      { x1: "1", x2: "8", "x1×x2": "8" },
    ],
    afterHeaders: ["x1", "x2", "x1×x2"],
    captionBefore: "2 numeric predictors",
    captionAfter: "interaction term for regression",
  },
} as const;
