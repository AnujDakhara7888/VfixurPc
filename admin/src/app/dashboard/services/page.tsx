"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Save, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
const modes = ["PICKUP", "CARRY_IN", "ON_SITE", "REMOTE", "CONSULTATION"];
export default function ServicesPage() {
  const qc = useQueryClient();
  const { data = [], isError } = useQuery({
    queryKey: ["catalog-all"],
    queryFn: () => api.get("/catalog/all").then((r) => r.data),
  });
  const [draft, setDraft] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api.put("/catalog/" + draft.id, draft);
      qc.invalidateQueries({ queryKey: ["catalog-all"] });
      toast.success("Service updated");
      setDraft(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? "Could not save service");
    } finally {
      setBusy(false);
    }
  }
  function patchField(i: number, patch: any) {
    setDraft({
      ...draft,
      fields: draft.fields.map((f: any, j: number) =>
        j === i ? { ...f, ...patch } : f,
      ),
    });
  }
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Service catalogue</h1>
      {isError && <p>Could not load services.</p>}
      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        <nav>
          {data.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setDraft(structuredClone(s))}
              className={
                "w-full text-left p-3 border-b text-sm " +
                (draft?.id === s.id ? "bg-blue-50 font-bold" : "")
              }
            >
              {s.label}
              {!s.enabled ? " (disabled)" : ""}
            </button>
          ))}
        </nav>
        {draft && (
          <section className="space-y-4 min-w-0">
            <div className="flex gap-4 items-center">
              <h2 className="text-xl font-bold flex-1">{draft.label}</h2>
              <button
                onClick={save}
                disabled={busy}
                className="bg-brand-800 text-white rounded-lg p-3 flex gap-2"
              >
                <Save size={18} />
                Save
              </button>
            </div>
            <label className="block text-sm">
              Service name
              <input
                className="block border rounded-lg p-2 w-full mt-1"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Short name
              <input
                className="block border rounded-lg p-2 w-full mt-1"
                value={draft.short}
                onChange={(e) => setDraft({ ...draft, short: e.target.value })}
              />
            </label>
            <label className="flex gap-3 items-center">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              Enabled
            </label>
            <label className="block text-sm">
              Display order
              <input
                type="number"
                min="0"
                className="border rounded-lg p-2 ml-3 w-20"
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: Number(e.target.value) })
                }
              />
            </label>
            <fieldset>
              <legend className="font-bold mb-2">Service modes</legend>
              <div className="flex flex-wrap gap-4">
                {modes.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.modes.includes(m)}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          modes: draft.modes.includes(m)
                            ? draft.modes.filter((x: string) => x !== m)
                            : [...draft.modes, m],
                        })
                      }
                    />
                    {m.replaceAll("_", " ")}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block font-bold">
              Issues / requirements
              <textarea
                rows={8}
                className="block w-full border rounded-lg p-3 text-sm font-normal mt-2"
                value={draft.issues.map((i: any) => i.label).join("\n")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    issues: e.target.value
                      .split("\n")
                      .map((label, i) => ({
                        id: String(i),
                        label,
                        icon: "help-circle-outline",
                      })),
                  })
                }
              />
            </label>
            <h3 className="font-bold">Questions, brands and models</h3>
            {draft.fields.map((f: any, i: number) => (
              <fieldset key={i} className="border-b pb-4 space-y-2">
                <div className="flex gap-2">
                  <input
                    aria-label="Question label"
                    value={f.label}
                    onChange={(e) => patchField(i, { label: e.target.value })}
                    className="border rounded-lg p-2 min-w-0 flex-1"
                  />
                  <button
                    title="Remove question"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        fields: draft.fields.filter(
                          (_: any, j: number) => i !== j,
                        ),
                      })
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex gap-4">
                  <select
                    aria-label="Question type"
                    value={f.type}
                    onChange={(e) =>
                      patchField(i, {
                        type: e.target.value,
                        options: f.options ?? [],
                      })
                    }
                    className="border p-2 rounded-lg"
                  >
                    {["text", "number", "select", "multi"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <label className="flex gap-2 items-center text-sm">
                    <input
                      type="checkbox"
                      checked={!!f.required}
                      onChange={(e) =>
                        patchField(i, { required: e.target.checked })
                      }
                    />
                    Required
                  </label>
                </div>
                {["select", "multi"].includes(f.type) && (
                  <textarea
                    aria-label="Choices, one per line"
                    className="border rounded-lg p-2 w-full text-sm"
                    rows={4}
                    value={(f.options ?? []).join("\n")}
                    onChange={(e) =>
                      patchField(i, { options: e.target.value.split("\n") })
                    }
                  />
                )}
              </fieldset>
            ))}
            <button
              className="flex gap-2 items-center text-blue-700"
              onClick={() =>
                setDraft({
                  ...draft,
                  fields: [
                    ...draft.fields,
                    {
                      id: "question-" + Date.now(),
                      label: "New question",
                      type: "text",
                    },
                  ],
                })
              }
            >
              <Plus size={18} />
              Add question
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
