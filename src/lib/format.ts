export const formatDate = (dateString?: string) => {
  if (!dateString) {
    return "";
  }
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const formatDiscount = (type?: string, value?: number) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (!type) {
    return `${value}`;
  }
  const normalized = type.toLowerCase();
  if (normalized.includes("percent")) {
    return `${value}% OFF`;
  }
  if (normalized.includes("amount") || normalized.includes("flat")) {
    return `${value} OFF`;
  }
  if (normalized.includes("free")) {
    return "Free";
  }
  return `${value} ${type}`;
};

export const formatDateRange = (startDate?: string, endDate?: string) => {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || "";
};
