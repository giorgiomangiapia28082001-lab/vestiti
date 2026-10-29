"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { ChipGroup } from "@/components/ui/chip";
import { ColorDot } from "@/components/ui/color-dot";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  CATEGORIES,
  COLORS,
  FITS,
  FORMALITY_LABELS,
  PATTERNS,
  SEASONS,
  SLOTS,
  STYLES,
  categoryInfo,
  type Category,
  type ColorName,
} from "@/lib/domain";
import type { ClothingItemInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type ItemFormValues = Required<
  Omit<ClothingItemInput, "subcategory" | "material" | "brand" | "notes" | "fit">
> & {
  subcategory: string;
  material: string;
  brand: string;
  notes: string;
  fit: ClothingItemInput["fit"];
};

export function emptyItemValues(): ItemFormValues {
  return {
    name: "",
    category: "tshirt_polo",
    subcategory: "",
    slot: "top",
    primary_color: "black",
    secondary_colors: [],
    material: "",
    pattern: "solid",
    seasons: [],
    styles: [],
    fit: null,
    formality: 2,
    brand: "",
    tags: [],
    notes: "",
    ai_analyzed: false,
  };
}

export function toFormValues(input: Partial<ClothingItemInput>): ItemFormValues {
  const base = emptyItemValues();
  return {
    ...base,
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    subcategory: input.subcategory ?? "",
    material: input.material ?? "",
    brand: input.brand ?? "",
    notes: input.notes ?? "",
    fit: input.fit ?? null,
  } as ItemFormValues;
}

function ColorPicker({
  value,
  onChange,
  multiple,
  exclude,
}: {
  value: ColorName[];
  onChange: (v: ColorName[]) => void;
  multiple?: boolean;
  exclude?: ColorName;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.filter((c) => c.value !== exclude).map((c) => {
        const selected = value.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={selected}
            title={c.label}
            onClick={() => {
              if (multiple) onChange(selected ? value.filter((v) => v !== c.value) : [...value, c.value].slice(0, 4));
              else onChange([c.value]);
            }}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[12.5px] font-medium transition-all",
              selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-soft hover:border-sand",
            )}
          >
            <ColorDot color={c.value} className="size-6" />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function ItemForm({
  values,
  onChange,
  errors = {},
}: {
  values: ItemFormValues;
  onChange: (v: ItemFormValues) => void;
  errors?: Partial<Record<keyof ItemFormValues, string>>;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const set = <K extends keyof ItemFormValues>(k: K, v: ItemFormValues[K]) => onChange({ ...values, [k]: v });
  const flexibleSlot = values.category === "sportswear" || values.category === "other";

  function addTag() {
    const t = tagDraft.trim().toLowerCase().slice(0, 30);
    if (t && !values.tags.includes(t) && values.tags.length < 20) set("tags", [...values.tags, t]);
    setTagDraft("");
  }

  return (
    <div className="space-y-7">
      <Field label="Nome del capo" htmlFor="name" error={errors.name}>
        <Input
          id="name"
          value={values.name}
          maxLength={80}
          placeholder="Es. Camicia oxford azzurra"
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>

      <Field label="Categoria">
        <ChipGroup
          label="Categoria"
          multiple={false}
          options={CATEGORIES}
          value={[values.category]}
          onChange={(v) => {
            const category = (v[0] ?? values.category) as Category;
            const info = categoryInfo(category);
            onChange({
              ...values,
              category,
              slot: category === "sportswear" || category === "other" ? values.slot : info.slot,
              formality: values.ai_analyzed ? values.formality : info.formality,
            });
          }}
          size="sm"
        />
      </Field>

      {flexibleSlot ? (
        <Field label="Dove si indossa?" hint="Serve allo stylist per comporre l'outfit.">
          <ChipGroup
            label="Posizione"
            multiple={false}
            options={SLOTS}
            value={[values.slot]}
            onChange={(v) => v[0] && set("slot", v[0])}
            size="sm"
          />
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tipologia" htmlFor="subcategory" hint="Es. chino, cardigan, mocassini">
          <Input id="subcategory" value={values.subcategory} maxLength={60} onChange={(e) => set("subcategory", e.target.value)} />
        </Field>
        <Field label="Brand" htmlFor="brand">
          <Input id="brand" value={values.brand} maxLength={60} onChange={(e) => set("brand", e.target.value)} />
        </Field>
      </div>

      <Field label="Colore principale">
        <ColorPicker value={[values.primary_color]} onChange={(v) => set("primary_color", v[0])} />
      </Field>

      <Field label="Colori secondari" hint="Fino a 4, facoltativi.">
        <ColorPicker
          multiple
          exclude={values.primary_color}
          value={values.secondary_colors}
          onChange={(v) => set("secondary_colors", v)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Fantasia" htmlFor="pattern">
          <Select id="pattern" value={values.pattern} onChange={(e) => set("pattern", e.target.value as ItemFormValues["pattern"])}>
            {PATTERNS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Materiale" htmlFor="material" hint="Es. cotone, lana, lino, pelle">
          <Input id="material" value={values.material} maxLength={60} onChange={(e) => set("material", e.target.value)} />
        </Field>
      </div>

      <Field label="Stagioni" hint="Nessuna selezione = tutte le stagioni.">
        <ChipGroup label="Stagioni" options={SEASONS} value={values.seasons} onChange={(v) => set("seasons", v)} size="sm" />
      </Field>

      <Field label="Stile">
        <ChipGroup label="Stile" options={STYLES} value={values.styles} onChange={(v) => set("styles", v)} size="sm" />
      </Field>

      <Field label="Vestibilità">
        <ChipGroup
          label="Vestibilità"
          multiple={false}
          options={FITS}
          value={values.fit ? [values.fit] : []}
          onChange={(v) => set("fit", v[0] ?? null)}
          size="sm"
        />
      </Field>

      <Field label={`Formalità · ${FORMALITY_LABELS[values.formality]}`} htmlFor="formality">
        <input
          id="formality"
          type="range"
          min={1}
          max={5}
          step={1}
          value={values.formality}
          onChange={(e) => set("formality", Number(e.target.value))}
          className="w-full accent-[var(--olive)]"
        />
        <div className="flex justify-between text-[11px] text-muted" aria-hidden>
          <span>Informale</span>
          <span>Formale</span>
        </div>
      </Field>

      <Field label="Tag personalizzati" htmlFor="tags">
        <div className="flex flex-wrap gap-2">
          {values.tags.map((t) => (
            <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1.5 text-[12.5px]">
              {t}
              <button
                type="button"
                aria-label={`Rimuovi tag ${t}`}
                onClick={() => set("tags", values.tags.filter((x) => x !== t))}
                className="grid size-5 place-items-center rounded-full hover:bg-line"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <Input
          id="tags"
          value={tagDraft}
          placeholder="Scrivi e premi Invio"
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
        />
      </Field>

      <Field label="Note" htmlFor="notes">
        <Textarea id="notes" value={values.notes} maxLength={500} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}
