# Content editing guide

Audience: KNEST staff who write and update the public website. You do not need to be a developer.

After reading this you can add or change a program, an event, a mentor, an article, the homepage and a picture. You will also know what visitors can see and when.

## Before you start

This guide describes the Payload admin as the code configures it. It was written from the configuration files, before the site went live. Button names come from Payload's English text. If a screen looks different on the live site, trust the screen and tell the engineering contact: [PLACEHOLDER: name and email of the engineering contact].

### What you need

- A KNEST account that has a staff role. A super admin gives you the role on the Members screen. You cannot give it to yourself.
- A verified email address on that account.

### Signing in

1. Sign in at the normal KNEST sign-in page, `/login`, with your own account. There is no separate editor password.
2. Open `/admin`. From the staff console you can also use the link "Full admin (content, programs, startups)".

If `/admin` shows an error or a Payload login screen instead of the dashboard, sign in at `/login` first and try again. If it still fails, ask a super admin to check that your account is active and has a staff role. I could not confirm from the code what an unsigned-in visitor sees at `/admin`.

### What your role lets you change

You may be able to open sections you cannot change. The server refuses a save from a role that does not own the section, even if a screen lets you try.

| Staff role | You can change |
|---|---|
| Content admin | Events, Resources, Articles, Partners, Media, FAQs, Metrics, Testimonials, the Homepage. Also reads Enquiries. |
| Program manager | Programs and Cohorts. Also reviews applications. |
| Startup manager | Startups and Founders |
| Mentor manager | Mentors |
| Lab admin | Infrastructure (the spaces showcase). Also runs the Labs screens when lab booking is on. |
| Reviewer | Nothing in the CMS. Reviews applications only. |
| Super admin | Everything |

## The admin at a glance

The left menu groups content like this:

| Group | Sections |
|---|---|
| Incubator | Programs, Cohorts, Startups, Founders |
| Ecosystem | Mentors, Partners, Infrastructure |
| Content | Events, Resources, Articles |
| System | Media, Metrics, Faqs, Testimonials |

The Homepage is a separate item, because there is only one.

The dashboard shows three cards. Do not quote them as public numbers. They count every record of that type, including drafts and past events. The "Staff Members" card counts a technical mirror table, not your staff list.

## Draft versus published

This is the most important idea in this guide.

### Which content has drafts

| Has draft and publish | Goes live the moment you save |
|---|---|
| Programs, Startups, Founders, Mentors, Partners, Events, Resources, Articles, Infrastructure | Cohorts, Testimonials, Faqs, Metrics, Media, the Homepage |

For the right-hand column, there is no draft. When you save, visitors see the change. Check it before you save.

### How drafts behave

- **Visitors see only published content.** A draft never appears on the public site, in search or in the sitemap.
- **You can see drafts.** Staff see drafts in the admin, so you can prepare work in private.
- **Saving a draft of something already published changes nothing publicly.** Visitors keep seeing the last published version until you publish again.
- **There is no autosave.** Save before you leave a page. Payload warns you if you try to leave with unsaved changes.
- **There is no scheduled publishing.** Publishing happens when you press the button.

### The buttons

| Button | What it does |
|---|---|
| Save Draft | Saves your work. Visitors do not see it. |
| Publish | Makes a new document public. |
| Publish changes | Makes your edits to an already-published document public. |
| Unpublish | Takes a document off the public site. It stays in the admin as a draft. Use the menu next to the publish button. |
| Revert to published | Throws away your unpublished draft and goes back to the live version. |
| Versions tab | Lists earlier saves. "Restore this version" brings one back. |

Unpublish is how you remove something from the public site. Do not delete.

### When a change appears

Public pages are built each time someone asks for them. A published change should show on the next page load. No rebuild is needed. This follows from the code and has not been checked on a live site. If a change does not appear, hard-refresh the page, then check the status says "Published" and tell engineering.

## Programs

Programs are the most important content. Each program page is written so that fit comes before the ask.

Roles: program manager or super admin.

### Create or edit a program

1. Open Incubator, then Programs. Press Create new, or open a program.
2. Fill in the top fields:
   - **Title** (required).
   - **Slug.** This is the web address (for example `/programs/my-program`). It fills in from the title the first time. Changing it later breaks every link people have already shared. Leave it alone unless you must change it.
   - **Tagline** (required). One plain line, at most 120 characters.
3. Work through the tabs:

| Tab | What to enter |
|---|---|
| The page | **Who it's for** (required, and shown first: say who should apply and who should not). What you'll build. What you'll get. Timeline phases (label, duration, description). What we ask of you. FAQs for this program. |
| Who it reaches | **Stage** (required, pick one or more). Sectors. Audience. Format (in person, hybrid or online). Stage drives filters and recommendations. |
| Running it | Duration. Cohort size. Next cohort start. **Application status** (required). Deadline or opening date. Mentors. Partners. |
| Application | The questions applicants answer (see below). |
| SEO | Optional search title and description. Leave blank to use the title and tagline. |

4. In the right-hand column set a **Hero image** and **Featured** ("Eligible for the homepage").
5. Press **Save Draft**, check it, then **Publish**.

### Application status controls whether people can apply

| Status | What visitors see | Can people apply |
|---|---|---|
| Applications open | An apply button. If you set a deadline, it shows the closing date. | Yes, until the deadline passes |
| Opening soon | The opening date if you set one | No |
| Closed | The next cohort date if you set one | No |
| Cohort in progress | "This cohort is in progress." | No |

The deadline field appears only when the status is "Applications open". The opening date appears only for "Opening soon". The server also checks status and deadline when someone starts or submits, so a closed program cannot be applied to by tricks.

"Notify me" appears on closed and opening-soon programs. It links back to the program page. The code does not record a request or send a message. Do not promise visitors a notification.

### Application questions

On the Application tab you build the form. Each question has:

- **Label** (required) and optional **help text**.
- **Field type:** Short text, Long text, Select one, Select multiple, Link (URL), or File upload.
- **Options** for the two select types. The **value** of each option fills in from its label. Changing a label later does not change the value stored on answers already given.
- **Required.** On by default.
- **Max length,** for the two text types.

File uploads accept PDF, Word and PowerPoint files up to 10 MB.

What happens when you change questions after people have started:

- Applications already **submitted** keep the questions the applicant saw. Staff reviewers see those frozen questions.
- Applications still in **draft** use your current questions. An answer to a question you removed is ignored. If you make a rule stricter, a person with an old draft may be asked to fix an answer when they submit.
- Reordering or editing a question does not disconnect it from answers already saved.

### You cannot delete a program that has applications

The system refuses with a message that says to unpublish instead. Do that.

## Events

Roles: content admin or super admin.

1. Open Content, then Events, then Create new.
2. Fill in:
   - **Title**, **Summary** (required, at most 200 characters) and optional **Description**.
   - **Starts at** (required) and optionally **Ends at**.
   - **Event type** and **Format.**
   - **Location.** Leave it blank for online events.
   - **Capacity**, if seats are limited.
   - **Mentor speakers** (from the mentor directory) and **Other speakers** (name, title, organisation, photo) for guests who have no mentor profile.
   - **Relevant stages** and **Sectors.** These help recommend the event on member dashboards.
   - **Program** and **Cohort**, only if the event belongs to one.
3. In the right column set a hero image and **Featured.**
4. Save Draft, check, Publish.

### Registration: two ways, pick one

- **Leave "Registration URL" empty.** Signed-in members register on KNEST. KNEST counts them and stops at **Capacity.** It sends a confirmation email once. Members cannot register for an event that has already ended.
- **Fill in "Registration URL."** Members are sent to that outside link. KNEST does not count them. If someone tries to register inside KNEST, they are told registration happens on the organiser's page.

Capacity applies only to registrations made on KNEST.

## Mentors

Roles: mentor manager or super admin.

Mentors are added by staff only. KNEST vouches for everyone in the directory. There is no self-service sign-up and no booking system.

1. Open Ecosystem, then Mentors, then Create new.
2. Fill in:
   - **Name** (required), **Title**, **Organization**, **Bio.**
   - **Expertise** (required, pick one or more). This drives the "I need help with" entry on the mentors page.
   - **Sectors.**
   - **Availability:** Open to requests, Limited availability, or Not currently available. It shows as a badge.
   - **LinkedIn URL** and a **Photo.**
3. In the right column, **Featured** and **User id.** Leave User id blank unless the mentor has a KNEST account and an engineer gives you the id. It links the profile to their dashboard.
4. Get the profile reviewed, then Save Draft and Publish. The admin's own note on this section is "Reviewed before publishing."

Attach a mentor to a program from the program's "Running it" tab. The mentor then shows on that program with no re-typing.

## Articles

Roles: content admin or super admin.

Articles appear on the blog. An article linked to a startup is a founder story and also appears on the Invest page.

1. Open Content, then Articles, then Create new.
2. Fill in **Title**, **Summary** (required, at most 200 characters), **Body** (required), **Published at**, **Author.**
3. Set **Startup** if it is a founder story. Add a hero image and optional SEO fields.
4. Save Draft, check, Publish.

Publishing sets the document live. The "Published at" field is a date you enter. Set it yourself, because the blog sorts by it.

## The homepage

Roles: content admin or super admin.

There is one homepage. It is not a page builder. You change what each section says, what it features, the order and whether it shows. You cannot add new kinds of sections.

Open Homepage in the admin. It has no draft. Every save is live.

| Tab | What it controls |
|---|---|
| Sections | The ten fixed sections. Drag to reorder. Untick **Enabled** to hide a section completely. The section name is fixed. |
| Hero | Headline, subhead, primary button text, secondary button text, optional background media. The headline must read well without the picture. |
| Narrative | The problem heading and text, the "person" heading and lines, the "what KNEST is" heading and text |
| Featured | Up to 4 programs, 6 startups, 3 events, 3 testimonials, 4 metrics. Leave a list empty and the section shows the most recent items. |
| Closing | Closing heading, text and button |

The ten sections are: Hero, The problem, The person, What KNEST is, Journey selector, The journey, What you get, The ecosystem, Built with KNEST, Closing.

Rules for the homepage:

- Only feature real things. Use only published, sourced numbers under Metrics. Leave Metrics empty until you have real ones.
- If the homepage cannot be read, the site shows the approved fallback copy. It never shows invented content.
- Pages marked "copy needs approval" in `docs/delivery/LOCAL-COMPLETENESS.md` (About, Ecosystem, Invest, the triple-helix section) wait for the content approver. Do not publish new claims on them without that approval. [PLACEHOLDER: name of the public copy approver (HD-04)]

## Media (pictures)

Roles: content admin or super admin.

1. Open System, then Media, then Create new, and upload the file.
2. Fill in **Alt text** (required). Describe the picture for someone who cannot see it. If it is only decoration, type `decorative`.
3. Add **Credit** if you need to name the photographer or source.
4. Save. Media has no draft, so it is stored at once.

Rules:

- **Accepted types:** JPEG, PNG, WebP and AVIF. SVG and other formats are refused on purpose.
- Payload makes three sizes: thumbnail (400 by 300), card (800 by 600) and hero (1920 by 1080). Choose the **focal point** so the crop keeps the important part.
- Use pictures you have the right to use. Never upload a picture of a person without their agreement.
- To use a picture, pick it from the Hero image, Photo, Logo or similar field on the content.

The code does not state a file size limit for media. Keep files small (a few hundred kilobytes where you can) so pages load quickly. [PLACEHOLDER: confirm a media size limit with engineering]

## Other content types

| Section | Draft? | Role | Notes |
|---|---|---|---|
| Startups | Yes | Startup manager | Public profile only. Nothing private belongs here. Tell the story stage by stage. Add only the stages the startup has reached. Achievements must be things that actually happened. |
| Founders | Yes | Startup manager | Public profile. The optional User id links to an account. |
| Cohorts | No | Program manager | One run of a program. Startups attached to a cohort appear on that program. |
| Partners | Yes | Content admin | Name, type, description, website, logo |
| Infrastructure | Yes | Lab admin | A showcase of the physical spaces. It does not take bookings. |
| Resources | Yes | Content admin | Pick the stages it helps. Use **Body** for content on KNEST, **External URL** for content elsewhere, **File** for a download. |
| Faqs | No | Content admin | Question, answer, category, order |
| Testimonials | No | Content admin | Real quotes only. **Consent given** is required: tick it only after the person agreed to be quoted by name. |
| Metrics | No | Content admin | Label, value, as-of date and source are all required. The source is an internal note and is not shown publicly. If you cannot name a source, do not add the number. |

## Write so everyone can read it

The public site has a skip link, visible focus on links and buttons, and text labels for statuses. What you write decides the rest.

- **Link text must make sense alone.** Write "Read the application guide", not "click here".
- **Alt text:** describe what matters in the picture. Use `decorative` only when the picture adds nothing.
- **Headings in order.** One main heading, then sub-headings, without skipping levels. Do not use a heading just to make text big.
- **Never use colour alone** to mark something, such as "the red items are closed". Say it in words.
- **Write dates in words,** like "Fri 9 Oct 2026", not 2026-10-09.
- **Avoid long text in capitals.** Screen readers and many readers find it hard.
- Keep sentences short and plain.

Accessibility status: automated checks found no serious problems on the screens they scanned. No person has tested the site with a screen reader. Tell the accessibility contact if you find a problem: [PLACEHOLDER: accessibility contact]. The accessibility of the Payload admin screen you edit in is unverified. If it does not work for you with your keyboard or assistive technology, ask engineering for another way to make the change: [PLACEHOLDER: engineering contact].

## A short checklist before you publish

- [ ] The title, tagline and summary are correct and say nothing that is not true.
- [ ] Dates and times are right. Times are shown in India time.
- [ ] Every picture has alt text.
- [ ] Links open the right page.
- [ ] No private data is in the content (no personal phone numbers or email addresses unless the person agreed).
- [ ] For programs: the application status, deadline and questions are right.
- [ ] For events: you chose one registration method.
- [ ] You previewed the saved draft in the admin before pressing Publish.

## When something goes wrong

| What you see | What to do |
|---|---|
| "You cannot save" or a permission error | Your role does not own that section. Ask a super admin. |
| A program will not delete | It has applications. Unpublish it. |
| The slug says it is already taken | Choose a different slug. Slugs must be unique. |
| A published change does not appear | Hard-refresh. Confirm the status says Published. Then contact engineering: [PLACEHOLDER: engineering contact] |
| You published something by mistake | Use Unpublish. Then tell the content owner: [PLACEHOLDER: content owner] |
| You need an account or a role | Ask a super admin: [PLACEHOLDER: name of a super admin] |

Content publishing is not yet recorded in the audit trail. Keep your own note of what you changed and when.
