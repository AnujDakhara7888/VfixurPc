import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import Input from "./Input";
import type { ServiceField } from "@/catalog/services";
import { Colors } from "@/theme";
export type Answers = Record<string, string | string[]>;
export default function ServiceFields({
  fields,
  values,
  onChange,
}: {
  fields: ServiceField[];
  values: Answers;
  onChange: (v: Answers) => void;
}) {
  const [active, setActive] = useState<ServiceField | null>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const visible = fields.filter(
    (f) =>
      !f.showWhen ||
      f.showWhen.values.includes(String(values[f.showWhen.field] ?? "")),
  );
  function choose(field: ServiceField, option: string) {
    const previous = values[field.id];
    const selected = Array.isArray(previous) ? previous : [];
    onChange({
      ...values,
      [field.id]:
        field.type === "multi"
          ? selected.includes(option)
            ? selected.filter((v) => v !== option)
            : [...selected, option]
          : option,
    });
    if (field.type !== "multi") setActive(null);
  }
  return (
    <View>
      {visible.map((f) => (
        <View key={f.id} style={{ marginBottom: 16 }}>
          {f.type === "text" || f.type === "number" ? (
            <Input
              label={f.label + (f.required ? "" : " (optional)")}
              value={String(values[f.id] ?? "")}
              onChangeText={(v) => onChange({ ...values, [f.id]: v })}
              placeholder={`Enter ${f.label.toLowerCase()}`}
              keyboardType={f.type === "number" ? "numeric" : "default"}
            />
          ) : (
            <>
              <Text style={s.label}>
                {f.label}
                {f.required ? "" : " (optional)"}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={s.select}
                onPress={() => { Keyboard.dismiss(); setActive(f); }}
              >
                <Text style={{ flex: 1, color: Colors.ink }}>
                  {Array.isArray(values[f.id])
                    ? (values[f.id] as string[]).join(", ") || "Select"
                    : values[f.id] || "Select"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.ink} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}
      <Modal
        visible={!!active}
        transparent
        animationType="slide"
        onRequestClose={() => setActive(null)}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { height: Math.max(180, height - insets.top - 24), paddingBottom: Math.max(12, insets.bottom) }]}>
            <View style={s.head}>
              <Text style={s.title}>{active?.label}</Text>
              <TouchableOpacity
                accessibilityLabel="Close choices"
                accessibilityRole="button"
                style={s.close}
                onPress={() => setActive(null)}
              >
                <Ionicons name="close" size={24} color={Colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.options} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator>
              {active?.options?.map((o) => {
                const v = values[active.id];
                const selected = Array.isArray(v) ? v.includes(o) : v === o;
                return (
                  <TouchableOpacity
                    key={o}
                    style={s.option}
                    onPress={() => choose(active, o)}
                    accessibilityRole={
                      active.type === "multi" ? "checkbox" : "radio"
                    }
                    accessibilityState={{ checked: selected }}
                  >
                    <Ionicons
                      name={
                        active.type === "multi"
                          ? selected
                            ? "checkbox"
                            : "square-outline"
                          : selected
                            ? "radio-button-on"
                            : "radio-button-off"
                      }
                      size={22}
                      color={Colors.accentInk}
                    />
                    <Text style={{ flex: 1, fontSize: 16, color: Colors.ink }}>{o}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity accessibilityRole="button" style={s.done} onPress={() => setActive(null)}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.ink,
    marginBottom: 8,
  },
  select: {
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0007", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  options: { flex: 1, minHeight: 0 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  head: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "700", flex: 1, color: Colors.ink },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  done: {
    padding: 16,
    backgroundColor: Colors.brandNavy,
    alignItems: "center",
    borderRadius: 8,
    marginTop: 16,
  },
});
