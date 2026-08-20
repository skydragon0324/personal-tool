"use client";

import { Alert, Group, Progress, RingProgress, SimpleGrid, Text } from "@mantine/core";
import { useMemo } from "react";

import type { BoardColumn, TasksByColumn } from "../types";
import { computeProgressStats } from "../utils/progress-stats";
import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";
import { statusHeaderClass } from "../utils/status-colors";

interface ProgressViewProps {
  columns: BoardColumn[];
  tasksByColumn: TasksByColumn;
}

export function ProgressView({ columns, tasksByColumn }: ProgressViewProps) {
  const stats = useMemo(
    () => computeProgressStats(columns, tasksByColumn),
    [columns, tasksByColumn],
  );

  return (
    <div className={`${BOARD_CONTENT_GUTTER} space-y-6 pb-8`}>
      <p className="text-sm text-[var(--app-text-muted)]">Based on current filters</p>
      {!stats.hasCompletedStatus ? (
        <Alert color="yellow" title="No completed status is configured.">
          Mark a status as “Counts as completed” to track completion.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-8 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6">
        <RingProgress
          size={160}
          thickness={16}
          roundCaps
          label={
            <Text ta="center" fw={700} size="xl">
              {stats.percent}%
            </Text>
          }
          sections={[{ value: stats.percent, color: "teal" }]}
        />
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg" className="min-w-[16rem] flex-1">
          <Stat label="Total" value={stats.total} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Remaining" value={stats.remaining} />
          <Stat label="Overdue" value={stats.overdue} />
        </SimpleGrid>
      </div>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
        <Text fw={600} mb="md">
          By status
        </Text>
        <div className="space-y-3">
          {stats.byStatus.map((item) => (
            <div key={item.columnId}>
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusHeaderClass(item.color)}`} />
                  <Text size="sm">{item.name}</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {item.count} · {item.percent}%
                </Text>
              </Group>
              <Progress value={item.percent} color="teal" size="sm" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
        <Text fw={600} mb="md">
          By category
        </Text>
        {stats.byCategory.length ? (
          <div className="space-y-3">
            {stats.byCategory.map((item) => (
              <div key={item.id}>
                <Group justify="space-between" mb={4}>
                  <Text size="sm">{item.name}</Text>
                  <Text size="sm" c="dimmed">
                    {item.count} · {item.percent}%
                  </Text>
                </Group>
                <Progress value={item.percent} color="cyan" size="sm" />
              </div>
            ))}
          </div>
        ) : (
          <Text size="sm" c="dimmed">
            No tasks match the current filters.
          </Text>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text className="font-display" size="xl" fw={700}>
        {value}
      </Text>
    </div>
  );
}
