import { Prisma, ProjectTimeSource } from '../../prisma/generated/client';

/** Stops every running timer on a task, e.g. when the task is done. */
export async function closeRunningTimers(
  tx: Prisma.TransactionClient,
  taskId: string,
  now = new Date(),
) {
  const running = await tx.projectTimeEntry.findMany({
    where: { taskId, source: ProjectTimeSource.TIMER, endedAt: null },
    select: { id: true, startedAt: true },
  });
  for (const entry of running) {
    await tx.projectTimeEntry.update({
      where: { id: entry.id },
      data: {
        endedAt: now,
        seconds: entry.startedAt
          ? Math.max(
              0,
              Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000),
            )
          : 0,
      },
    });
  }
}
