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
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-surface/80 p-6">
      <h1 className="text-xl font-semibold">{isLogin ? "Sign in to 20byte" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isLogin ? "Use your email atau WhatsApp dan password untuk lanjut." : "Start with your team account credentials."}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {!isLogin ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Name
            </label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            {isLogin ? "Email atau WhatsApp" : "Email"}
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
          />
        </div>

        {!isLogin ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="phone">
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
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
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
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            {success}
          </p>
        ) : null}

        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isLogin
              ? "Signing in..."
              : "Creating account..."
            : isLogin
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isLogin ? "No account yet? " : "Already have an account? "}
        <Link className="text-primary hover:underline" href={isLogin ? "/register" : "/login"}>
          {isLogin ? "Register here" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
