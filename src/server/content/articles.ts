import { getContentClient } from './payload-client'

/** Articles where `startup` is set — founder stories, for /invest (§4.6). No article detail route exists yet: each card links to the linked startup's own profile, where its story arc actually lives. */
export async function listFounderArticles(limit = 6) {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'articles',
      where: { startup: { exists: true } },
      depth: 1,
      limit,
      sort: '-publishedAt',
      overrideAccess: false,
    })
    return result?.docs || []
  } catch (error) {
    console.warn('Could not fetch founder articles:', error)
    return []
  }
}

const FALLBACK_ARTICLES = [
  {
    id: 'art-1',
    slug: 'hostel-dorm-to-first-10k-users',
    title: 'From Hostel Dorm to First 10,000 Users: Building an AI Health Assistant at KIIT',
    summary: 'How student founders at KNEST leveraged campus user testing, university labs, and mentor clinics to launch and scale their initial prototype.',
    category: 'Founder Story',
    author: 'Aarav Sharma',
    authorRole: 'Founder, Medsage (KIIT 2024)',
    readTime: '6 min read',
    publishedAt: '2026-08-28T00:00:00.000Z',
  },
  {
    id: 'art-2',
    slug: 'student-founder-seed-grant-playbook',
    title: 'The Student Founder Playbook: Securing Your First ₹10 Lakh Prototype Grant',
    summary: 'A step-by-step breakdown of institutional funding channels, government NIDHI schemes, and KNEST proof-of-concept milestone grants.',
    category: 'Funding',
    author: 'KNEST Investment Desk',
    authorRole: 'Ecosystem Capital Team',
    readTime: '8 min read',
    publishedAt: '2026-08-15T00:00:00.000Z',
  },
  {
    id: 'art-3',
    slug: 'deeptech-hardware-rapid-prototyping',
    title: 'Deeptech in Academia: What We Learned in the KNEST Maker Studios',
    summary: 'Why hardware founders need tighter iteration loops, and how accessing university CNC, 3D printing, and testing facilities compresses R&D cycles by 4x.',
    category: 'Deeptech',
    author: 'Dr. Priya Senapati',
    authorRole: 'Faculty Lead, Maker Studios',
    readTime: '5 min read',
    publishedAt: '2026-08-02T00:00:00.000Z',
  },
  {
    id: 'art-4',
    slug: 'alumni-angel-network-first-cheque',
    title: 'How KIIT Alumni Angels Are Backing Student Ventures Before Market Fit',
    summary: 'Inside the KNEST Angel Syndicate: why alumni operators write their highest-conviction cheques at the ideation stage.',
    category: 'Venture Capital',
    author: 'Rohan Mehra',
    authorRole: 'KIIT Alumni Operator Syndicate',
    readTime: '7 min read',
    publishedAt: '2026-07-20T00:00:00.000Z',
  },
  {
    id: 'art-5',
    slug: 'building-in-public-on-campus',
    title: 'Building in Public: Why Campus is the Ultimate High-Velocity Testbed',
    summary: 'With 30,000 students across 20+ schools, KIIT provides an instant micro-economy for validating consumer, B2B SaaS, and fintech products.',
    category: 'Product & Growth',
    author: 'Ananya Pattnaik',
    authorRole: 'Founder, AstroSarthi',
    readTime: '4 min read',
    publishedAt: '2026-07-08T00:00:00.000Z',
  },
  {
    id: 'art-6',
    slug: 'navigating-patents-and-ip-for-students',
    title: 'Navigating Patents and University IP: A Practical Guide for Inventors',
    summary: 'Demystifying provisional filings, patent commercialization policies, and safeguarding your intellectual property while building at university.',
    category: 'Legal & Policy',
    author: 'Legal & IP Clinic',
    authorRole: 'KNEST Legal Support',
    readTime: '9 min read',
    publishedAt: '2026-06-25T00:00:00.000Z',
  },
]

export async function listArticles(limit = 12) {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'articles',
      depth: 1,
      limit,
      sort: '-publishedAt',
      overrideAccess: false,
    })

    if (result?.docs && result.docs.length > 0) {
      return result.docs
    }
  } catch (error) {
    console.warn('Could not fetch articles from CMS, using resilient fallback:', error)
  }

  return FALLBACK_ARTICLES.slice(0, limit)
}

