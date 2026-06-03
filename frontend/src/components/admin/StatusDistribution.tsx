import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface StatusDistributionProps {
  present: number;
  late: number;
  exempted: number;
  absent: number;
}

const STATUS_COLORS = {
  Present: "#608B50",
  Late: "#facc15",
  Exempted: "#64748b",
  Absent: "#ef4444",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    const total = payload[0].payload.total;
    return (
      <div
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{
              backgroundColor:
                STATUS_COLORS[name as keyof typeof STATUS_COLORS],
            }}
          />
          <span className="font-semibold">{name}</span>
        </div>
        <p className="text-muted-foreground mt-0.5">
          {value} records ({total > 0 ? Math.round((value / total) * 100) : 0}%)
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Largest-remainder method — ensures percentages always sum to exactly 100.
 * Standard approach used in charts/dashboards to avoid the 63%+38%=101% problem.
 */
function toExactPercentages(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return values.map(() => 0);

  const floats = values.map((v) => (v / total) * 100);
  const floors = floats.map(Math.floor);
  const remainders = floats.map((f, i) => f - floors[i]);

  // How many 1s to distribute to reach 100
  let toDistribute = 100 - floors.reduce((a, b) => a + b, 0);

  // Give the 1s to the indices with the largest remainders
  const indices = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r);

  for (let k = 0; k < toDistribute; k++) {
    floors[indices[k].i] += 1;
  }

  return floors;
}

const StatusDistribution = ({
  present,
  late,
  exempted,
  absent,
}: StatusDistributionProps) => {
  const total = present + late + exempted + absent;

  const raw = [present, late, exempted, absent];
  const pcts = toExactPercentages(raw);

  const data = [
    {
      name: "Present",
      value: present,
      pct: pcts[0],
      total,
      color: STATUS_COLORS.Present,
    },
    {
      name: "Late",
      value: late,
      pct: pcts[1],
      total,
      color: STATUS_COLORS.Late,
    },
    {
      name: "Exempted",
      value: exempted,
      pct: pcts[2],
      total,
      color: STATUS_COLORS.Exempted,
    },
    {
      name: "Absent",
      value: absent,
      pct: pcts[3],
      total,
      color: STATUS_COLORS.Absent,
    },
  ].filter((d) => d.value > 0);

  const allEntries = [
    { name: "Present", pct: pcts[0], color: STATUS_COLORS.Present },
    { name: "Late", pct: pcts[1], color: STATUS_COLORS.Late },
    { name: "Exempted", pct: pcts[2], color: STATUS_COLORS.Exempted },
    { name: "Absent", pct: pcts[3], color: STATUS_COLORS.Absent },
  ];

  return (
    <Card className="shadow-card border-border/50 animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base">
          Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No attendance data
            </div>
          )}
        </div>

        {/* Legend — percentages always sum to 100 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
          {allEntries.map(({ name, pct, color }) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground truncate">{name}</span>
              <span className="font-semibold ml-auto">{pct}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusDistribution;
