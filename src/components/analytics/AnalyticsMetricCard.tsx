import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsMetricCardProps = {
  label: string;
  value: string;
  description?: string;
};

const AnalyticsMetricCard = ({ label, value, description }: AnalyticsMetricCardProps) => {
  return (
    <Card className="border-border">
      <CardHeader className="space-y-1 pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      {description ? (
        <CardContent className="pt-0 text-sm text-muted-foreground">{description}</CardContent>
      ) : null}
    </Card>
  );
};

export default AnalyticsMetricCard;
