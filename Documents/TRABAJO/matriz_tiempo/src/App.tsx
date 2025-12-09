import React, { useEffect, useMemo, useState } from "react";

/* ===============================
   Parámetros del día laboral
================================== */
const DAY_START = { h: 7, m: 30 }; // 07:30
const DAY_END = { h: 18, m: 0 }; // 18:00
const SLOT_MINUTES = 30;

/* Derivados */
const START_MIN = DAY_START.h * 60 + DAY_START.m;
const END_MIN = DAY_END.h * 60 + DAY_END.m;
const TOTAL_SLOTS = (END_MIN - START_MIN) / SLOT_MINUTES;
const TICKS = Array.from(
  { length: TOTAL_SLOTS + 1 },
  (_, i) => START_MIN + i * SLOT_MINUTES
);

/* Estilos por tipo */
type Kind = "SER" | "PRY" | "IDL";
type BlockStyle = { bg: string; text: string; border: string };
const TYPE_STYLES: Record<Kind, BlockStyle> = {
  SER: { bg: "#2ec27e", text: "#0f1115", border: "#0a7a50" },
  PRY: { bg: "#ff8a00", text: "#0f1115", border: "#c06600" },
  IDL: { bg: "#7e8692", text: "#151922", border: "#575e66" },
};

/* ===============================
   Utilidades
================================== */
const pad2 = (n: number) => (n < 10 ? "0" + n : String(n));

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + m;
};

const fmt = (min: number) =>
  `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

const clampToDay = (min: number) =>
  Math.max(START_MIN, Math.min(END_MIN, min));

const slotIndex = (min: number) =>
  Math.floor((clampToDay(min) - START_MIN) / SLOT_MINUTES);

const uid = () =>
  Math.random().toString(36).slice(2, 8) +
  "-" +
  Math.random().toString(36).slice(2, 6);

/* ===============================
   Tipos y datos
================================== */
type Entry = {
  id: string;
  tech: string;
  kind: Kind;
  project?: string;
  place?: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  notes?: string;
  day: string; // "YYYY-MM-DD"
};

/* Storage clave */
const LS_KEY = "matriz-tiempo-entries";

/* ===============================
   Time header (regla de horas)
================================== */
function TimeHeader() {
  return (
    <div
      className="timeline"
      style={{ gridTemplateColumns: `repeat(${TOTAL_SLOTS}, 1fr)` }}
    >
      {TICKS.map((t, i) => {
        const show = t % 60 === 0 || i === 0 || i === TICKS.length - 1;
        return (
          <div key={t} className={`tick ${show ? "tick-lg" : ""}`}>
            {show && <span className="tick-label">{fmt(t)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ===============================
   Fila por técnico (matriz diaria)
================================== */
function TechRow({
  tech,
  entries,
  onEdit,
  onDelete,
}: {
  tech: string;
  entries: Entry[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const start = START_MIN;
  const end = END_MIN;

  return (
    <div className="tech-row">
      <div className="tech-title">{tech}</div>

      <div
        className="time-grid"
        style={{ gridTemplateColumns: `repeat(${TOTAL_SLOTS}, 1fr)` }}
      >
        {/* Slots de fondo */}
        {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
          <div key={i} className="slot" />
        ))}

        {/* Bloques de actividad */}
        {entries.map((e) => {
          const iStart = slotIndex(toMinutes(e.start));
          const iEnd = slotIndex(toMinutes(e.end));
          const style = TYPE_STYLES[e.kind];

          if (toMinutes(e.end) <= start || toMinutes(e.start) >= end)
            return null;

          return (
            <div
              key={e.id}
              className="entry"
              style={{
                gridColumn: `${iStart + 1} / ${iEnd + 1}`,
                background: style.bg,
                color: style.text,
                borderColor: style.border,
              }}
              title={`${e.kind} ${e.project ?? ""} ${
                e.place ?? ""
              } (${e.start}–${e.end})`}
            >
              <strong style={{ marginRight: 6 }}>{e.kind}</strong>
              {e.project ? `${e.project}` : "—"}{" "}
              {e.place ? `· ${e.place}` : ""}
              <span style={{ opacity: 0.7, marginLeft: 6 }}>
                ({e.start}–{e.end})
              </span>

              <div className="entry-actions">
                <button
                  className="chip"
                  onClick={() => onEdit(e.id)}
                  title="Editar"
                >
                  ✎
                </button>
                <button
                  className="chip"
                  onClick={() => onDelete(e.id)}
                  title="Borrar"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===============================
   MATRIZ MENSUAL (verde / rojo)
================================== */

type MonthMatrixProps = {
  entries: Entry[];
  referenceDay: string; // "YYYY-MM-DD"
};

function MonthMatrix({ entries, referenceDay }: MonthMatrixProps) {
  if (!referenceDay) return null;

  const [yearStr, monthStr] = referenceDay.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1–12
  const monthKey = `${yearStr}-${monthStr}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthEntries = useMemo(
    () => entries.filter((e) => e.day.startsWith(monthKey)),
    [entries, monthKey]
  );

  const techs = useMemo(
    () => Array.from(new Set(monthEntries.map((e) => e.tech))).sort(),
    [monthEntries]
  );

  const hasOS = (tech: string, dayNumber: number) => {
    const dateStr = `${year}-${pad2(month)}-${pad2(dayNumber)}`;
    return monthEntries.some(
      (e) =>
        e.tech === tech &&
        e.day === dateStr &&
        (e.kind === "SER" || e.kind === "PRY")
    );
  };

  if (techs.length === 0) {
    return (
      <div className="card monthly-card">
        <h2 className="section-title">
          Resumen mensual de OS (sin datos)
        </h2>
        <p className="hint">
          No hay registros en este mes para la fecha seleccionada.
        </p>
      </div>
    );
  }

  return (
    <div className="card monthly-card">
      <h2 className="section-title">
        Resumen mensual de OS – {pad2(month)}/{year}
      </h2>
      <div className="monthly-table-wrapper">
        <table className="monthly-table">
          <thead>
            <tr>
              <th>Empleado</th>
              {Array.from({ length: daysInMonth }).map((_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {techs.map((tech) => (
              <tr key={tech}>
                <td className="emp-cell">{tech}</td>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNumber = i + 1;
                  const ok = hasOS(tech, dayNumber);
                  return (
                    <td
                      key={i}
                      className={`day-cell ${ok ? "ok" : "no-ok"}`}
                      title={
                        ok
                          ? "Tiene OS (SER/PRY) este día"
                          : "Sin OS este día"
                      }
                    >
                      {ok ? "✓" : "✗"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="monthly-legend">
        <span>
          <span className="legend-box ok" /> Día con OS (SER / PRY)
        </span>
        <span>
          <span className="legend-box no-ok" /> Día sin OS
        </span>
      </div>
    </div>
  );
}

/* ===============================
   TABLA DETALLADA DE OS DEL MES
================================== */

function MonthEntriesTable({
  entries,
  referenceDay,
}: {
  entries: Entry[];
  referenceDay: string;
}) {
  if (!referenceDay) return null;

  const monthKey = referenceDay.slice(0, 7); // "YYYY-MM"

  const monthEntries = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            e.day.startsWith(monthKey) && e.kind !== "IDL" // solo OS
        )
        .sort((a, b) => {
          if (a.day === b.day) {
            return toMinutes(a.start) - toMinutes(b.start);
          }
          return a.day.localeCompare(b.day);
        }),
    [entries, monthKey]
  );

  if (monthEntries.length === 0) {
    return null;
  }

  return (
    <div className="card monthly-list-card">
      <h2 className="section-title">
        Detalle de OS del mes ({monthKey})
      </h2>
      <div className="table-scroll">
        <table className="os-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empleado</th>
              <th>Tipo</th>
              <th>Proyecto / Servicio</th>
              <th>Lugar</th>
              <th>Inicio</th>
              <th>Fin</th>
            </tr>
          </thead>
          <tbody>
            {monthEntries.map((e) => (
              <tr key={e.id}>
                <td>{e.day}</td>
                <td>{e.tech}</td>
                <td>{e.kind}</td>
                <td>{e.project || "—"}</td>
                <td>{e.place || "—"}</td>
                <td>{e.start}</td>
                <td>{e.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===============================
   App principal
================================== */
export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [day, setDay] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [typeFilter, setTypeFilter] = useState<"ALL" | Kind>("ALL");
  const [q, setQ] = useState("");

  // cargar/guardar en localStorage
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw) as Entry[];
        setEntries(arr);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  }, [entries]);

  // agrupado por técnico para el día seleccionado y filtros
  const byTech = useMemo(() => {
    const filtered = entries
      .filter((e) => e.day === day)
      .filter((e) => (typeFilter === "ALL" ? true : e.kind === typeFilter))
      .filter((e) => {
        const s = `${e.tech} ${e.project ?? ""} ${e.place ?? ""}`.toLowerCase();
        return s.includes(q.toLowerCase());
      })
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    const map = new Map<string, Entry[]>();
    for (const e of filtered) {
      if (!map.has(e.tech)) map.set(e.tech, []);
      map.get(e.tech)!.push(e);
    }
    return Array.from(map.entries()).map(([tech, list]) => ({ tech, list }));
  }, [entries, day, typeFilter, q]);

  /* ========== acciones CRUD ========== */

  const handleNew = () => {
    const tech = prompt("Técnico (ej. DANIEL RAMIREZ):", "");
    if (!tech) return;

    const kind = (prompt("Tipo (SER/PRY/IDL):", "PRY") || "PRY") as Kind;
    const project = prompt("Proyecto/Servicio:", "") || "";
    const place = prompt("Lugar:", "") || "";
    const start = prompt("Inicio HH:MM (24h):", "08:30") || "08:30";
    const end = prompt("Fin HH:MM (24h):", "12:30") || "12:30";

    if (toMinutes(end) <= toMinutes(start)) {
      alert("El fin debe ser mayor que el inicio.");
      return;
    }

    setEntries((prev) => [
      ...prev,
      {
        id: uid(),
        tech,
        kind,
        project,
        place,
        start,
        end,
        day,
      },
    ]);
  };

  const handleEdit = (id: string) => {
    const e = entries.find((x) => x.id === id);
    if (!e) return;

    const start = prompt("Nuevo inicio HH:MM", e.start) || e.start;
    const end = prompt("Nuevo fin HH:MM", e.end) || e.end;
    const project =
      prompt("Proyecto/Servicio", e.project || "") || e.project || "";
    const place = prompt("Lugar", e.place || "") || e.place || "";
    const kind = (prompt("Tipo (SER/PRY/IDL)", e.kind) || e.kind) as Kind;

    if (toMinutes(end) <= toMinutes(start)) {
      alert("El fin debe ser mayor que el inicio.");
      return;
    }

    setEntries((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              start,
              end,
              project,
              place,
              kind,
            }
          : x
      )
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    setEntries((arr) => arr.filter((x) => x.id !== id));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matriz-tiempo-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file?: File) => {
    if (!file) {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "application/json";
      inp.onchange = () => {
        const f = (inp.files && inp.files[0]) || undefined;
        if (f) importJson(f);
      };
      inp.click();
      return;
    }
    const text = await file.text();
    try {
      const arr = JSON.parse(text) as Entry[];
      setEntries(arr);
      alert("Importado correctamente.");
    } catch (err) {
      alert("Archivo inválido.");
    }
  };

  const clearAll = () => {
    if (!confirm("¿Vaciar TODOS los registros?")) return;
    setEntries([]);
  };

  return (
    <div className="container">
      <h1 className="app-title">Matriz de tiempo de técnicos</h1>
      <p className="app-sub">
        Jornada: {fmt(START_MIN)} – {fmt(END_MIN)} (bloques de {SLOT_MINUTES}{" "}
        min)
      </p>

      {/* Toolbar */}
      <div className="toolbar">
        <label className="label">
          Fecha
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>

        <label className="label">
          Filtrar tipo
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "ALL" | Kind)
            }
          >
            <option value="ALL">Todos</option>
            <option value="SER">Servicio</option>
            <option value="PRY">Proyecto</option>
            <option value="IDL">Sin actividad</option>
          </select>
        </label>

        <label className="label">
          Buscar (técnico / proyecto / lugar)
          <input
            type="text"
            value={q}
            placeholder="ej. NEMAK, SKF, Monterrey…"
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        <div className="actions">
          <button className="btn primary" onClick={handleNew}>
            Nuevo registro
          </button>
          <button className="btn" onClick={exportJson}>
            Exportar JSON
          </button>
          <button className="btn" onClick={() => importJson()}>
            Importar JSON
          </button>
          <button className="btn warn" onClick={clearAll}>
            Vaciar
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="row legend" style={{ margin: "14px 0 8px" }}>
        <span>
          <i className="dot ser" /> Servicio
        </span>
        <span>
          <i className="dot pry" /> Proyecto
        </span>
        <span>
          <i className="dot idl" /> Sin actividad
        </span>
      </div>

      {/* Regla de horas */}
      <TimeHeader />

      {/* Banda superior grilla vacía */}
      <div
        className="card time-grid"
        style={{ gridTemplateColumns: `repeat(${TOTAL_SLOTS}, 1fr)` }}
      >
        {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
          <div key={i} className="slot" />
        ))}
      </div>

      {/* Filas por técnico (día) */}
      {byTech.length === 0 ? (
        <p className="hint" style={{ marginTop: 16 }}>
          No hay registros para esta fecha. Crea uno con “Nuevo registro”.
        </p>
      ) : (
        byTech.map(({ tech, list }) => (
          <TechRow
            key={tech}
            tech={tech}
            entries={list}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))
      )}

      <p className="hint" style={{ marginTop: 16 }}>
        Sugerencia: captura también bloques “IDL” para dejar explícitos
        periodos sin actividad.
      </p>

      {/* MATRIZ MENSUAL VERDE / ROJO */}
      <MonthMatrix entries={entries} referenceDay={day} />

      {/* TABLA DETALLADA DE OS DEL MES */}
      <MonthEntriesTable entries={entries} referenceDay={day} />
    </div>
  );
}
