# Reference: HTTP routes and pages

Generated from the source tree on 2026-10-12 (`src/app`). Regenerate after route changes. Limits are the named buckets in `src/server/security/rate-limit.ts`; guards are inferred from the helpers each handler calls, so confirm against the handler before relying on this for a security statement.

## API routes

| Route | Methods | Rate-limit buckets | Guards |
|---|---|---|---|
| `/api/[...slug]` | - | - | - |
| `/events/[slug]/calendar.ics` | GET | - | - |
| `/api/admin/applications/[id]/documents/[questionId]` | GET | staffAction | staff |
| `/api/admin/applications/[id]/status` | POST | staffAction | - |
| `/api/admin/enquiries/[id]/handled` | POST | staffAction | - |
| `/api/admin/lab-departments` | POST | - | lab flag |
| `/api/admin/labs` | POST | - | lab flag |
| `/api/admin/mail/[id]/resend` | POST | staffAction | - |
| `/api/admin/members/[id]/active` | POST | staffAction | - |
| `/api/admin/members/[id]/staff-role` | POST | staffAction | - |
| `/api/analytics/track` | POST | analyticsTrack | - |
| `/api/applications/[id]/answer` | POST | answerSave | - |
| `/api/applications/[id]/documents` | POST | - | - |
| `/api/applications/[id]/submit` | POST | - | human check |
| `/api/applications/start` | POST | - | - |
| `/api/auth/[...nextauth]` | - | - | - |
| `/api/auth/google/start` | POST | - | - |
| `/api/auth/password/login` | POST | login, loginAccount | human check |
| `/api/auth/password/logout` | POST | - | - |
| `/api/auth/password/reset/confirm` | POST | - | - |
| `/api/auth/password/reset/request` | POST | passwordResetRequest | human check |
| `/api/auth/password/signup` | POST | signup | human check |
| `/api/auth/password/verify/confirm` | POST | - | - |
| `/api/auth/password/verify/send` | POST | - | - |
| `/api/enquiries` | POST | enquirySubmit | member, human check |
| `/api/events/[id]/register` | POST | eventRegister | - |
| `/api/events/[id]/unregister` | POST | eventRegister | - |
| `/api/health` | GET | - | - |
| `/api/labs/[slug]/availability` | GET | - | member, lab flag |
| `/api/labs/[slug]/manage` | POST | - | lab flag |
| `/api/labs/[slug]/request` | POST | labRequest | member, human check, lab flag |
| `/api/labs/bookings/[id]/attendance` | POST | - | lab flag |
| `/api/labs/bookings/[id]/cancel` | POST | - | lab flag |
| `/api/labs/bookings/[id]/decide` | POST | - | lab flag |
| `/api/labs/bookings/[id]/respond` | POST | - | lab flag |
| `/api/labs/report.csv` | GET | - | lab flag |
| `/api/notifications/[id]/read` | POST | notificationRead | - |
| `/api/onboarding/step` | POST | onboardingStep | - |

## Pages

| Path | Area |
|---|---|
| `/login` | auth |
| `/reset/confirm` | auth |
| `/reset` | auth |
| `/signup` | auth |
| `/verify/confirm` | auth |
| `/verify` | auth |
| `/apply/[program]` | member |
| `/dashboard/applications` | member |
| `/dashboard/events` | member |
| `/dashboard/lab-booking/[slug]` | member |
| `/dashboard/lab-booking` | member |
| `/dashboard/lab-staff/[slug]` | member |
| `/dashboard/lab-staff/[slug]/report` | member |
| `/dashboard/lab-staff` | member |
| `/dashboard` | member |
| `/onboarding` | member |
| `/admin/[[...segments]]` | payload |
| `/about` | public |
| `/blog/[slug]` | public |
| `/blog` | public |
| `/contact` | public |
| `/ecosystem` | public |
| `/events/[slug]` | public |
| `/events` | public |
| `/get-involved` | public |
| `/invest` | public |
| `/mentors/[slug]` | public |
| `/mentors` | public |
| `/` | public |
| `/privacy` | public |
| `/programs/[slug]` | public |
| `/programs` | public |
| `/resources/[slug]` | public |
| `/resources` | public |
| `/search` | public |
| `/startups/[slug]` | public |
| `/startups` | public |
| `/terms` | public |
| `/admin/analytics` | staff |
| `/admin/applications/[id]` | staff |
| `/admin/applications` | staff |
| `/admin/audit` | staff |
| `/admin/enquiries` | staff |
| `/admin/labs` | staff |
| `/admin/labs/report` | staff |
| `/admin/mail` | staff |
| `/admin/members` | staff |
| `/admin/overview` | staff |
