import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/api/client";
import { Colors } from "@/theme";
import Toast from "react-native-toast-message";
import { formatDateTime } from '@/utils/dateTime';
import AttachmentPreview, { AttachmentThumbnail, AttachmentSource } from './AttachmentPreview';
import { openAttachment, previewError } from './attachmentPreviewFiles';
import { pickServiceMedia } from '@/utils/mediaPicker';
export async function openTicketFile(path: string, name: string) {
  await openAttachment({ path, name, mime: name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'video/mp4' });
}
export default function TicketFiles({ id }: { id: string }) {
  const [preview, setPreview] = useState<AttachmentSource | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const documentsQuery = useQuery<any[]>({
    queryKey: ["documents", id],
    queryFn: () =>
      api.get("/service-requests/" + id + "/invoice").then((r) => r.data),
  });
  const mediaQuery = useQuery<any[]>({
    queryKey: ["attachments", id],
    queryFn: () =>
      api.get("/service-requests/" + id + "/attachments").then((r) => r.data),
    refetchInterval: 30000,
  });
  const documents = documentsQuery.data ?? [];
  const media = mediaQuery.data ?? [];
  async function upload() {
    let result;
    try {
      result = await pickServiceMedia(false);
    } catch {
      Toast.show({ type: "error", text1: "Could not open your photo library", text2: "Please try again." });
      return;
    }
    if (!result || result.canceled) return;
    setBusy(true);
    try {
      const asset = result.assets[0],
        fd = new FormData();
      fd.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "device.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as any);
      fd.append("caption", "Customer device / issue photo");
      await api.post("/service-requests/" + id + "/attachments", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      qc.invalidateQueries({ queryKey: ["attachments", id] });
    } catch {
      Toast.show({
        type: "error",
        text1: "Upload failed",
        text2: "Use JPG, PNG, WebP or MP4 up to 20 MB.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ marginVertical: 16 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          marginBottom: 12,
          color: Colors.ink,
        }}
      >
        Documents
      </Text>
      {documentsQuery.isPending && <ActivityIndicator accessibilityLabel="Loading documents" />}
      {documentsQuery.isError && <FileListError error={documentsQuery.error} retry={() => { void documentsQuery.refetch(); }} />}
      {!documentsQuery.isPending && !documentsQuery.isError && !documents.length && (
        <Text style={{ color: Colors.inkSecondary }}>
          Your uploaded invoices, receipts and reports will appear here.
        </Text>
      )}
      {documents.map((d) => (
        <TouchableOpacity
          disabled={busy}
          key={d.id}
          style={{ flexDirection: "row", gap: 12, paddingVertical: 16 }}
          onPress={() =>
            setPreview({ path: "/invoices/" + d.id + "/pdf", name: d.invoiceNumber + ".pdf", mime: 'application/pdf' })
          }
        >
          <Ionicons
            name="document-text-outline"
            size={22}
            color={Colors.accentInk}
          />
          <Text style={{ flex: 1, color: Colors.accentInk }}>
            {d.documentKind ?? "Invoice"} · {d.invoiceNumber}
          </Text>
          <Text style={{ color: Colors.accentInk, fontWeight: '600' }}>Open invoice</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.accentInk} />
        </TouchableOpacity>
      ))}
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          marginVertical: 16,
          color: Colors.ink,
        }}
      >
        Device & workshop updates
      </Text>
      {mediaQuery.isPending && <ActivityIndicator accessibilityLabel="Loading attachments" />}
      {mediaQuery.isError && <FileListError error={mediaQuery.error} retry={() => { void mediaQuery.refetch(); }} />}
      {media.map((m) => (
        <View key={m.id} style={{ marginBottom: 20 }}>
          <AttachmentThumbnail source={mediaSource(m)} onPress={() => setPreview(mediaSource(m))} />
          <Text style={{ fontWeight: "600", marginTop: 8 }}>{m.caption}</Text>
          <Text
            style={{ fontSize: 12, color: Colors.inkTertiary, marginTop: 4 }}
          >
            {formatDateTime(m.createdAt)}
          </Text>
        </View>
      ))}
      <TouchableOpacity
        disabled={busy}
        onPress={() => { void upload(); }}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, marginTop: 4, borderWidth: 1, borderColor: Colors.lineStrong, borderRadius: 8, backgroundColor: Colors.white }}
      >
        <Ionicons name="images-outline" size={22} color={Colors.accentInk} />
        <Text style={{ color: Colors.accentInk, fontWeight: "600" }}>
          Add a photo or video
        </Text>
      </TouchableOpacity>
      {busy && <ActivityIndicator />}
      <AttachmentPreview source={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

function mediaSource(m: { id: string; mime?: string }): AttachmentSource {
  const mime = m.mime ?? 'application/octet-stream';
  const extension: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'application/pdf': 'pdf' };
  return { path: `/attachments/${m.id}/file`, name: `${m.id}.${extension[mime] ?? 'bin'}`, mime };
}

function FileListError({ error, retry }: { error: unknown; retry: () => void }) {
  return <View><Text accessibilityRole="alert" style={{ color: Colors.ink }}>{previewError(error)}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={retry} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: Colors.accentInk }}>Retry</Text></TouchableOpacity>
  </View>;
}
