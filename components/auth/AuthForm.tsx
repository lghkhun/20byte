"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invalidateOrganizationsCache } from "@/lib/client/orgsCache";

type AuthFormMode = "login" | "register";

type AuthFormProps = {
  mode: AuthFormMode;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

function getErrorMessage(payload: ApiErrorResponse | null, fallback: string): string {
  return payload?.error?.message ?? fallback;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin ? { identifier: email, password } : { name, email, phone, password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseData = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      if (!response.ok) {
        setError(getErrorMessage(responseData, "Request failed."));
        return;
      }

      if (isLogin) {
        invalidateOrganizationsCache();
        setSuccess("Login successful. Redirecting to inbox...");
        router.push("/inbox");
        router.refresh();
        return;
      }

      setSuccess("Account created. Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-card to-background/50 p-6 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] sm:p-8">
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-70" />
      <div className="relative z-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">{isLogin ? "Welcome back" : "Create an account"}</h1>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-muted-foreground/80">
            {isLogin ? "Sign in to your team workspace to continue." : "Start setting up your team workspace credentials."}
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {!isLogin ? (
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="name">
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jane Doe"
                className="h-12 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
              />
            </div>
          ) : null}

          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="email">
              {isLogin ? "Email atau WhatsApp" : "Email Address"}
            </label>
            <Input
              id="email"
              name="email"
              type={isLogin ? "text" : "email"}
              autoComplete={isLogin ? "username" : "email"}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={isLogin ? "you@company.com atau 08xxxxxx" : "you@company.com"}
              className="h-12 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
            />
          </div>

          {!isLogin ? (
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="phone">
                WhatsApp Number
              </label>
              <Input
                id="phone"
                name="phone"
                type="text"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+628123456789 atau 08123456789"
                className="h-12 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
              />
            </div>
          ) : null}

          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className="h-12 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
            />
            {isLogin ? (
              <div className="flex justify-end pt-1">
                <Link className="text-xs font-semibold text-primary underline-offset-4 hover:underline" href="/forgot-password">
                  Lupa password?
                </Link>
              </div>
            ) : null}
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
              {isSubmitting
                ? isLogin
                  ? "Signing in..."
                  : "Creating account..."
                : isLogin
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-[13px] font-medium text-muted-foreground/80">
          {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
          <Link className="font-bold text-primary underline-offset-4 hover:underline" href={isLogin ? "/register" : "/login"}>
            {isLogin ? "Daftar di sini" : "Login di sini"}
          </Link>
        </p>
      </div>
    </div>
  );
}
