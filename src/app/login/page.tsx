"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const registered = search.get("registered") === "1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Неверный email или пароль.");
        return;
      }
      router.push(search.get("callbackUrl") || "/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Вход</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Тот же аккаунт на всех устройствах; в Liveblocks будет ваш id и имя из профиля.
        </p>
      </div>
      {registered ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          Регистрация прошла успешно. Войдите с тем же email.
        </p>
      ) : null}
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600 dark:text-neutral-300">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600 dark:text-neutral-300">Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Вход…" : "Войти"}
        </button>
      </form>
      <p className="text-center text-sm text-neutral-500">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
          Регистрация
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/" className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
          ← На холст
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-100 px-4 py-12 dark:bg-neutral-900">
      <Suspense fallback={<p className="text-sm text-neutral-500">Загрузка…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
