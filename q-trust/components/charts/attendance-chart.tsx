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
  Legend,
  LineChart,
  Line,
} from "recharts"
import { useTranslations } from "next-intl"

const COLORS = {
  primary: "hsl(156, 71%, 25%)",
  gold: "hsl(42, 87%, 69%)",
  blue: "hsl(209, 52%, 29%)",
  red: "hsl(0, 84%, 60%)",
  amber: "hsl(42, 87%, 50%)",
}

interface AttendanceByDayData {
  day: string
  present: number
  absent: number
  late: number
  [key: string]: string | number
}

interface AttendanceDistributionData {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface TrendData {
  date: string
  rate: number
  [key: string]: string | number
}

export function AttendanceByDayChart({ data }: { data: AttendanceByDayData[] }) {
  const tc = useTranslations("common")
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Legend />
        <Bar dataKey="present" name={tc("present")} fill={COLORS.primary} radius={[4, 4, 0, 0]} />
        <Bar dataKey="late" name={tc("late")} fill={COLORS.amber} radius={[4, 4, 0, 0]} />
        <Bar dataKey="absent" name={tc("absent")} fill={COLORS.red} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AttendanceDistributionChart({ data }: { data: AttendanceDistributionData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function AttendanceTrendChart({ data }: { data: TrendData[] }) {
  const tc = useTranslations("common")
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
          formatter={(value) => [`${value}%`, tc("attendanceRate")]}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={{ fill: COLORS.primary, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: COLORS.gold }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SessionAttendanceChart({
  data
}: {
  data: Array<{ name: string; rate: number }>
}) {
  const tc = useTranslations("common")
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} fontSize={12} />
        <YAxis type="category" dataKey="name" fontSize={12} width={70} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
          formatter={(value) => [`${value}%`, tc("attendanceRate")]}
        />
        <Bar dataKey="rate" fill={COLORS.primary} radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.rate >= 80 ? COLORS.primary : entry.rate >= 60 ? COLORS.amber : COLORS.red} 
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

