"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PublicInvoiceProofUploaderProps = {
  token: string;
  milestones: Array<{
    id: string;
    type: string;
  }>;
};

type ApiError = {
  error?: {
    message?: string;
  };
};

export function PublicInvoiceProofUploader({ token, milestones }: PublicInvoiceProofUploaderProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [milestoneType, setMilestoneType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setIsError(true);
      setMessage("Pilih file bukti bayar terlebih dahulu.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);
      setIsError(false);

      const formData = new FormData();
      formData.set("file", file);
      if (milestoneType) {
        formData.set("milestoneType", milestoneType);
      }

      const response = await fetch(`/api/public-invoices/${encodeURIComponent(token)}/proofs`, {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal upload bukti bayar.");
      }

      setFile(null);
      setMilestoneType("");
      setMessage("Bukti bayar berhasil diupload.");
      setIsError(false);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Gagal upload bukti bayar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="print-hidden space-y-2.5 rounded-lg border border-border/70 bg-background/60 p-3">
      <div className="flex items-center gap-1.5">
        <Upload className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-medium text-foreground">Upload Bukti Bayar</p>
      </div>
      <p className="-mt-1 text-[11px] text-muted-foreground">Format: PNG, JPG, WEBP, PDF. Maks 6 MB.</p>
      <Input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="h-8 text-xs file:text-xs"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
        }}
      />
      <select
        value={milestoneType}
        onChange={(event) => setMilestoneType(event.target.value)}
        disabled={milestones.length === 0}
        className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Milestone (opsional)</option>
        {milestones.map((milestone) => (
          <option key={milestone.id} value={milestone.type}>
            {milestone.type}
          </option>
        ))}
      </select>
      <div className="flex justify-end">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={isSubmitting || !file}>
          {isSubmitting ? "Uploading..." : "Upload Bukti Bayar"}
        </Button>
      </div>
      {message ? (
        <p className={isError ? "text-[11px] text-destructive" : "text-[11px] text-emerald-600"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
