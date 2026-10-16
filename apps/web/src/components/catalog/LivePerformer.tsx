"use client";
import { useCallback, useState } from "react";
import BackButton from "@/components/BackButton";
import { catalogClient } from "@/lib/api/catalog";
import { ApiState, useApiResource } from "./ApiState";
import ServiceList from "./ServiceList";
export default function LivePerformer({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => catalogClient.performer(id, signal), [id]);
  const { data: profile, error, retry } = useApiResource(id, load);
  const [page, setPage] = useState("");
  if (!profile) return <><BackButton /><ApiState error={error} retry={retry} /></>;
  return <div><BackButton />
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#E5E7EB", flexShrink: 0 }} />
      <h2 style={{ margin: 0 }}>{profile.name}</h2>
    </div>
    <h3>О себе</h3><p>{profile.about || "Описание пока не добавлено."}</p>
    <h3 style={{ marginTop: 32 }}>Активные услуги</h3>
    <ServiceList query={page || `performer=${encodeURIComponent(id)}`} onPage={setPage} />
  </div>;
}
