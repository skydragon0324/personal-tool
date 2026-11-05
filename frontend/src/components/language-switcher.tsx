import { ActionIcon, Menu } from "@mantine/core";

import { LANGUAGES, LOCALES, t } from "@/i18n";
import { useLanguage } from "@/i18n/provider";

/** A compact language menu, sized to sit next to the theme toggle. */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Menu shadow="md" position="top-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label={t("common.language")} title={t("common.language")}>
          <span className="text-xs font-semibold">{LOCALES[language].shortLabel}</span>
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("common.language")}</Menu.Label>
        {LANGUAGES.map((option) => (
          <Menu.Item
            key={option.value}
            lang={option.value === "en" ? "en" : LOCALES[option.value].bcp47}
            onClick={() => setLanguage(option.value)}
            rightSection={option.value === language ? "✓" : null}
            aria-current={option.value === language ? "true" : undefined}
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
