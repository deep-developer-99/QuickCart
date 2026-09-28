import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  VendorSalesPeriod,
  VendorSalesPoint,
} from "../../types/vendorDashboard";
import "./SalesChart.css";

interface SalesChartProps {
  data: VendorSalesPoint[];
  period: VendorSalesPeriod;
  onPeriodChange: (period: VendorSalesPeriod) => void;
  isLoading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
};

const SalesTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="vendor-sales-tooltip">
      <p>{label ? formatDate(label) : ""}</p>
      <strong>{formatCurrency(Number(payload[0]?.value ?? 0))}</strong>
    </div>
  );
};

const SalesChart = ({
  data,
  period,
  onPeriodChange,
  isLoading = false,
}: SalesChartProps) => {
  // Keep every data point in the line, but show fewer x-axis labels for
  // the 30-day view so the dates never overlap.
  const xAxisTicks = (() => {
    if (period !== "30d" || data.length <= 7) {
      return data.map((item) => item.date);
    }

    const maxLabels = 7;
    const step = Math.ceil((data.length - 1) / (maxLabels - 1));
    const indexes = new Set<number>();

    for (let index = 0; index < data.length; index += step) {
      indexes.add(index);
    }

    // Always keep the last date visible.
    indexes.add(data.length - 1);

    return [...indexes].sort((a, b) => a - b).map((index) => data[index].date);
  })();

  return (
    <section className="vendor-sales-chart-card">
      <div className="vendor-sales-chart-header">
        <div>
          <h2>Sales Overview</h2>
          <p>Track your vendor sales over time.</p>
        </div>

        <select
          value={period}
          onChange={(event) =>
            onPeriodChange(event.target.value as VendorSalesPeriod)
          }
          aria-label="Sales chart period"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {isLoading ? (
        <div className="vendor-sales-chart-state">Loading sales...</div>
      ) : data.length === 0 ? (
        <div className="vendor-sales-chart-state">
          No sales data available for this period.
        </div>
      ) : (
        <div className="vendor-sales-chart-wrapper">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
              margin={{ top: 12, right: 18, left: 12, bottom: 12 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="vendor-chart-grid"
              />

              <XAxis
                dataKey="date"
                ticks={xAxisTicks}
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                className="vendor-chart-x-axis"
                minTickGap={16}
              />

              <YAxis
                tickFormatter={(value: number) =>
                  `₹${Number(value).toLocaleString("en-IN")}`
                }
                tickLine={false}
                axisLine={false}
                width={72}
                className="vendor-chart-y-axis"
                allowDecimals={false}
              />

              <Tooltip
                content={<SalesTooltip />}
                cursor={{ stroke: "#dce8dd", strokeWidth: 1 }}
              />

              <Line
                type="monotone"
                dataKey="sales"
                stroke="#4d9f50"
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: "#ffffff",
                  stroke: "#4d9f50",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: "#4d9f50",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export default SalesChart;
