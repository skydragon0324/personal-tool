import { Fragment, type ReactNode } from "react";

import { t, type MessageKey } from "./index";

/**
 * Like `t`, but `{name}` placeholders can be filled with elements (e.g. a bold board name), so a
 * sentence stays one translatable text even when part of it is styled.
 */
export function tRich(key: MessageKey, values: Record<string, ReactNode>): ReactNode {
  const marker = "\u0000";
  const placeholders: Record<string, string> = {};
  for (const name of Object.keys(values)) placeholders[name] = `${marker}${name}${marker}`;
  const text = t(key, placeholders);
  return text.split(marker).map((part, index) => {
    // Odd parts are placeholder names, even parts are plain text.
    if (index % 2 === 1 && part in values) {
      return <Fragment key={index}>{values[part]}</Fragment>;
    }
    return part;
  });
}
