"use client";

import { useCallback, useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { compressImageFile } from "@/lib/marAntonia/imageCompression";

interface CaregiverInfo {
  id: string;
  name: string | null;
  email: string;
  role: "MAMA" | "PAPA";
  isYou: boolean;
}
interface DoctorInfo {
  id: string;
  name: string;
  specialty: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}
interface PrescriptionInfo {
  id: string;
  date: string;
  doctorId: string | null;
  doctor: { id: string; name: string } | null;
  medication: string;
  instructions: string | null;
  photoDataUrl: string | null;
}
interface ProductInfo {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  photoDataUrl: string | null;
}

type Section = "doctors" | "prescriptions" | "products";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "doctors", label: "Médicos" },
  { key: "prescriptions", label: "Recetas" },
  { key: "products", label: "Productos" },
];

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export default function MarAntoniaInfoPage() {
  const [caregivers, setCaregivers] = useState<CaregiverInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("doctors");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mar-antonia/children/current")
      .then((res) => res.json())
      .then(({ caregivers: cg }) => {
        if (!cancelled) {
          setCaregivers(cg);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mar-antonia" />
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/mar-antonia" />
      <div>
        <h1 className="text-2xl font-bold text-white">Información</h1>
        <p className="mt-1 text-sm text-muted">Médicos, recetas y productos que usa Mar.</p>
      </div>

      <div className="flex gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              section === s.key
                ? "border-accent bg-accent/15 text-white"
                : "border-white/15 text-neutral-300 hover:border-white/30"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "doctors" && <DoctorsSection caregivers={caregivers} />}
      {section === "prescriptions" && <PrescriptionsSection caregivers={caregivers} />}
      {section === "products" && <ProductsSection caregivers={caregivers} />}
    </div>
  );
}

function PhotoField({
  label,
  photoDataUrl,
  onChange,
  onError,
}: {
  label: string;
  photoDataUrl: string | null;
  onChange: (dataUrl: string | null) => void;
  onError: (message: string) => void;
}) {
  const [compressing, setCompressing] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    try {
      onChange(await compressImageFile(file));
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo procesar la foto.");
    }
    setCompressing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-white">{label}</span>
      {photoDataUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a locally-compressed data: URL, not something next/image's remote loader can optimize */}
          <img src={photoDataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/30 transition-colors"
          >
            Quitar foto
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={compressing}
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
      )}
      {compressing && <span className="text-xs text-muted">Procesando foto…</span>}
    </div>
  );
}

function DoctorsSection({ caregivers }: { caregivers: CaregiverInfo[] }) {
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSpecialty, setDraftSpecialty] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mar-antonia/doctors");
    const { doctors: d } = await res.json();
    setDoctors(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setDraftName("");
    setDraftSpecialty("");
    setDraftLocation("");
    setDraftPhone("");
    setDraftEmail("");
    setDraftNotes("");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(d: DoctorInfo) {
    setEditingId(d.id);
    setDraftName(d.name);
    setDraftSpecialty(d.specialty ?? "");
    setDraftLocation(d.location ?? "");
    setDraftPhone(d.phone ?? "");
    setDraftEmail(d.email ?? "");
    setDraftNotes(d.notes ?? "");
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function save() {
    if (!draftName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const body = {
      name: draftName.trim(),
      specialty: draftSpecialty || null,
      location: draftLocation || null,
      phone: draftPhone || null,
      email: draftEmail || null,
      notes: draftNotes || null,
      ...(editingId ? {} : { caregiverId: caregivers.find((c) => c.isYou)?.id ?? caregivers[0]?.id }),
    };
    setSaving(true);
    setError(null);
    const res = await fetch(editingId ? `/api/mar-antonia/doctors/${editingId}` : "/api/mar-antonia/doctors", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    closeForm();
    load();
  }

  async function remove(id: string) {
    setSaving(true);
    await fetch(`/api/mar-antonia/doctors/${id}`, { method: "DELETE" });
    setSaving(false);
    closeForm();
    load();
  }

  if (loading) return <p className="text-center text-sm text-muted">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4">
      {!formOpen && (
        <button
          onClick={openCreate}
          className="w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          + Agregar médico
        </button>
      )}

      {formOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <Field id="doctor-name" label="Nombre" value={draftName} onChange={setDraftName} placeholder="Dra. María Pérez" />
          <Field id="doctor-specialty" label="Especialidad" value={draftSpecialty} onChange={setDraftSpecialty} placeholder="Pediatra" />
          <Field id="doctor-location" label="Dónde atiende" value={draftLocation} onChange={setDraftLocation} placeholder="Clínica Alemana, consulta 302" />
          <Field id="doctor-phone" label="Teléfono" value={draftPhone} onChange={setDraftPhone} type="tel" />
          <Field id="doctor-email" label="Correo" value={draftEmail} onChange={setDraftEmail} type="email" />
          <TextArea id="doctor-notes" label="Notas" value={draftNotes} onChange={setDraftNotes} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar"}
            </button>
            {editingId && (
              <button
                onClick={() => remove(editingId)}
                disabled={saving}
                className="rounded-lg border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
            <button onClick={closeForm} className="rounded-lg px-3 py-2.5 text-sm text-muted hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {doctors.length === 0 ? (
        <p className="text-center text-sm text-muted">Todavía no hay médicos registrados.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {doctors.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => openEdit(d)}
                className="flex w-full flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm hover:border-white/30 transition-colors"
              >
                <span className="font-semibold text-white">
                  {d.name}
                  {d.specialty && <span className="font-normal text-muted"> · {d.specialty}</span>}
                </span>
                <span className="text-xs text-neutral-400">
                  {[d.location, d.phone, d.email].filter(Boolean).join(" · ") || "Sin más datos"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrescriptionsSection({ caregivers }: { caregivers: CaregiverInfo[] }) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionInfo[]>([]);
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftDoctorId, setDraftDoctorId] = useState("");
  const [draftMedication, setDraftMedication] = useState("");
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [presRes, docRes] = await Promise.all([
      fetch("/api/mar-antonia/prescriptions"),
      fetch("/api/mar-antonia/doctors"),
    ]);
    const { prescriptions: p } = await presRes.json();
    const { doctors: d } = await docRes.json();
    setPrescriptions(p);
    setDoctors(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setDraftDate(toDateInputValue(new Date()));
    setDraftDoctorId("");
    setDraftMedication("");
    setDraftInstructions("");
    setDraftPhoto(null);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(p: PrescriptionInfo) {
    setEditingId(p.id);
    setDraftDate(toDateInputValue(new Date(p.date)));
    setDraftDoctorId(p.doctorId ?? "");
    setDraftMedication(p.medication);
    setDraftInstructions(p.instructions ?? "");
    setDraftPhoto(p.photoDataUrl);
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function save() {
    if (!draftDate) {
      setError("Elige una fecha.");
      return;
    }
    if (!draftMedication.trim()) {
      setError("Escribe qué medicamento o indicación es.");
      return;
    }
    const body: Record<string, unknown> = {
      date: new Date(`${draftDate}T12:00:00`).toISOString(),
      medication: draftMedication.trim(),
    };
    if (draftInstructions) body.instructions = draftInstructions;
    else if (editingId) body.instructions = null;
    if (draftPhoto) body.photoDataUrl = draftPhoto;
    else if (editingId) body.photoDataUrl = null;
    if (draftDoctorId) body.doctorId = draftDoctorId;
    else if (editingId) body.doctorId = null;
    if (!editingId) body.caregiverId = caregivers.find((c) => c.isYou)?.id ?? caregivers[0]?.id;

    setSaving(true);
    setError(null);
    const res = await fetch(
      editingId ? `/api/mar-antonia/prescriptions/${editingId}` : "/api/mar-antonia/prescriptions",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    closeForm();
    load();
  }

  async function remove(id: string) {
    setSaving(true);
    await fetch(`/api/mar-antonia/prescriptions/${id}`, { method: "DELETE" });
    setSaving(false);
    closeForm();
    load();
  }

  if (loading) return <p className="text-center text-sm text-muted">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4">
      {!formOpen && (
        <button
          onClick={openCreate}
          className="w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          + Agregar receta
        </button>
      )}

      {formOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="prescription-date" className="text-sm font-semibold text-white">
              ¿Qué día?
            </label>
            <input
              id="prescription-date"
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {doctors.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-white">¿Qué médico la dio? (opcional)</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraftDoctorId("")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    draftDoctorId === "" ? "border-accent bg-accent/15 text-white" : "border-white/15 text-neutral-300 hover:border-white/30"
                  }`}
                >
                  Sin especificar
                </button>
                {doctors.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDraftDoctorId(d.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      draftDoctorId === d.id ? "border-accent bg-accent/15 text-white" : "border-white/15 text-neutral-300 hover:border-white/30"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Field id="prescription-medication" label="Medicamento / indicación" value={draftMedication} onChange={setDraftMedication} placeholder="Amoxicilina 250mg" />
          <TextArea id="prescription-instructions" label="Instrucciones" value={draftInstructions} onChange={setDraftInstructions} placeholder="1/2 medida cada 8h por 7 días" />
          <PhotoField label="Foto de la receta" photoDataUrl={draftPhoto} onChange={setDraftPhoto} onError={setError} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar"}
            </button>
            {editingId && (
              <button
                onClick={() => remove(editingId)}
                disabled={saving}
                className="rounded-lg border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
            <button onClick={closeForm} className="rounded-lg px-3 py-2.5 text-sm text-muted hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {prescriptions.length === 0 ? (
        <p className="text-center text-sm text-muted">Todavía no hay recetas registradas.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {prescriptions.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => openEdit(p)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm hover:border-white/30 transition-colors"
              >
                {p.photoDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- locally-compressed data: URL
                  <img src={p.photoDataUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-white">{p.medication}</span>
                  <span className="text-xs text-neutral-400">
                    {formatDate(p.date)}
                    {p.doctor && ` · ${p.doctor.name}`}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductsSection({ caregivers }: { caregivers: CaregiverInfo[] }) {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mar-antonia/products");
    const { products: p } = await res.json();
    setProducts(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setDraftName("");
    setDraftCategory("");
    setDraftNotes("");
    setDraftPhoto(null);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(p: ProductInfo) {
    setEditingId(p.id);
    setDraftName(p.name);
    setDraftCategory(p.category ?? "");
    setDraftNotes(p.notes ?? "");
    setDraftPhoto(p.photoDataUrl);
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function save() {
    if (!draftName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const body: Record<string, unknown> = { name: draftName.trim() };
    if (draftCategory) body.category = draftCategory;
    else if (editingId) body.category = null;
    if (draftNotes) body.notes = draftNotes;
    else if (editingId) body.notes = null;
    if (draftPhoto) body.photoDataUrl = draftPhoto;
    else if (editingId) body.photoDataUrl = null;
    if (!editingId) body.caregiverId = caregivers.find((c) => c.isYou)?.id ?? caregivers[0]?.id;

    setSaving(true);
    setError(null);
    const res = await fetch(editingId ? `/api/mar-antonia/products/${editingId}` : "/api/mar-antonia/products", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    closeForm();
    load();
  }

  async function remove(id: string) {
    setSaving(true);
    await fetch(`/api/mar-antonia/products/${id}`, { method: "DELETE" });
    setSaving(false);
    closeForm();
    load();
  }

  if (loading) return <p className="text-center text-sm text-muted">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4">
      {!formOpen && (
        <button
          onClick={openCreate}
          className="w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          + Agregar producto
        </button>
      )}

      {formOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <Field id="product-name" label="Nombre" value={draftName} onChange={setDraftName} placeholder="Crema Bepanthen" />
          <Field id="product-category" label="Tipo" value={draftCategory} onChange={setDraftCategory} placeholder="Crema, gotas, jarabe…" />
          <TextArea id="product-notes" label="Notas" value={draftNotes} onChange={setDraftNotes} placeholder="Para qué es, cómo se usa" />
          <PhotoField label="Foto del producto" photoDataUrl={draftPhoto} onChange={setDraftPhoto} onError={setError} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar"}
            </button>
            {editingId && (
              <button
                onClick={() => remove(editingId)}
                disabled={saving}
                className="rounded-lg border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
            <button onClick={closeForm} className="rounded-lg px-3 py-2.5 text-sm text-muted hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-center text-sm text-muted">Todavía no hay productos registrados.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {products.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => openEdit(p)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm hover:border-white/30 transition-colors"
              >
                {p.photoDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- locally-compressed data: URL
                  <img src={p.photoDataUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-white">
                    {p.name}
                    {p.category && <span className="font-normal text-muted"> · {p.category}</span>}
                  </span>
                  {p.notes && <span className="text-xs text-neutral-400">{p.notes}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-white">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-white">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
