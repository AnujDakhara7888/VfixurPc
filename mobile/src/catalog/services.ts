import type React from "react";
import type { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import defaults from "./defaults.json";
import type { Device } from "@/types";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export interface ServiceIssue {
  id: string;
  label: string;
  icon: IconName;
}
export interface ServiceField {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "multi";
  required?: boolean;
  options?: string[];
  showWhen?: { field: string; values: string[] };
}
export interface ServiceCategory {
  id: string;
  label: string;
  short: string;
  icon: IconName;
  tagline: string;
  needsDevice: boolean;
  popular?: boolean;
  enabled: boolean;
  sortOrder: number;
  issues: ServiceIssue[];
  fields: ServiceField[];
  modes: string[];
  notice?: string;
}
export const SERVICE_CATEGORIES = defaults as ServiceCategory[];
export const BRANDS = [
  "Dell",
  "HP",
  "Lenovo",
  "Asus",
  "Acer",
  "MSI",
  "Samsung",
  "Microsoft Surface",
  "Other",
  "Not sure",
];
export const BOOKING_STEPS = ["Service", "Details", "Review"] as const;
export const MODE_LABELS: Record<string, string> = {
  PICKUP: "Pickup & delivery",
  CARRY_IN: "Carry-in",
  ON_SITE: "On-site visit",
  REMOTE: "Remote support",
  CONSULTATION: "Consultation",
};
export const OFFICE_ADDRESS =
  "3rd floor, 99 Ratnajyot industrial premises, Irla Lane, Near Ambe Mata Chawk, Vile Parle West, Mumbai 400056";
export function applyRequirements(category: ServiceCategory): ServiceCategory {
  const required: Record<string, string[]> = { data: ['deviceType'], backup: ['customerType', 'backupFor', 'dataAmount', 'users'] };
  return { ...category, fields: category.fields.map(field => required[category.id]?.includes(field.id)
    ? { ...field, required: true, ...(field.type === 'select' && !field.options?.some(v => /not sure/i.test(v)) ? { options: [...(field.options ?? []), 'Not sure'] } : {}), ...(field.id === 'users' ? { label: 'Number of users / devices (or Not sure)' } : {}) }
    : field) };
}

export function normalizeServiceCategory(category: ServiceCategory): ServiceCategory {
  const canonical = SERVICE_CATEGORIES.find(item => item.id === category.id);
  return applyRequirements({
    ...category,
    label: canonical?.label ?? category.label,
    short: canonical?.short ?? category.short,
  });
}

export function useServiceCatalog() {
  return useQuery<ServiceCategory[]>({
    queryKey: ["service-catalog"],
    queryFn: () => api.get("/catalog").then((r) => r.data.map(normalizeServiceCategory)),
    staleTime: 60000,
  });
}
export function getCategory(id?: string | null) {
  return SERVICE_CATEGORIES.find((c) => c.id === id);
}
export function getIssueLabels(id: string | undefined, issues: string[]) {
  return (getCategory(id)?.issues ?? [])
    .filter((i) => issues.includes(i.id))
    .map((i) => i.label);
}
export function formatDeviceName(
  device?: Pick<Device, "brand" | "model"> | null,
): string {
  if (!device) return "Service request";
  const brand = device.brand?.trim(),
    model = device.model?.trim();
  return !model || model.toLowerCase() === brand?.toLowerCase()
    ? brand || "Service request"
    : brand && model.toLowerCase().startsWith(brand.toLowerCase() + ' ')
      ? model
      : [brand, model].filter(Boolean).join(" ");
}
