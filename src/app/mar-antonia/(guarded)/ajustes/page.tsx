"use client";

import { useEffect, useState } from "react";
import { BackToHomeLink } from "@/components/BackToHomeLink";

interface ChildInfo {
  id: string;
  name: string;
  inviteCode: string;
  ownerUserId: string;
  birthDate: string | null;
  sex: "MALE" | "FEMALE" | null;
  legalName: string | null;
  rut: string | null;
  passportNumber: string | null;
  bloodType: string | null;
  medicalNotes: string | null;
}
interface CaregiverInfo {
  id: string;
  name: string | null;
  email: string;
  role: "MAMA" | "PAPA";
}

const ROLE_LABEL: Record<CaregiverInfo["role"], string> = { MAMA: "Mamá", PAPA: "Papá" };
const SEX_LABEL: Record<NonNullable<ChildInfo["sex"]>, string> = { MALE: "Niño", FEMALE: "Niña" };
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MarAntoniaAjustesPage() {
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [caregivers, setCaregivers] = useState<CaregiverInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [birthDateDraft, setBirthDateDraft] = useState("");
  const [sexDraft, setSexDraft] = useState<ChildInfo["sex"]>(null);
  const [legalNameDraft, setLegalNameDraft] = useState("");
  const [rutDraft, setRutDraft] = useState("");
  const [passportDraft, setPassportDraft] = useState("");
  const [bloodTypeDraft, setBloodTypeDraft] = useState("");
  const [medicalNotesDraft, setMedicalNotesDraft] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);

  useEffect(() => {
    // Guards against React Strict Mode's dev-only double-invoke of this
    // effect: without it, the first (discarded) run's fetch can resolve
    // *after* the second one already populated the drafts -- and after the
    // caregiver has started typing -- silently wiping out whatever they'd
    // already entered in nameDraft/birthDateDraft/sexDraft.
    let cancelled = false;
    // The caregiver check in mar-antonia/(guarded)/layout.tsx already
    // guarantees at least one child exists for this user; this page only
    // ever operates on the first one, same scope as the Inicio page.
    fetch("/api/mar-antonia/children/current")
      .then((res) => res.json())
      .then(({ child: c, caregivers: cg }) => {
        if (cancelled) return;
        setChild(c);
        setNameDraft(c.name);
        setBirthDateDraft(c.birthDate ? toDateInputValue(c.birthDate) : "");
        setSexDraft(c.sex);
        setLegalNameDraft(c.legalName ?? "");
        setRutDraft(c.rut ?? "");
        setPassportDraft(c.passportNumber ?? "");
        setBloodTypeDraft(c.bloodType ?? "");
        setMedicalNotesDraft(c.medicalNotes ?? "");
        setCaregivers(cg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!child || !nameDraft.trim()) return;
    setSavingName(true);
    const res = await fetch(`/api/mar-antonia/children/${child.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft.trim() }),
    });
    const { child: updated } = await res.json();
    setChild(updated);
    setSavingName(false);
  }

  async function saveIdentityInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!child) return;
    setSavingIdentity(true);
    const res = await fetch(`/api/mar-antonia/children/${child.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birthDate: birthDateDraft ? new Date(`${birthDateDraft}T00:00:00`).toISOString() : null,
        sex: sexDraft,
        legalName: legalNameDraft || null,
        rut: rutDraft || null,
        passportNumber: passportDraft || null,
        bloodType: bloodTypeDraft || null,
        medicalNotes: medicalNotesDraft || null,
      }),
    });
    const { child: updated } = await res.json();
    setChild(updated);
    setSavingIdentity(false);
  }

  function inviteUrl(code: string) {
    return `${window.location.origin}/mar-antonia/join/${code}`;
  }

  async function copyInvite() {
    if (!child) return;
    await navigator.clipboard.writeText(inviteUrl(child.inviteCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !child) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <BackToHomeLink href="/mar-antonia" />
        <p className="text-center text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink href="/mar-antonia" />
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-muted">El perfil y quiénes lo comparten.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-white">Perfil</h2>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            id="child-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={savingName}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
        <button
          onClick={copyInvite}
          className="w-fit rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/30 transition-colors"
        >
          {copied ? "¡Copiado! ✓" : "Copiar link de invitación"}
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-white">Datos personales</h2>
        <p className="text-xs text-muted">
          Identidad y datos por si se necesitan a mano (un control médico, un trámite, un viaje, una urgencia).
        </p>
        <form onSubmit={saveIdentityInfo} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="child-birthdate" className="text-sm font-semibold text-white">
              Fecha de nacimiento
            </label>
            <input
              id="child-birthdate"
              type="date"
              value={birthDateDraft}
              onChange={(e) => setBirthDateDraft(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-white">Sexo</span>
            <div className="flex gap-2">
              {(["MALE", "FEMALE"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSexDraft(s)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    sexDraft === s
                      ? "border-accent bg-accent/15 text-white"
                      : "border-white/15 text-neutral-300 hover:border-white/30"
                  }`}
                >
                  {SEX_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="child-legal-name" className="text-sm font-semibold text-white">
              Nombre completo (como en sus documentos)
            </label>
            <input
              id="child-legal-name"
              value={legalNameDraft}
              onChange={(e) => setLegalNameDraft(e.target.value)}
              placeholder="María Antonia Gormaz Rodríguez"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="child-rut" className="text-sm font-semibold text-white">
                Rut
              </label>
              <input
                id="child-rut"
                value={rutDraft}
                onChange={(e) => setRutDraft(e.target.value)}
                placeholder="12.345.678-9"
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="child-passport" className="text-sm font-semibold text-white">
                N° Pasaporte
              </label>
              <input
                id="child-passport"
                value={passportDraft}
                onChange={(e) => setPassportDraft(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="child-blood-type" className="text-sm font-semibold text-white">
              Tipo de sangre
            </label>
            <select
              id="child-blood-type"
              value={bloodTypeDraft}
              onChange={(e) => setBloodTypeDraft(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">No indicado</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="child-medical-notes" className="text-sm font-semibold text-white">
              Otra información relevante
            </label>
            <textarea
              id="child-medical-notes"
              value={medicalNotesDraft}
              onChange={(e) => setMedicalNotesDraft(e.target.value)}
              placeholder="Alergias, Isapre/seguro, contacto de emergencia, condiciones médicas…"
              rows={3}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={savingIdentity}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-white">Cuidadores</h2>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {caregivers.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>{c.name || c.email}</span>
              <span className="text-xs uppercase text-neutral-500">{ROLE_LABEL[c.role]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
