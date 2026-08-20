import { categoryBadgeClass } from "@/features/tasks/utils/category-options";
import type { Category } from "@/features/board/types";

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(category.color)}`}
    >
      {category.name}
    </span>
  );
}
