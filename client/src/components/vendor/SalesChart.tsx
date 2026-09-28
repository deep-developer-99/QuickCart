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
  VendorSalesMetric,
  VendorSalesPoint,
} from "../../types/vendorDashboard";
import "./SalesChart.css";

interface SalesChartProps {
  data: Array<Pick<VendorSalesPoint, "date"> & { value: number }>;
  metric: VendorSalesMetric;
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
  metric,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  metric: VendorSalesMetric;
}) => {
  if (!active || !payload?.length) return null;

  const value = Number(payload[0]?.value ?? 0);
  const formattedValue =
    metric === "sales" ? formatCurrency(value) : value.toLocaleString("en-IN");

  const labelText =
    metric === "sales"
      ? "Sales"
      : metric === "itemsSold"
        ? "Items Sold"
        : "Orders";

  return (
    <div className="vendor-sales-tooltip">
      <p>{label ? formatDate(label) : ""}</p>
      <strong>
        {formattedValue} {labelText}
      </strong>
    </div>
  );
};

const SalesChart = ({ data, metric, isLoading = false }: SalesChartProps) => {
  const xAxisTicks = (() => {
    if (data.length <= 7) return data.map((item) => item.date);

    const maxLabels = 7;
    const step = Math.ceil((data.length - 1) / (maxLabels - 1));
    const indexes = new Set<number>();

    for (let index = 0; index < data.length; index += step) {
      indexes.add(index);
    }

    indexes.add(data.length - 1);

    return [...indexes].sort((a, b) => a - b).map((index) => data[index].date);
  })();

  const metricLabel =
    metric === "sales"
      ? "Sales"
      : metric === "itemsSold"
        ? "Items Sold"
        : "Orders";

  return (
    <div className="vendor-sales-chart-card">
      {isLoading ? (
        <div className="vendor-sales-chart-state">Loading performance...</div>
      ) : data.length === 0 ? (
        <div className="vendor-sales-chart-state">
          No {metricLabel.toLowerCase()} data available for this period.
        </div>
      ) : (
        <div className="vendor-sales-chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 15, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
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
                minTickGap={20}
              />

              <YAxis
                tickFormatter={(value: number) =>
                  metric === "sales"
                    ? `₹${Number(value).toLocaleString("en-IN")}`
                    : Number(value).toLocaleString("en-IN")
                }
                tickLine={false}
                axisLine={false}
                width={metric === "sales" ? 75 : 55}
                className="vendor-chart-y-axis"
                allowDecimals={false}
              />

              <Tooltip
                content={<SalesTooltip metric={metric} />}
                cursor={{ stroke: "#dce8dd", strokeWidth: 1 }}
              />

              <Line
                type="monotone"
                dataKey="value"
                stroke="#5fa653"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
                isAnimationActive
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default SalesChart;
