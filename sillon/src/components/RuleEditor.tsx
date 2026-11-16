// Éditeur de règles combinables (playlists intelligentes et recherche avancée).
import { Plus, X } from "lucide-react";
import type { RuleSet } from "../lib/api";
import { FIELDS, OPS, SORTS } from "../lib/smart";
import { IconButton, Segmented } from "./ui";

const selectCls = "h-8 rounded-[8px] bg-fill px-2 text-[13px] outline-none focus:ring-2 focus:ring-accent/60";

export function RuleEditor({ value, onChange, compact }: { value: RuleSet; onChange: (v: RuleSet) => void; compact?: boolean }) {
  const setRule = (i: number, patch: Partial<RuleSet["rules"][number]>) =>
    onChange({ ...value, rules: value.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span>Garder les morceaux qui respectent</span>
        <Segmented
          id="rule-match"
          value={value.match}
          onChange={(match) => onChange({ ...value, match })}
          options={[
            { value: "all", label: "toutes les règles" },
            { value: "any", label: "au moins une" },
          ]}
        />
      </div>
      {value.rules.map((r, i) => {
        const def = FIELDS.find((f) => f.id === r.field) ?? FIELDS[0];
        const ops = OPS[def.type];
        const noValue = def.type === "bool" || r.op === "never";
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Critère"
              className={selectCls}
              value={def.id}
              onChange={(e) => {
                const next = FIELDS.find((f) => f.id === e.target.value)!;
                setRule(i, { field: next.id, op: OPS[next.type][0].id, value: "" });
              }}
            >
              {FIELDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select aria-label="Condition" className={selectCls} value={ops.some((o) => o.id === r.op) ? r.op : ops[0].id} onChange={(e) => setRule(i, { op: e.target.value })}>
              {ops.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {!noValue &&
              (def.type === "choice" ? (
                <select aria-label="Valeur" className={selectCls} value={r.value} onChange={(e) => setRule(i, { value: e.target.value })}>
                  <option value="">Choisir…</option>
                  {def.choices!.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <span className="flex items-center gap-1.5">
                  <input
                    aria-label="Valeur"
                    value={r.value}
                    inputMode={def.type === "text" ? undefined : "decimal"}
                    onChange={(e) => setRule(i, { value: e.target.value })}
                    className="h-8 w-[150px] rounded-[8px] bg-fill px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-accent/60"
                  />
                  {def.unit && <span className="text-[12px] text-ink-3">{def.unit}</span>}
                </span>
              ))}
            <IconButton label="Retirer cette règle" size={26} onClick={() => onChange({ ...value, rules: value.rules.filter((_, j) => j !== i) })}>
              <X size={14} />
            </IconButton>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onChange({ ...value, rules: [...value.rules, { field: "genre", op: "contains", value: "" }] })}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] font-medium text-accent hover:bg-fill"
        >
          <Plus size={14} /> Ajouter une règle
        </button>
        {!compact && (
          <>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Tri
              <select className={selectCls} value={value.sort} onChange={(e) => onChange({ ...value, sort: e.target.value })}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Limiter à
              <input
                aria-label="Nombre maximal de morceaux (0 = sans limite)"
                value={value.limit || ""}
                placeholder="∞"
                inputMode="numeric"
                onChange={(e) => onChange({ ...value, limit: Math.max(0, Number(e.target.value) || 0) })}
                className="h-8 w-[64px] rounded-[8px] bg-fill px-2 text-center text-[13px] outline-none focus:ring-2 focus:ring-accent/60"
              />
              titres
            </label>
          </>
        )}
      </div>
    </div>
  );
}
