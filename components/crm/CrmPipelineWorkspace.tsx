"use client";

import { useEffect, useState } from "react";
import { Plus, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StageItem = {
  id: string;
  name: string;
  color: string;
  position: number;
};

type PipelineItem = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: StageItem[];
};

export function CrmPipelineWorkspace() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStageNameByPipeline, setNewStageNameByPipeline] = useState<Record<string, string>>({});

  async function loadPipelines() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/crm/pipelines", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: { pipelines?: PipelineItem[] }; error?: { message?: string } } | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to load CRM pipelines.");
        return;
      }

      setPipelines(payload?.data?.pipelines ?? []);
    } catch {
      setError("Network error while loading CRM pipelines.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPipelines();
  }, []);

  return (
    <section className="space-y-5 p-5">
      <div className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Workflow className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">CRM Pipeline</h1>
                <p className="text-sm text-muted-foreground">Kelola pipeline dan stage yang dipakai di panel kanan inbox.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Input value={newPipelineName} onChange={(event) => setNewPipelineName(event.target.value)} placeholder="Nama pipeline baru" className="h-11 w-56 rounded-xl" />
            <Button
              type="button"
              className="h-11 gap-2 rounded-xl"
              onClick={async () => {
                if (!newPipelineName.trim()) {
                  return;
                }

                const response = await fetch("/api/crm/pipelines", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({ name: newPipelineName.trim() })
                });
                const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
                if (!response.ok) {
                  setError(payload?.error?.message ?? "Failed to create pipeline.");
                  return;
                }
                setNewPipelineName("");
                await loadPipelines();
              }}
            >
              <Plus className="h-4 w-4" />
              Tambah Pipeline
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading pipelines...</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {pipelines.map((pipeline) => (
          <article key={pipeline.id} className="rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{pipeline.name}</h2>
                <p className="text-xs text-muted-foreground">{pipeline.isDefault ? "Default pipeline" : "Custom pipeline"}</p>
              </div>
              {pipeline.isDefault ? <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Default</span> : null}
            </div>

            <div className="mt-4 space-y-2">
              {pipeline.stages.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{stage.name}</p>
                    <p className="text-xs text-muted-foreground">Posisi {stage.position + 1}</p>
                  </div>
                  <span className="rounded-full border border-border/70 px-2 py-1 text-[11px] text-muted-foreground">{stage.color}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                value={newStageNameByPipeline[pipeline.id] ?? ""}
                onChange={(event) => setNewStageNameByPipeline((current) => ({ ...current, [pipeline.id]: event.target.value }))}
                placeholder="Nama stage baru"
                className="h-10 rounded-xl"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-xl border border-border/80 bg-background"
                onClick={async () => {
                  const stageName = newStageNameByPipeline[pipeline.id]?.trim();
                  if (!stageName) {
                    return;
                  }

                  const response = await fetch(`/api/crm/pipelines/${encodeURIComponent(pipeline.id)}/stages`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ name: stageName, color: "emerald" })
                  });
                  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
                  if (!response.ok) {
                    setError(payload?.error?.message ?? "Failed to create stage.");
                    return;
                  }
                  setNewStageNameByPipeline((current) => ({ ...current, [pipeline.id]: "" }));
                  await loadPipelines();
                }}
              >
                Tambah Stage
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
