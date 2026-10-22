/** Rows per page in the staff applications queue. Lives outside review.ts because a "use server" file may export only async functions. */
export const REVIEW_PAGE_SIZE = 25
export const IN_PROGRESS_STATUSES = ['under_review', 'shortlisted', 'interview', 'waitlisted'] as const
export type ReviewFilterStatus = 'submitted' | 'accepted' | 'rejected' | (typeof IN_PROGRESS_STATUSES)[number] | 'in_progress'
