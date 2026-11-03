import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Pdf from 'react-native-pdf';
import { onSessionCleared } from '@/api/client';
import { Colors } from '@/theme';
import { AttachmentSource, openAttachment, prepareAttachment, previewError } from './attachmentPreviewFiles';
export type { AttachmentSource } from './attachmentPreviewFiles';

function PreviewImage({ source, fullscreen = false }: { source: AttachmentSource; fullscreen?: boolean }) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let dispose = async () => {};
    setUri(undefined); setError(''); setLoaded(false);
    const unsubscribe = onSessionCleared(() => {
      controller.abort(); setUri(undefined); setError('Your session expired. Sign in again.');
      void dispose();
    });
    prepareAttachment(source, controller.signal).then(file => {
      dispose = file.dispose;
      if (controller.signal.aborted) void dispose();
      else setUri(file.uri);
    }).catch(err => { if (!controller.signal.aborted) setError(previewError(err)); });
    return () => { controller.abort(); unsubscribe(); void dispose(); };
  }, [source.uri, source.path, source.name, source.mime, attempt]);
  const picture = uri && !error ? <Image
    key={`${uri}-${attempt}`}
    source={{ uri }} resizeMode="contain"
    accessibilityLabel={source.name}
    style={fullscreen ? s.fullImageAsset : s.image}
    onLoad={() => setLoaded(true)}
    onError={() => setError('Could not display this image. Retry to load it again.')}
  /> : null;
  return <View style={fullscreen ? s.fullImage : s.thumbnail}>
    {fullscreen ? <ScrollView style={s.zoomScroller} maximumZoomScale={4} minimumZoomScale={1} centerContent contentContainerStyle={s.zoom}>{picture}</ScrollView> : picture}
    {!loaded && !error && <ActivityIndicator style={s.loading} color={Colors.accentInk} accessibilityLabel="Loading image" />}
    {!!error && <View style={s.error}><Text style={s.message}>{error}</Text><TouchableOpacity accessibilityRole="button" style={s.action} onPress={() => setAttempt(v => v + 1)}><Text style={s.link}>Retry preview</Text></TouchableOpacity></View>}
  </View>;
}

function PreviewPdf({ source, onOpen }: { source: AttachmentSource; onOpen: () => void }) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let dispose = async () => {};
    setUri(undefined); setError('');
    const unsubscribe = onSessionCleared(() => { controller.abort(); setUri(undefined); setError('Your session expired. Sign in again.'); void dispose(); });
    prepareAttachment(source, controller.signal).then(file => {
      dispose = file.dispose;
      if (controller.signal.aborted) void dispose(); else setUri(file.uri);
    }).catch(err => { if (!controller.signal.aborted) setError(previewError(err)); });
    return () => { controller.abort(); unsubscribe(); void dispose(); };
  }, [source.uri, source.path, source.name, source.mime, attempt]);
  if (error) return <View style={s.pdfMessage}><Ionicons name="document-text-outline" size={52} color={Colors.accentInk} /><Text style={s.message}>{error}</Text><TouchableOpacity style={s.action} onPress={() => setAttempt(v => v + 1)}><Text style={s.link}>Retry preview</Text></TouchableOpacity><TouchableOpacity style={s.openOutline} onPress={onOpen}><Ionicons name="open-outline" size={18} color={Colors.accentInk} /><Text style={s.link}>Open in another app</Text></TouchableOpacity></View>;
  if (!uri) return <View style={s.pdfMessage}><ActivityIndicator color={Colors.accentInk} /><Text style={s.message}>Preparing document preview...</Text></View>;
  return <View style={s.pdfWrap}>
    <Pdf source={{ uri }} style={s.pdf} trustAllCerts={false} enablePaging={false} onError={err => setError(previewError(err))} />
    <TouchableOpacity style={s.pdfOpen} accessibilityRole="button" onPress={onOpen}><Ionicons name="open-outline" size={18} color={Colors.accentInk} /><Text style={s.link}>Open or share externally</Text></TouchableOpacity>
  </View>;
}

/** Pass a picker {uri,name,mime} or protected {path,name,mime}; null closes the viewer. */
export default function AttachmentPreview({ source, onClose }: { source: AttachmentSource | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = React.useRef<AbortController | null>(null);
  const close = React.useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    onClose();
  }, [onClose]);
  useEffect(() => {
    setError(''); setBusy(false);
    return () => { controller.current?.abort(); };
  }, [source]);
  useEffect(() => onSessionCleared(close), [close]);
  async function open() {
    if (!source || busy) return;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError('');
    try { await openAttachment(source, request.signal, () => controller.current === request && !request.signal.aborted); }
    catch (err) { if (!request.signal.aborted) setError(previewError(err)); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  const safeTop = Math.max(insets.top, Platform.OS === 'ios' ? 52 : StatusBar.currentHeight ?? 24);
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 18 : 8);
  const isPdf = source?.mime === 'application/pdf' || source?.name.toLowerCase().endsWith('.pdf');
  return <Modal visible={!!source} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent={false} onRequestClose={close}>
    <View style={[s.screen, { paddingTop: safeTop, paddingBottom: safeBottom }]}>
      <View style={s.header}><Text style={s.title} numberOfLines={2}>{source?.name}</Text><TouchableOpacity style={s.close} accessibilityRole="button" accessibilityLabel="Close preview" onPress={close}><Ionicons name="close" size={24} color={Colors.ink} /></TouchableOpacity></View>
      {source?.mime.startsWith('image/') ? <PreviewImage source={source} fullscreen /> : isPdf && source ? <PreviewPdf source={source} onOpen={open} /> : <ScrollView contentContainerStyle={s.file}>
        <Ionicons name={source?.mime.startsWith('video/') ? 'videocam-outline' : 'document-text-outline'} size={56} color={Colors.accentInk} />
        <Text style={s.message}>{source?.mime.startsWith('video/') ? 'Video' : 'Document'}</Text>
        <TouchableOpacity style={s.openButton} accessibilityRole="button" accessibilityLabel={error ? 'Retry opening file' : 'Open in another app'} disabled={busy} onPress={open}><Ionicons name="open-outline" size={20} color={Colors.white} /><Text style={s.openButtonText}>{error ? 'Retry opening file' : 'Open in another app'}</Text></TouchableOpacity>
        {busy && <ActivityIndicator accessibilityLabel="Preparing file" />}
        {!!error && <Text accessibilityRole="alert" style={s.message}>{error}</Text>}
      </ScrollView>}
    </View>
  </Modal>;
}

export function AttachmentThumbnail({ source, onPress }: { source: AttachmentSource; onPress: () => void }) {
  return <View>
    {source.mime.startsWith('image/') && <PreviewImage source={source} />}
    <TouchableOpacity accessibilityRole="button" style={s.action} onPress={onPress}>
      <Ionicons name={source.mime.startsWith('image/') ? 'expand-outline' : source.mime.startsWith('video/') ? 'play-circle-outline' : 'document-text-outline'} size={22} color={Colors.accentInk} />
      <Text style={s.link}>{source.mime.startsWith('image/') ? 'View full image' : source.mime.startsWith('video/') ? 'Open video' : 'Open document'}</Text>
    </TouchableOpacity>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.line },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgApp, borderWidth: 1, borderColor: Colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  thumbnail: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Colors.bgApp, borderRadius: 8, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  fullImage: { flex: 1 },
  fullImageAsset: { width: '100%', height: '100%' },
  zoomScroller: { flex: 1 },
  zoom: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { ...StyleSheet.absoluteFillObject },
  error: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 16 },
  message: { color: Colors.ink, fontSize: 16, textAlign: 'center', flexShrink: 1 },
  action: { minHeight: 48, minWidth: 48, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  openButton: { minHeight: 50, paddingHorizontal: 20, borderRadius: 8, backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  openButtonText: { color: Colors.white, fontWeight: '700' },
  link: { color: Colors.accentInk, fontWeight: '600', flexShrink: 1 },
  file: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  pdfWrap: { flex: 1, backgroundColor: '#E9EDF3' },
  pdf: { flex: 1, width: '100%', backgroundColor: '#E9EDF3' },
  pdfMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  pdfOpen: { minHeight: 52, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  openOutline: { minHeight: 48, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.lineStrong, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
