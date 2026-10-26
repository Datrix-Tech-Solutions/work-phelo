/**
 * Careers site URL helper.
 *
 * Recruiters who register on the careers site never see the workspace app, so
 * their emails link back to the site instead of a tenant workspace.
 */

function baseUrl(): string {
  return process.env.CAREERS_SITE_URL || 'http://localhost:3001';
}

export const CareersSiteUrl = {
  /** Email confirmation link — sent when a recruiter registers or asks for a resend */
  confirmRecruiterEmail: (token: string) =>
    `${baseUrl()}/auth/recruiter/confirm?token=${encodeURIComponent(token)}`,
};
