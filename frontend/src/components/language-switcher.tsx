import { ActionIcon, Menu } from "@mantine/core";

import { LANGUAGES, t } from "@/i18n";
import { useLanguage } from "@/i18n/provider";

const SHORT_LABEL = { en: "EN", zh: "中" } as const;

/** A compact language menu, sized to sit next to the theme toggle. */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Menu shadow="md" position="top-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label={t("common.language")} title={t("common.language")}>
          <span className="text-xs font-semibold">{SHORT_LABEL[language]}</span>
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("common.language")}</Menu.Label>
        {LANGUAGES.map((option) => (
          <Menu.Item
            key={option.value}
            lang={option.value === "zh" ? "zh-CN" : "en"}
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
