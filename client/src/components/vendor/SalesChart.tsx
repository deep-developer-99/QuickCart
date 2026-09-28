import { useMemo } from "react";
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

const CHART_WIDTH = 760;
const CHART_HEIGHT = 300;
const PADDING = { top: 24, right: 24, bottom: 48, left: 58 };

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

const SalesChart = ({
  data,
  period,
  onPeriodChange,
  isLoading = false,
}: SalesChartProps) => {
  const chart = useMemo(() => {
    const maxSales = Math.max(...data.map((item) => item.sales), 0);
    const yMax = maxSales === 0 ? 1000 : Math.ceil(maxSales / 500) * 500;
    const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const points = data.map((item, index) => {
      const x =
        PADDING.left +
        (data.length <= 1
          ? innerWidth / 2
          : (index / (data.length - 1)) * innerWidth);
      const y = PADDING.top + innerHeight - (item.sales / yMax) * innerHeight;

      return { ...item, x, y };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x} ${PADDING.top + innerHeight} L ${points[0].x} ${PADDING.top + innerHeight} Z`
      : "";

    return { yMax, innerHeight, points, linePath, areaPath };
  }, [data]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: Math.round(chart.yMax * ratio),
    y: PADDING.top + chart.innerHeight - chart.innerHeight * ratio,
  }));

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
          <svg
            className="vendor-sales-chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Vendor sales overview chart"
          >
            <defs>
              <linearGradient id="vendorSalesArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4d9f50" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#4d9f50" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={tick.y}
                  y2={tick.y}
                  className="vendor-chart-grid-line"
                />
                <text
                  x={PADDING.left - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="vendor-chart-axis-label"
                >
                  ₹{tick.value.toLocaleString("en-IN")}
                </text>
              </g>
            ))}

            <path d={chart.areaPath} className="vendor-chart-area" />
            <path d={chart.linePath} className="vendor-chart-line" />

            {chart.points.map((point, index) => {
              // Show every date for the 7-day view, but limit visible x-axis
              // labels for longer ranges so the dates do not overlap.
              const labelStep =
                data.length > 14 ? Math.ceil((data.length - 1) / 6) : 1;
              const showDateLabel =
                data.length <= 14 ||
                index === 0 ||
                index === data.length - 1 ||
                index % labelStep === 0;

              return (
                <g key={point.date} className="vendor-chart-point-group">
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    className="vendor-chart-point"
                  />

                  <title>
                    {formatDate(point.date)}: {formatCurrency(point.sales)}
                  </title>

                  {showDateLabel && (
                    <text
                      x={point.x}
                      y={CHART_HEIGHT - 18}
                      textAnchor="middle"
                      className="vendor-chart-date-label"
                    >
                      {formatDate(point.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
};

export default SalesChart;
