"use client";

import { Combobox, InputBase, Loader, Text, useCombobox } from "@mantine/core";
import { useMemo, useState } from "react";

import type { Category } from "@/features/board/types";
import {
  buildCategoryComboboxOptions,
  categoryBadgeClass,
  matchingCategory,
  nextCategoryColor,
} from "@/features/tasks/utils/category-options";

interface CategoryComboboxProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  onCreate: (input: { name: string; color: string }) => Promise<Category>;
  creating?: boolean;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
}

export function CategoryCombobox({
  categories,
  value,
  onChange,
  onCreate,
  creating = false,
  error,
  disabled,
  required,
  label = "Category",
  placeholder = "Search or create a category",
}: CategoryComboboxProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });
  const [search, setSearch] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const selected = categories.find((category) => category.id === value) ?? null;
  const display = combobox.dropdownOpened ? search : (selected?.name ?? search);
  const options = useMemo(
    () => buildCategoryComboboxOptions(categories, search),
    [categories, search],
  );

  async function handleCreate(name: string) {
    const existing = matchingCategory(categories, name);
    if (existing) {
      onChange(existing.id);
      setSearch(existing.name);
      setLocalError(null);
      combobox.closeDropdown();
      return;
    }
    setLocalError(null);
    try {
      const created = await onCreate({
        name: name.trim(),
        color: nextCategoryColor(categories),
      });
      onChange(created.id);
      setSearch(created.name);
      combobox.closeDropdown();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to create category");
    }
  }

  return (
    <Combobox
      store={combobox}
      withinPortal
      onOptionSubmit={(optionValue) => {
        if (optionValue === "__create__") {
          void handleCreate(search);
          return;
        }
        const category = categories.find((item) => item.id === optionValue);
        if (!category) return;
        onChange(category.id);
        setSearch(category.name);
        setLocalError(null);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          label={label}
          required={required}
          disabled={disabled || creating}
          rightSection={creating ? <Loader size="xs" /> : <Combobox.Chevron />}
          rightSectionPointerEvents="none"
          placeholder={placeholder}
          value={display}
          error={error || localError}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => {
            setSearch(selected?.name ?? search);
            combobox.openDropdown();
          }}
          onBlur={() => {
            combobox.closeDropdown();
            setSearch(selected?.name ?? "");
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {options.items.map((category) => (
            <Combobox.Option value={category.id} key={category.id}>
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${categoryBadgeClass(category.color)}`}
                />
                <span>{category.name}</span>
              </span>
            </Combobox.Option>
          ))}
          {options.showCreate ? (
            <Combobox.Option value="__create__">
              <Text size="sm">{options.createLabel}</Text>
            </Combobox.Option>
          ) : null}
          {options.items.length === 0 && !options.showCreate ? (
            <Combobox.Empty>No categories</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
