import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/api/client";
import LargeHeader from "@/components/LargeHeader";
import { Colors } from "@/theme";
import type { Notification } from "@/types";
import Toast from "react-native-toast-message";
import NotificationSettings from '@/notifications/NotificationSettings';
import { formatDateTime } from '@/utils/dateTime';
export default function NotificationsScreen({ navigation }: any) {
  const qc = useQueryClient();
  const {
    data = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 15000,
  });
  const { data: unreadData } = useQuery({ queryKey: ['unread'], queryFn: notificationsApi.unread, refetchInterval: 15000 });
  const unread = unreadData?.count ?? data.filter((n) => !n.readAt).length;
  async function read(item?: Notification) {
    try {
      if (item) await notificationsApi.read(item.id);
      else await notificationsApi.readAll();
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread"] });
      if (item?.serviceRequestId)
        navigation.navigate('App', { screen: 'HomeTab', params: { screen: 'RequestDetail', params: { id: item.serviceRequestId } } });
      else if (item?.offerId)
        navigation.navigate('App', { screen: 'HomeTab', params: { screen: 'OfferDetail', params: { id: item.offerId } } });
    } catch {
      Toast.show({ type: "error", text1: "Could not update notification" });
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <LargeHeader
        title="Notifications"
        onBack={() => navigation.goBack()}
        subtitle={unread ? unread + " unread" : undefined}
      />
      <NotificationSettings />
      {unread > 0 && (
        <TouchableOpacity onPress={() => read()} style={{ padding: 20 }}>
          <Text style={{ color: Colors.accentInk, fontWeight: "600" }}>
            Mark all as read
          </Text>
        </TouchableOpacity>
      )}
      {isLoading ? (
        <ActivityIndicator />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()} style={{ padding: 24 }}>
          <Text>Could not load alerts. Tap to retry.</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={{ color: Colors.inkSecondary }}>
              Your service updates will appear here.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => read(item)}
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 16,
                marginBottom: 8,
                borderRadius: 8,
                backgroundColor: item.readAt ? "#f8fafb" : "#edf6fc",
              }}
            >
              {!item.readAt && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#dc2626",
                    marginTop: 6,
                  }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    lineHeight: 22,
                    fontWeight: item.readAt ? "400" : "600",
                    color: Colors.ink,
                  }}
                >
                  {item.title ? <Text style={{ fontWeight: '800' }}>{item.title}{'\n'}</Text> : null}{item.message}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.inkTertiary,
                    marginTop: 8,
                  }}
                >
                  {formatDateTime(item.createdAt ?? item.sentAt)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
