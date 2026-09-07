'use client'

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Loader2, Plus, RefreshCw, Trash2, Save, FileDown } from "lucide-react";
import type {
  Audit, BusinessInput, Gbp, MatrixRow, OnPage, RankingRow,
} from "@/lib/audit-types";
import {
  ACTIONS, GBP_ROWS, ONPAGE_ROWS, buildActions, buildMatrix,
} from "@/lib/audit-types";

const STORE_KEY = "content-os-audits";

const uid = () => Math.random().toString(36).slice(2, 10);

function blankBusiness(isClient = false): BusinessInput {
  return { id: uid(), name: "", url: "", suburb: "", isClient };
}

function blankAudit(): Audit {
  return {
    id: uid(),
    slug: "",
    market: "",
    keywords: { primary: "", geo: "", secondary: [] },
    businesses: [blankBusiness(true), blankBusiness()],
    onpage: {},
    gbp: {},
    rankings: [],
    scanSettings: { grid: "13 x 13", radius: "20", centre: "", runAt: "" },
    collectedAt: "",
  };
}

function loadAudits(): Audit[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Audit[]) : [];
  } catch {
    return [];
  }
}

function saveAudits(list: Audit[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    // quota — the audit still lives in memory for this session
  }
}

const GRADE_CLASS: Record<string, string> = {
  good: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  warn: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  bad: "text-red-600 dark:text-red-400 bg-red-500/10 font-medium",
  "": "",
};

function Matrix({ matrix, businesses }: { matrix: MatrixRow[]; businesses: BusinessInput[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="bg-foreground text-background">
            <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold">Metric</th>
            {businesses.map((b) => (
              <th
                key={b.id}
                className={cn(
                  "text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold",
                  b.isClient && "bg-primary text-primary-foreground"
                )}
              >
                {b.name || "—"}
                {b.isClient && <span className="block text-[9px] opacity-80">CLIENT</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <th scope="row" className="text-left px-3 py-2 font-medium bg-muted/40 w-[230px] align-top">
                {row.label}
              </th>
              {row.cells.map(([value, grade], i) => (
                <td
                  key={businesses[i]?.id ?? i}
                  className={cn("px-3 py-2 align-top max-w-[320px] break-words", GRADE_CLASS[grade])}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditClient() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [audit, setAudit] = useState<Audit>(blankAudit);
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const list = loadAudits();
    setAudits(list);
    if (list.length) setAudit(list[0]);
    setMounted(true);
  }, []);

  const patch = useCallback((p: Partial<Audit>) => setAudit((a) => ({ ...a, ...p })), []);

  const setBusiness = (id: string, p: Partial<BusinessInput>) =>
    setAudit((a) => ({
      ...a,
      businesses: a.businesses.map((b) => (b.id === id ? { ...b, ...p } : b)),
    }));

  const makeClient = (id: string) =>
    setAudit((a) => ({
      ...a,
      businesses: a.businesses.map((b) => ({ ...b, isClient: b.id === id })),
    }));

  const addBusiness = () =>
    setAudit((a) => ({ ...a, businesses: [...a.businesses, blankBusiness()] }));

  const removeBusiness = (id: string) =>
    setAudit((a) => {
      const next = a.businesses.filter((b) => b.id !== id);
      if (next.length && !next.some((b) => b.isClient)) next[0] = { ...next[0], isClient: true };
      return { ...a, businesses: next };
    });

  const persist = useCallback((a: Audit) => {
    setAudits((prev) => {
      const next = [a, ...prev.filter((x) => x.id !== a.id)];
      saveAudits(next);
      return next;
    });
  }, []);

  async function run() {
    const ready = audit.businesses.filter((b) => b.name.trim() && b.url.trim());
    if (!ready.length) {
      setStatusMsg("Add at least one business with a name and URL");
      return;
    }

    setRunning(true);
    setStatusMsg("Fetching sites…");

    let onpage: Record<string, OnPage> = {};
    try {
      const res = await fetch("/api/audit/onpage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businesses: ready.map((b) => ({ id: b.id, url: b.url })),
          keywords: audit.keywords,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "on-page failed");
      onpage = data.onpage;
    } catch (e) {
      setStatusMsg(`On-page error: ${e instanceof Error ? e.message : String(e)}`);
      setRunning(false);
      return;
    }

    setStatusMsg("Sites done. Looking up Google Business Profiles…");

    const queries = ready.map((b) => `${b.name} ${b.suburb}`.trim());
    const gbp: Record<string, Gbp> = {};
    try {
      const start = await fetch("/api/audit/gbp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
      });
      const startData = await start.json();
      if (!start.ok) throw new Error(startData.error ?? "GBP start failed");

      const runId = startData.runId as string;
      const qs = encodeURIComponent(queries.join("|"));
      // Apify places runs settle in roughly 30-90s; poll for up to 4 minutes.
      for (let i = 0; i < 48; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const st = await fetch(`/api/audit/gbp/status?runId=${runId}&queries=${qs}`);
        const stData = await st.json();
        if (stData.done) {
          for (let j = 0; j < ready.length; j++) {
            const g = stData.gbp?.[queries[j]];
            if (g) gbp[ready[j].id] = g;
          }
          break;
        }
        if (stData.failed) throw new Error(`Apify run ${stData.status}`);
        setStatusMsg(`Google Business Profiles… (${(i + 1) * 5}s)`);
      }
    } catch (e) {
      setStatusMsg(`GBP skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    const done: Audit = {
      ...audit,
      businesses: ready,
      onpage,
      gbp,
      collectedAt: new Date().toISOString(),
      rankings: audit.rankings.length
        ? audit.rankings
        : [{ keyword: `${audit.keywords.primary} ${audit.keywords.geo}`.trim(), byBusiness: {} }],
    };
    setAudit(done);
    persist(done);
    setRunning(false);
    setStatusMsg(
      Object.keys(gbp).length
        ? `Done — ${ready.length} sites, ${Object.keys(gbp).length} profiles`
        : `Done — ${ready.length} sites, no GBP data`
    );
  }

  const businesses = audit.businesses;
  const onpageMatrix = useMemo(
    () => buildMatrix(ONPAGE_ROWS, businesses, audit.onpage),
    [businesses, audit.onpage]
  );
  const gbpMatrix = useMemo(
    () => buildMatrix(GBP_ROWS, businesses, audit.gbp),
    [businesses, audit.gbp]
  );
  const actions = useMemo(
    () =>
      buildActions(
        [
          { matrix: gbpMatrix, area: "GBP" },
          { matrix: onpageMatrix, area: "Website" },
        ],
        businesses
      ),
    [gbpMatrix, onpageMatrix, businesses]
  );

  const hasData = Object.keys(audit.onpage).length > 0;

  function setRanking(rowIdx: number, bizId: string, key: keyof Audit["rankings"][0]["byBusiness"][string], v: string) {
    setAudit((a) => {
      const rankings = a.rankings.map((r, i) => {
        if (i !== rowIdx) return r;
        const cell = r.byBusiness[bizId] ?? { arp: null, atrp: null, solv: null };
        return {
          ...r,
          byBusiness: { ...r.byBusiness, [bizId]: { ...cell, [key]: v === "" ? null : Number(v) } },
        };
      });
      return { ...a, rankings };
    });
  }

  const addKeywordRow = () =>
    setAudit((a) => ({ ...a, rankings: [...a.rankings, { keyword: "", byBusiness: {} }] }));

  if (!mounted) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Setup */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Market</label>
              <Input
                placeholder="Electrical — Noosa QLD"
                value={audit.market}
                onChange={(e) => patch({ market: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Primary keyword</label>
              <Input
                placeholder="electrician"
                value={audit.keywords.primary}
                onChange={(e) => patch({ keywords: { ...audit.keywords, primary: e.target.value } })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Geo keyword</label>
              <Input
                placeholder="noosa"
                value={audit.keywords.geo}
                onChange={(e) => patch({ keywords: { ...audit.keywords, geo: e.target.value } })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Secondary (comma separated)</label>
              <Input
                placeholder="switchboard, emergency electrician"
                value={audit.keywords.secondary.join(", ")}
                onChange={(e) =>
                  patch({
                    keywords: {
                      ...audit.keywords,
                      secondary: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">
                Businesses — select the radio for the client
              </label>
              <Button variant="outline" size="sm" onClick={addBusiness} className="border-border">
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </div>
            {businesses.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="client"
                  checked={b.isClient}
                  onChange={() => makeClient(b.id)}
                  className="accent-primary shrink-0"
                  aria-label={`Mark ${b.name || "business"} as client`}
                />
                <Input
                  placeholder="Business name"
                  value={b.name}
                  onChange={(e) => setBusiness(b.id, { name: e.target.value })}
                  className="flex-1 min-w-0"
                />
                <Input
                  placeholder="https://…"
                  value={b.url}
                  onChange={(e) => setBusiness(b.id, { url: e.target.value })}
                  className="flex-1 min-w-0"
                />
                <Input
                  placeholder="Suburb, STATE"
                  value={b.suburb}
                  onChange={(e) => setBusiness(b.id, { suburb: e.target.value })}
                  className="w-44 shrink-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeBusiness(b.id)}
                  disabled={businesses.length <= 1}
                  aria-label="Remove business"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={running}>
              {running ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RefreshCw size={14} className="mr-2" />}
              {running ? "Running…" : "Run audit"}
            </Button>
            <Button variant="outline" className="border-border" onClick={() => persist(audit)} disabled={!hasData}>
              <Save size={14} className="mr-2" /> Save
            </Button>
            <Button
              variant="outline"
              className="border-border"
              onClick={() => { setAudit(blankAudit()); setStatusMsg(null); }}
            >
              New
            </Button>
            {statusMsg && <span className="text-xs text-muted-foreground">{statusMsg}</span>}
          </div>

          {audits.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {audits.slice(0, 8).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAudit(a)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border border-border hover:border-primary/50",
                    a.id === audit.id && "border-primary text-primary"
                  )}
                >
                  {a.market || "untitled"}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">
          Fill in the businesses above and hit Run audit. Sites take about 10 seconds; Google
          Business Profiles take up to a couple of minutes.
        </p>
      ) : (
        <Tabs defaultValue="gbp">
          <TabsList className="mb-4">
            <TabsTrigger value="gbp">GBP Profile</TabsTrigger>
            <TabsTrigger value="onpage">Website On-Page</TabsTrigger>
            <TabsTrigger value="rankings">Metric Rankings</TabsTrigger>
            <TabsTrigger value="actions">Action Items</TabsTrigger>
          </TabsList>

          <TabsContent value="gbp" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              The map pack shows three results before &quot;More places&quot; — position four is
              functionally position forty.
            </p>
            <Matrix matrix={gbpMatrix} businesses={businesses} />
          </TabsContent>

          <TabsContent value="onpage" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              What each site serves to a crawler. Rendering, schema and sitemap sit at the top
              because they gate everything below them.
            </p>
            <Matrix matrix={onpageMatrix} businesses={businesses} />
          </TabsContent>

          <TabsContent value="rankings" className="space-y-3">
            <div className="rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs">
              <b>Reproduce the scan settings exactly across every business, or the comparison is
              void.</b>{" "}
              Grid, radius, centre coordinate and platform must match. A grid change alone moves
              ATRP by more than most optimisation work does.
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <Input
                placeholder="Grid (13 x 13)"
                value={audit.scanSettings.grid}
                onChange={(e) => patch({ scanSettings: { ...audit.scanSettings, grid: e.target.value } })}
              />
              <Input
                placeholder="Radius (mi)"
                value={audit.scanSettings.radius}
                onChange={(e) => patch({ scanSettings: { ...audit.scanSettings, radius: e.target.value } })}
              />
              <Input
                placeholder="Centre coordinate"
                value={audit.scanSettings.centre}
                onChange={(e) => patch({ scanSettings: { ...audit.scanSettings, centre: e.target.value } })}
              />
              <Input
                placeholder="Run at"
                value={audit.scanSettings.runAt}
                onChange={(e) => patch({ scanSettings: { ...audit.scanSettings, runAt: e.target.value } })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <b>ARP</b> average rank where you appeared · <b>ATRP</b> average across every point,
              absences counted as 20+ · <b>SoLV</b> share of points in the top 3. The ARP-to-ATRP gap
              is the most useful number and no tool prints it.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-foreground text-background">
                    <th rowSpan={2} className="text-left px-3 py-2 text-[11px] uppercase tracking-wider">Keyword</th>
                    {businesses.map((b) => (
                      <th
                        key={b.id}
                        colSpan={3}
                        className={cn("text-left px-3 py-2 text-[11px] uppercase tracking-wider", b.isClient && "bg-primary text-primary-foreground")}
                      >
                        {b.name || "—"}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-foreground text-background">
                    {businesses.flatMap((b) =>
                      (["ARP", "ATRP", "SoLV"] as const).map((h) => (
                        <th key={`${b.id}-${h}`} className="text-left px-3 py-1.5 text-[10px] font-medium">{h}</th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {audit.rankings.map((row, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <th scope="row" className="text-left px-2 py-1.5 bg-muted/40">
                        <Input
                          value={row.keyword}
                          placeholder="keyword"
                          onChange={(e) =>
                            setAudit((a) => ({
                              ...a,
                              rankings: a.rankings.map((r, i) => (i === idx ? { ...r, keyword: e.target.value } : r)),
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </th>
                      {businesses.flatMap((b) =>
                        (["arp", "atrp", "solv"] as const).map((k) => (
                          <td key={`${b.id}-${k}`} className={cn("px-1.5 py-1.5", b.isClient && "bg-primary/5")}>
                            <Input
                              inputMode="decimal"
                              value={row.byBusiness[b.id]?.[k] ?? ""}
                              onChange={(e) => setRanking(idx, b.id, k, e.target.value)}
                              className="h-8 w-16 text-sm"
                            />
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-border" onClick={addKeywordRow}>
                <Plus size={14} className="mr-1" /> Keyword
              </Button>
              <Button variant="outline" size="sm" className="border-border" onClick={() => persist(audit)}>
                <Save size={14} className="mr-1" /> Save rankings
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-3">
            {actions.length === 0 ? (
              <div className="rounded-lg border-l-2 border-emerald-500 bg-emerald-500/5 px-3 py-2 text-sm">
                <b>No failing checks for the client.</b> Every graded row passed — pitch optimisation
                and rankings, not a rebuild.
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Every row is a graded failure on the client. The last column counts competitors who
                  pass the same check — that number, not the metric, is what makes a finding urgent.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="bg-foreground text-background">
                        {["Priority", "Area", "Finding", "What it costs", "Current value", "Competitors passing"].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-[11px] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((a, i) => (
                        <tr key={`${a.finding}-${i}`} className="border-t border-border align-top">
                          <td className={cn("px-3 py-2 font-semibold", a.priority === "P1" ? "text-red-500" : a.priority === "P2" ? "text-amber-500" : "text-muted-foreground")}>
                            {a.priority}
                          </td>
                          <td className="px-3 py-2">{a.area}</td>
                          <td className="px-3 py-2 font-medium">{a.finding}</td>
                          <td className="px-3 py-2 text-muted-foreground">{a.cost}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[280px] break-words">{a.value}</td>
                          <td className={cn("px-3 py-2", a.beaten > 0 && "text-red-500 font-medium")}>
                            {a.beaten} of {a.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {hasData && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <FileDown size={12} />
          Collected {new Date(audit.collectedAt).toLocaleString()} · saved in this browser · print this
          page for a PDF
        </p>
      )}
    </div>
  );
}
