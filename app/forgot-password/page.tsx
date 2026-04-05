"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifier: identifier.trim()
        })
      });

      const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Gagal memproses permintaan reset password.");
        return;
      }

      setSuccess("Jika akun ditemukan, link reset password sudah kami kirim ke email terdaftar.");
    } catch {
      setError("Terjadi gangguan jaringan. Coba lagi sebentar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center justify-center px-4 py-10">
      <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-card to-background/50 p-6 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-70" />
        <div className="relative z-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">Lupa Password</h1>
            <p className="mt-2 text-[14px] font-medium leading-relaxed text-muted-foreground/80">
              Masukkan email atau WhatsApp akun Anda. Kami akan kirim link untuk atur ulang password.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="identifier">
                Email atau WhatsApp
              </label>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="owner@20byte.com atau 08xxxxxx"
                className="h-12 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600 shadow-sm">
                {error}
              </p>
            ) : null}

            {success ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 shadow-sm">
                {success}
              </p>
            ) : null}

            <div className="pt-2">
              <Button className="h-12 w-full rounded-xl font-bold shadow-md shadow-primary/20 text-[15px]" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Mengirim..." : "Kirim Link Reset"}
              </Button>
            </div>
          </form>

          <p className="mt-8 text-center text-[13px] font-medium text-muted-foreground/80">
            Sudah ingat password?{" "}
            <Link className="font-bold text-primary underline-offset-4 hover:underline" href="/login">
              Kembali ke Login
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
