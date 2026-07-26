import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  /** null se renderiza como "sin dato", nunca como 0. */
  value: number | null;
  unit?: string;
  /** Decimales a mostrar cuando el valor es numérico. */
  precision?: number;
  tone?: "neutral" | "warning" | "danger" | "success";
  hint?: string;
}

const TONE_CLASS: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
  success: "text-emerald-600 dark:text-emerald-400",
};

/**
 * Distingue explícitamente "no hay dato" de "el valor es cero". En un panel
 * industrial confundirlos lleva a decisiones erróneas: un cero en tasa de
 * error se lee como "todo bien", cuando puede significar "no estoy midiendo".
 */
export const KpiCard = memo(function KpiCard({
  label,
  value,
  unit,
  precision = 0,
  tone = "neutral",
  hint,
}: KpiCardProps) {
  const hasValue = value !== null && Number.isFinite(value);
  const display = hasValue ? value.toFixed(precision) : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums", hasValue && TONE_CLASS[tone])}>
          {display}
          {hasValue && unit && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasValue ? hint : "Sin dato disponible"}
        </p>
      </CardContent>
    </Card>
  );
});
