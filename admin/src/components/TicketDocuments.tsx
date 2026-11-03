"use client";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, invoicesApi } from "@/lib/api";
import { Upload, Download, ImagePlus, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from '@/lib/dateTime';
function Media({ item }: { item: any }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true,
      objectUrl = "";
    api
      .get("/attachments/" + item.id + "/file", { responseType: "blob" })
      .then((r) => {
        objectUrl = URL.createObjectURL(r.data);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id]);
  return (
    <figure>
      {url ? (
        item.mime.startsWith("video/") ? (
          <video src={url} controls className="w-full max-h-64 rounded-lg" />
        ) : (
          <a href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt={item.caption}
              className="w-full h-44 object-contain bg-gray-50 rounded-lg"
            />
          </a>
        )
      ) : (
        <p className="text-sm">Preview unavailable</p>
      )}
      <figcaption className="text-sm mt-2 break-words">
        {item.caption}
      </figcaption>
      <p className="text-xs text-gray-500">
        {formatDateTime(item.createdAt)}
      </p>
    </figure>
  );
}
export default function TicketDocuments({
  id,
  canInvoice = true,
}: {
  id: string;
  canInvoice?: boolean;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null),
    [reference, setReference] = useState(""),
    [kind, setKind] = useState("Invoice"),
    [caption, setCaption] = useState(""),
    [busy, setBusy] = useState(false);
  const { data: documents = [] } = useQuery({
    queryKey: ["sr-invoices", id],
    queryFn: () => invoicesApi.listForSr(id),
  });
  const { data: media = [] } = useQuery({
    queryKey: ["attachments", id],
    queryFn: () =>
      api.get("/service-requests/" + id + "/attachments").then((r) => r.data),
  });
  async function uploadDocument() {
    const normalizedReference = reference.trim();
    if (!file || !normalizedReference) {
      toast.error("Select a PDF and enter its reference");
      return;
    }
    if (file.type && file.type !== 'application/pdf') { toast.error('Choose a PDF document'); return; }
    if (!/\.pdf$/i.test(file.name)) { toast.error('Choose a PDF document'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Choose a PDF smaller than 10 MB'); return; }
    if (documents.some((document: any) => document.invoiceNumber?.trim().toLocaleLowerCase() === normalizedReference.toLocaleLowerCase())) {
      toast.error('This document reference is already in use. Use the unique number printed on the PDF.');
      return;
    }
    setBusy(true);
    try {
      await invoicesApi.upload(id, file, normalizedReference, kind);
      qc.invalidateQueries({ queryKey: ["sr-invoices", id] });
      setFile(null);
      setReference("");
      toast.success("Document shared with customer");
    } catch (e: any) {
      const responseMessage = e.response?.data?.message;
      toast.error(Array.isArray(responseMessage) ? responseMessage.join(', ') : responseMessage ?? "Upload failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function uploadMedia(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      toast.error('Choose a JPG, PNG, WebP or MP4 up to 20 MB');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("caption", caption.trim() || "Service update");
      await api.post("/service-requests/" + id + "/attachments", fd);
      qc.invalidateQueries({ queryKey: ["attachments", id] });
      setCaption("");
      toast.success("Update shared with customer");
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-6">
      <div className="border-t pt-6">
        <h2 className="font-bold text-lg mb-4">Documents</h2>
        {canInvoice && (
          <div className="grid gap-3 sm:grid-cols-2 mb-5">
            <label className="text-sm">
              Document type
              <select
                className="w-full border rounded-lg p-2 mt-1"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {["Invoice", "Receipt", "Service report"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Document reference
              <input
                className="w-full border rounded-lg p-2 mt-1"
                value={reference}
                maxLength={100}
                placeholder="Unique number printed on the PDF"
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              PDF (up to 10 MB)
              <input
                type="file"
                accept="application/pdf"
                className="block w-full mt-2 text-sm"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected && !reference.trim()) setReference(selected.name.replace(/\.pdf$/i, '').slice(0, 100));
                }}
              />
            </label>
            <button
              disabled={busy || !file || !reference.trim()}
              onClick={uploadDocument}
              className="flex items-center justify-center gap-2 bg-brand-800 text-white rounded-lg px-4 py-3 disabled:opacity-50"
            >
              <Upload size={17} /> Upload document
            </button>
          </div>
        )}
        {!documents.length && (
          <p className="text-sm text-gray-500">No documents uploaded.</p>
        )}
        {documents.map((d: any) => (
          <div key={d.id} className="flex items-center gap-3 py-3 border-b min-w-0">
            <FileText size={18} />
            <span className="flex-1 min-w-0 break-words">
              {d.documentKind ?? "Invoice"} · {d.invoiceNumber}
            </span>
            <button
              aria-label="Download PDF"
              onClick={() =>
                invoicesApi
                  .openPdf(d.id)
                  .catch(() =>
                    toast.error("Document unavailable. Please upload the PDF."),
                  )
              }
              className="p-2"
            >
              <Download size={19} />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t pt-6">
        <h2 className="font-bold text-lg mb-4">Service updates</h2>
        <label className="text-sm block mb-3">
          Customer-visible caption
          <input
            className="border rounded-lg p-3 w-full mt-1"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe the service update"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold mb-5">
          <ImagePlus size={18} /> Photo or video (up to 20 MB)
          <input
            type="file"
            disabled={busy}
            accept="image/jpeg,image/png,image/webp,video/mp4"
            className="w-full min-w-0"
            onChange={(e) => {
              uploadMedia(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          {media.map((m: any) => (
            <Media key={m.id} item={m} />
          ))}
        </div>
      </div>
    </section>
  );
}
