import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { devicesApi, srApi } from "@/api/client";
import LargeHeader from "@/components/LargeHeader";
import { Colors } from "@/theme";
import { formatDeviceName } from "@/catalog/services";
export default function MyDevicesScreen({ navigation }: any) {
  const { data: devices = [], isLoading } = useQuery<any[]>({
    queryKey: ["devices"],
    queryFn: devicesApi.list,
  });
  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ["my-requests"],
    queryFn: srApi.list,
  });
  return (
    <View style={s.root}>
      <LargeHeader title="My devices" onBack={() => navigation.goBack()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator>
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          devices.map((d) => (
              <View
                key={d.id}
                style={s.device}
              >
                <View style={s.deviceHead}><View style={s.icon}><Text style={s.iconText}>{(d.brand || d.model || 'D').slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.deviceName}>{formatDeviceName(d)}</Text><Text style={s.deviceType}>{d.deviceType ?? d.type ?? 'Saved device'}</Text></View></View>
                <View style={s.details}>
                  {d.brand ? <Text style={s.detail}><Text style={s.detailLabel}>Brand: </Text>{d.brand}</Text> : null}
                  {d.model ? <Text style={s.detail}><Text style={s.detailLabel}>Model: </Text>{d.model}</Text> : null}
                {d.serialNumber && (
                  <Text style={s.detail}><Text style={s.detailLabel}>Serial number: </Text>{d.serialNumber}</Text>
                )}
                </View>
                <TouchableOpacity
                  style={s.bookAgain}
                  onPress={() =>
                    navigation
                      .getParent()
                      ?.navigate("BookTab", {
                        screen: "Step1Device",
                        params: {
                          savedDeviceId: d.id,
                        },
                      })
                  }
                >
                  <Text style={s.bookAgainText}>Book service again</Text><Ionicons name="arrow-forward" size={18} color={Colors.accent} />
                </TouchableOpacity>
                {requests
                  .filter((r) => r.device?.id === d.id)
                  .map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={s.historyRow}
                      onPress={() =>
                        navigation
                          .getParent()
                          ?.navigate("HomeTab", {
                            screen: "RequestDetail",
                            params: { id: r.id },
                          })
                      }
                    >
                      <Text style={s.historyText}>
                        {r.ticketNumber} · {r.status.replaceAll("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            ))
        )}
        {!isLoading && !devices.length && (
          <Text>
            Your devices will appear after your first service booking.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  device: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 16 },
  deviceHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: Colors.accent, fontSize: 20, fontWeight: '800' },
  deviceName: { fontSize: 18, fontWeight: '800', color: Colors.ink },
  deviceType: { color: Colors.inkSecondary, marginTop: 2, textTransform: 'capitalize' },
  details: { paddingVertical: 12, gap: 5 },
  detail: { color: Colors.inkSecondary, fontSize: 13 },
  detailLabel: { color: Colors.ink, fontWeight: '700' },
  bookAgain: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.line },
  bookAgainText: { color: Colors.accentInk, fontWeight: '700' },
  historyRow: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: Colors.line },
  historyText: { color: Colors.inkSecondary, fontSize: 13 },
});
