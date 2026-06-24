"use client";

import { useEffect, useMemo, useState } from "react";

const platforms = [
  {
    id: "chaturbate",
    label: "Chaturbate",
    short: "CB",
    accent: "from-orange-500 to-orange-600",
  },
  {
    id: "bongacams",
    label: "BongaCams",
    short: "BC",
    accent: "from-pink-600 to-rose-700",
  },
  {
    id: "myfreecams",
    label: "MyFreeCams",
    short: "MFC",
    accent: "from-orange-400 to-amber-600",
  },
];

const steps = [
  { id: 1, label: "Stats" },
  { id: 2, label: "Tips" },
  { id: 3, label: "Analyze" },
  { id: 4, label: "Insights" },
  { id: 5, label: "Done" },
];

const analysisTasks = [
  "Cleaning your tip history",
  "Finding your top spenders",
  "Recognizing loyal fans",
  "Calculating peak streaming windows",
  "Building your dashboard",
];

function currency(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function compactNumber(value) {
  return Number(value || 0).toLocaleString();
}

function buildPreview(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const usernames = new Set();
  let tipsDetected = 0;
  let estimatedEarnings = 0;

  for (const line of lines) {
    const parts = line.split(/\s+/);
    const possibleUser = parts.find((part) => /[a-zA-Z]/.test(part));

    if (possibleUser) {
      usernames.add(possibleUser.replace(/[^a-zA-Z0-9_]/g, ""));
    }

    const numbers = parts
      .map((part) => Number(String(part).replace(/[^0-9.]/g, "")))
      .filter((num) => Number.isFinite(num) && num > 0);

    if (numbers.length > 0) {
      tipsDetected += 1;
      const lastNumber = numbers[numbers.length - 1];
      estimatedEarnings += lastNumber > 200 ? lastNumber * 0.05 : lastNumber;
    }
  }

  return {
    tipsDetected: tipsDetected || Math.max(lines.length, 0),
    fansDetected: usernames.size || Math.min(lines.length, 0),
    estimatedEarnings,
    topSpender: usernames.values().next().value || "bigdaddyx",
    bestWindow: "8–11 PM",
  };
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState("chaturbate");
  const [username, setUsername] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [progress, setProgress] = useState(0);

  const selectedPlatform = platforms.find((item) => item.id === platform);

  const preview = useMemo(() => {
    return buildPreview(pasteText);
  }, [pasteText]);

  useEffect(() => {
    if (step !== 3) return;

    setProgress(8);

    const timer = setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          clearInterval(timer);
          setTimeout(() => setStep(4), 450);
          return 100;
        }

        return Math.min(current + 9, 100);
      });
    }, 360);

    return () => clearInterval(timer);
  }, [step]);

  const completedTasks = Math.min(
    analysisTasks.length,
    Math.floor(progress / 22)
  );

  function goNext() {
    if (step === 2) {
      setStep(3);
      return;
    }

    setStep((current) => Math.min(current + 1, 5));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050814] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 top-0 h-[680px] w-[420px] rounded-full bg-cyan-500/25 blur-[120px]" />
        <div className="absolute -right-36 top-12 h-[720px] w-[460px] rounded-full bg-pink-500/25 blur-[130px]" />
        <div className="absolute bottom-[-240px] left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.11)_1px,transparent_0)] bg-[length:34px_34px] opacity-20" />
      </div>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[540px]">
          <div className="relative rounded-[32px] border border-cyan-300/40 bg-[#090d1d]/95 p-[1px] shadow-[0_0_70px_rgba(34,211,238,0.28),0_0_90px_rgba(236,72,153,0.20)]">
            <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-r from-cyan-400/70 via-blue-500/20 to-pink-500/70 opacity-80 blur-sm" />

            <div className="relative overflow-hidden rounded-[31px] border border-white/10 bg-[#070b19]/95 px-6 py-7 sm:px-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.17),transparent_35%)]" />

              <div className="relative">
                <div className="mb-6 flex items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-pink-500 shadow-[0_0_28px_rgba(34,211,238,0.45)]">
                      <span className="text-lg font-black">$</span>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold tracking-tight">
                        CamCash
                      </p>
                      <p className="text-xs text-slate-400">
                        Creator analytics setup
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-7">
                  <div className="flex items-center justify-between">
                    {steps.map((item, index) => {
                      const isActive = item.id === step;
                      const isComplete = item.id < step;

                      return (
                        <div
                          key={item.id}
                          className="flex flex-1 items-center last:flex-none"
                        >
                          <div className="flex flex-col items-center gap-1.5">
                            <div
                              className={[
                                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black transition-all",
                                isComplete
                                  ? "border-cyan-300 bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.65)]"
                                  : "",
                                isActive
                                  ? "border-cyan-300 bg-cyan-400 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.75)]"
                                  : "",
                                !isActive && !isComplete
                                  ? "border-white/15 bg-white/5 text-slate-500"
                                  : "",
                              ].join(" ")}
                            >
                              {isComplete ? "✓" : item.id}
                            </div>
                            <span
                              className={[
                                "text-[10px] font-bold",
                                isActive || isComplete
                                  ? "text-cyan-300"
                                  : "text-slate-500",
                              ].join(" ")}
                            >
                              {item.label}
                            </span>
                          </div>

                          {index < steps.length - 1 && (
                            <div
                              className={[
                                "mx-2 h-px flex-1",
                                item.id < step
                                  ? "bg-cyan-300/80"
                                  : "bg-white/10",
                              ].join(" ")}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {step === 1 && (
                  <div>
                    <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                      Step 1 — Connect account
                    </p>
                    <h1 className="text-center text-3xl font-black tracking-tight sm:text-4xl">
                      Start tracking your streams
                    </h1>
                    <p className="mx-auto mt-3 max-w-[390px] text-center text-sm leading-6 text-slate-400">
                      Enter your platform details so CamCash can prepare your
                      first insights.
                    </p>

                    <div className="mt-7">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        I broadcast as
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        {platforms.map((item) => {
                          const isSelected = item.id === platform;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setPlatform(item.id)}
                              className={[
                                "rounded-2xl border px-3 py-3 text-sm font-black transition-all",
                                isSelected
                                  ? "border-cyan-300 bg-cyan-300/10 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                                  : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-white",
                              ].join(" ")}
                            >
                              <span className="block text-base">
                                {item.short}
                              </span>
                              <span className="mt-1 block text-[11px]">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-slate-400">
                          {selectedPlatform?.label} username
                        </span>
                        <input
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="your_username"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/80 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.10)]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-slate-400">
                          Stats API token optional
                        </span>
                        <input
                          value={apiToken}
                          onChange={(event) => setApiToken(event.target.value)}
                          placeholder="Paste your token here"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-pink-300/80 focus:shadow-[0_0_0_4px_rgba(236,72,153,0.10)]"
                        />
                      </label>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                          ?
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-white">
                            How to connect
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            You can enter a token now, or skip straight to
                            pasting your tip history on the next step.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={goNext}
                      className="mt-7 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500 px-5 py-4 text-sm font-black text-white shadow-[0_0_35px_rgba(34,211,238,0.35)] transition hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Continue to Tip Import →
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="mt-4 w-full text-center text-sm font-bold text-cyan-300 hover:text-cyan-200"
                    >
                      Skip for now
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                      Step 2 — Import data
                    </p>
                    <h1 className="text-center text-3xl font-black tracking-tight sm:text-4xl">
                      Paste your tip history
                    </h1>
                    <p className="mx-auto mt-3 max-w-[390px] text-center text-sm leading-6 text-slate-400">
                      Copy your earnings rows from {selectedPlatform?.label} and
                      paste them below. CamCash will clean and detect the data.
                    </p>

                    <div className="mt-7 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-cyan-200">
                            How to copy from {selectedPlatform?.label}
                          </p>
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
                            <li>• Go to reports or earnings.</li>
                            <li>• Select your date range.</li>
                            <li>• Highlight rows and copy.</li>
                          </ul>
                        </div>
                        <button
                          type="button"
                          className="rounded-xl border border-pink-400/40 bg-pink-400/10 px-3 py-2 text-xs font-black text-pink-200"
                        >
                          Open page ↗
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={pasteText}
                      onChange={(event) => setPasteText(event.target.value)}
                      placeholder={`Example:\n18.06.2026 14:32 userjames123 500 25.00\n18.06.2026 15:14 whale_king99 1000 50.00\n18.06.2026 15:45 regularfan 25 1.25`}
                      className="mt-4 min-h-[180px] w-full resize-none rounded-2xl border border-white/10 bg-[#050816] px-4 py-4 font-mono text-xs leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/80 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.10)]"
                    />

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-500">
                          Tips
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {compactNumber(preview.tipsDetected)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-500">
                          Fans
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {compactNumber(preview.fansDetected)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-500">
                          Est.
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {currency(preview.estimatedEarnings)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-7 flex gap-3">
                      <button
                        type="button"
                        onClick={goBack}
                        className="w-1/3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-slate-300"
                      >
                        ← Back
                      </button>

                      <button
                        type="button"
                        onClick={goNext}
                        className="w-2/3 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500 px-5 py-4 text-sm font-black text-white shadow-[0_0_35px_rgba(236,72,153,0.28)] transition hover:scale-[1.01] active:scale-[0.99]"
                      >
                        Preview Import →
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="mt-4 w-full text-center text-sm font-bold text-slate-500 hover:text-slate-300"
                    >
                      Track future tips instead
                    </button>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                      Step 3 — Analyzing
                    </p>
                    <h1 className="text-center text-3xl font-black tracking-tight sm:text-4xl">
                      Analyzing your data
                    </h1>
                    <p className="mx-auto mt-3 max-w-[390px] text-center text-sm leading-6 text-slate-400">
                      This usually takes about 30–60 seconds. CamCash is finding
                      the patterns that matter.
                    </p>

                    <div className="mt-8">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
                        <span>Crunching the good stuff...</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500 shadow-[0_0_24px_rgba(34,211,238,0.55)] transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      {analysisTasks.map((task, index) => {
                        const isComplete = index < completedTasks;
                        const isActive = index === completedTasks;

                        return (
                          <div
                            key={task}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={[
                                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black",
                                  isComplete
                                    ? "border-emerald-300 bg-emerald-300/15 text-emerald-300"
                                    : "",
                                  isActive
                                    ? "border-cyan-300 bg-cyan-300/10 text-cyan-300"
                                    : "",
                                  !isComplete && !isActive
                                    ? "border-white/10 bg-white/5 text-slate-500"
                                    : "",
                                ].join(" ")}
                              >
                                {isComplete ? "✓" : isActive ? "…" : "•"}
                              </div>
                              <span className="text-sm font-bold text-slate-200">
                                {task}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-500">
                              {isComplete
                                ? "Complete"
                                : isActive
                                ? "In progress"
                                : "Queued"}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        {
                          label: "Earnings",
                          value: currency(preview.estimatedEarnings || 2847),
                        },
                        {
                          label: "Fans",
                          value: compactNumber(preview.fansDetected || 487),
                        },
                        {
                          label: "Tips",
                          value: compactNumber(preview.tipsDetected || 1392),
                        },
                        {
                          label: "Best hours",
                          value: preview.bestWindow,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                        >
                          <p className="text-[10px] font-bold uppercase text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-1 text-base font-black text-white">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div>
                    <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                      Step 4 — First insights
                    </p>
                    <h1 className="text-center text-3xl font-black tracking-tight sm:text-4xl">
                      Your first insights are ready
                    </h1>
                    <p className="mx-auto mt-3 max-w-[390px] text-center text-sm leading-6 text-slate-400">
                      Here is a quick preview of what CamCash found from your
                      imported data.
                    </p>

                    <div className="mt-7 grid grid-cols-2 gap-3">
                      {[
                        {
                          label: "Tips imported",
                          value: compactNumber(preview.tipsDetected || 1392),
                          change: "+23% vs last 7 days",
                        },
                        {
                          label: "Unique fans",
                          value: compactNumber(preview.fansDetected || 487),
                          change: "+18% vs last 7 days",
                        },
                        {
                          label: "Est. earnings",
                          value: currency(preview.estimatedEarnings || 2847),
                          change: "+31% vs last 7 days",
                        },
                        {
                          label: "Best window",
                          value: preview.bestWindow,
                          change: "+2 winning hours",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-2 text-xl font-black text-white">
                            {item.value}
                          </p>
                          <p className="mt-1 text-xs font-bold text-emerald-300">
                            {item.change}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-pink-300/20 bg-pink-300/[0.05] p-4">
                      <p className="text-sm font-extrabold text-pink-200">
                        Top spender detected
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {preview.topSpender}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        This fan should be prioritized in your next re-engagement
                        plan.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={goNext}
                      className="mt-7 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500 px-5 py-4 text-sm font-black text-white shadow-[0_0_35px_rgba(34,211,238,0.35)] transition hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Finish setup →
                    </button>
                  </div>
                )}

                {step === 5 && (
                  <div className="text-center">
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                      Step 5 — You’re all set
                    </p>

                    <div className="mx-auto mt-3 flex h-32 w-32 items-center justify-center rounded-full border border-cyan-300/40 bg-gradient-to-br from-cyan-400/15 to-pink-500/15 shadow-[0_0_60px_rgba(34,211,238,0.45),0_0_60px_rgba(236,72,153,0.25)]">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 text-4xl font-black shadow-[0_0_40px_rgba(236,72,153,0.45)]">
                        ✓
                      </div>
                    </div>

                    <h1 className="mt-7 text-3xl font-black tracking-tight sm:text-4xl">
                      You’re all set
                    </h1>
                    <p className="mx-auto mt-3 max-w-[390px] text-sm leading-6 text-slate-400">
                      Your dashboard is ready. You can now see your best hours,
                      top fans, platform performance, and streaming insights.
                    </p>

                    <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
                      <p className="text-sm font-extrabold text-white">
                        Next best action
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Start with your best window, message your top spender,
                        and use Live Mode during your next stream.
                      </p>
                    </div>

                    <a
                      href="/dashboard"
                      className="mt-7 block w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500 px-5 py-4 text-sm font-black text-white shadow-[0_0_35px_rgba(34,211,238,0.35)] transition hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Go to dashboard →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-600">
            CamCash never posts, messages, or changes anything on your account.
          </p>
        </div>
      </section>
    </main>
  );
}
