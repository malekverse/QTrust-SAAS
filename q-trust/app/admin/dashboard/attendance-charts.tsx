"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"

interface TrendData {
  date: string
  rate: number
  present: number
  late: number
  absent: number
  [key: string]: string | number
}

interface DistributionData {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface AttendanceChartsProps {
  type: "trend" | "distribution"
  data: TrendData[] | DistributionData[]
}

export function AttendanceCharts({ type, data }: AttendanceChartsProps) {
  if (type === "trend") {
    const trendData = data as TrendData[]
    
    if (trendData.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          لا توجد بيانات متاحة
        </div>
      )
    }
    
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            fontSize={12} 
            tickFormatter={(value) => {
              const date = new Date(value)
              return `${date.getDate()}/${date.getMonth() + 1}`
            }}
          />
          <YAxis 
            fontSize={12} 
            domain={[0, 100]} 
            tickFormatter={(value) => `${value}%`} 
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              direction: "rtl",
            }}
            formatter={(value) => [`${value}%`, "نسبة الحضور"]}
            labelFormatter={(label) => {
              const date = new Date(label)
              return date.toLocaleDateString("ar-TN", { 
                weekday: "long", 
                day: "numeric", 
                month: "short" 
              })
            }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="hsl(156, 71%, 25%)"
            strokeWidth={3}
            dot={{ fill: "hsl(156, 71%, 25%)", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: "hsl(42, 87%, 69%)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === "distribution") {
    const distributionData = data as DistributionData[]
    
    if (distributionData.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          لا توجد بيانات متاحة
        </div>
      )
    }
    
    const total = distributionData.reduce((sum, d) => sum + d.value, 0)
    
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={distributionData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
          >
            {distributionData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              direction: "rtl",
            }}
            formatter={(value, name) => [
              `${Number(value)} (${Math.round((Number(value) / total) * 100)}%)`,
              name
            ]}
          />
          <Legend 
            layout="vertical" 
            align="left" 
            verticalAlign="middle"
            formatter={(value) => <span className="text-sm">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return null
}

