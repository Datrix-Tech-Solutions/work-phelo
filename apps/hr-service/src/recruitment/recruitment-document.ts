import { Prisma } from '../../prisma/generated/client';

export const ACTIVE_RECRUITMENT_DOCUMENTS = {
  where: { status: 'ACTIVE' as const },
  select: {
    id: true,
    type: true,
    originalFileName: true,
    mimeType: true,
    sizeBytes: true,
    createdAt: true,
  },
  orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
} satisfies Prisma.RecruitmentApplicationDocumentFindManyArgs;

/** Upload finalization, retirement and submission share this lock. No storage I/O under it. */
export async function lockRecruitmentApplication(
  tx: Prisma.TransactionClient,
  applicationId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "hr"."RecruitmentApplication" WHERE "id" = ${applicationId} FOR UPDATE`;
}
