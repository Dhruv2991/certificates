# 🎓 TeamCodeLocked & BitByBit Certificate Portal

A production-ready full-stack Next.js web application and automated certificate generation pipeline for **TeamCodeLocked Club Orientation** attendees at **B.M.S. College of Engineering (BMSCE)**. It supports separate certificate templates for **Participants** and **Volunteers**, and features a secure **Admin Management Dashboard** restricted strictly to **`dhruvg.cs24@bmsce.ac.in`**.

This portal acts as an active user acquisition funnel driving attendees to our competitive coding platform **[BitByBit](https://bitbybit-9h8e.vercel.app)**.

---

## 🌟 Key Architecture & Capabilities

### 1. Dual Template Pipeline & Bulk Generator (`generate_certs.py`)
- **Participant Template (`template_participant.png` / `2.png`):**
  - Title: *Certificate of Participation*
  - Accent: Purple / Magenta / Orange gradient
  - Target Audience: 269 orientation participants parsed from `Attendance Sheet Participants .xlsx`
  - Unique ID Format: `PAR-001`, `PAR-002`, ...
- **Volunteer Template (`template_volunteer.png` / `Volunteer 2.png`):**
  - Title: *Certificate of Appreciation*
  - Accent: Deep Blue / Cyan / Mint Green gradient
  - Target Audience: Orientation volunteers parsed from `volunteers.xlsx`
  - Unique ID Format: `VOL-001`, `VOL-002`, ...
- **Name Placement Rules:**
  - Automatically clears the placeholder area and renders each recipient's name **strictly without square brackets** (e.g. `Dev Ballav`, `Dhruv G Nayak`, never `[Dev Ballav]`).
  - Rendered at `(X: 263, Y: 745)` in bold sans typography matching the 2000×1414 resolution.
- **Dynamic Single Generation:** Supports CLI `--single` mode used by the Admin Panel to dynamically generate certificate PNGs on the fly.
- **Metadata Index:** Generates and maintains `/public/certificates.json` mapping each user's `id`, `name`, `email`, `type` (`participant` or `volunteer`), and `fileUrl`.

### 2. Public Search & Download Portal (`app/page.tsx`)
- **Minimal, Human-Crafted Aesthetic:** Neutral dark theme (`bg-[#090d16]`) with clean solid borders (`border-slate-800`), crisp typography, and zero blurry background glow blobs.
- **Dual Lookup:** Supports case-insensitive search by registered email address or Unique ID (`PAR-XXX` or `VOL-XXX`).
- **Interactive Result Card:**
  - Personalized greeting: *"Hello, [Name]!"*
  - Category Badge: *"Participant Certificate of Participation"* or *"Volunteer Certificate of Appreciation"*.
  - Responsive preview image with full-screen enlargement modal.
  - Solid, prominent **Download Certificate** button triggering direct browser download (`Certificate_<Name>_<ID>.png`).
- **BitByBit Growth Funnel Section:** Promotes real-time **1v1 Code Duels**, **Weekly Ranked Contests**, and **Global Leaderboards** with a direct CTA to `https://bitbybit-9h8e.vercel.app`.
- **Footer:**
  `© 2026 TeamCodeLocked. All rights reserved. Built by Dhruv G Nayak & Technical, Design and Marketing Team of TeamCodeLocked.`

### 3. Secured Admin Dashboard (`app/admin/page.tsx` & `/api/admin/...`)
- **Restricted Access:** Hardened strictly to admin email **`dhruvg.cs24@bmsce.ac.in`**.
- **Admin Authentication:**
  - Email: `dhruvg.cs24@bmsce.ac.in`
  - Default Password: `codelocked2026` (configurable via `ADMIN_PASSWORD` environment variable)
- **Dashboard Features:**
  - **Live Metric Cards:** Total Issued, Participants Count, Volunteers Count.
  - **Issue New Certificate:** Admin form allowing authorized staff to enter Name, Email, and select Certificate Type (Participant vs. Volunteer). Automatically renders the certificate image and updates `certificates.json` dynamically.
  - **Directory Table:** Search, filter by type (All / Participant / Volunteer), preview links, and **Delete** actions to remove records and uncommitted files.

---

## 📁 Project Folder Structure

```text
cert/
├── template_participant.png            # Official Participation certificate template (2000x1414)
├── template_volunteer.png              # Official Volunteer Appreciation template (2000x1414)
├── Attendance Sheet Participants .xlsx # 269 BMSCE orientation participants (header=None)
├── volunteers.xlsx                     # BMSCE orientation volunteer team (header=None)
├── generate_certs.py                   # Dual-template bulk & single generator (pandas + PIL)
├── package.json                        # Next.js 16 (App Router), Tailwind CSS v4, Lucide
├── README.md                           # Comprehensive documentation & deployment guide
├── public/
│   ├── certificates.json               # Indexed database mapping all attendees to cert URLs
│   └── certificates/                   # 288 generated high-res PNG certificates
│       ├── PAR-001.png                 # Dev Ballav (Participant)
│       ├── VOL-001.png                 # Laasya Deepak (Volunteer)
│       ├── VOL-005.png                 # Dhruv G Nayak (Volunteer)
│       └── ...
└── src/
    ├── app/
    │   ├── admin/
    │   │   └── page.tsx                # Secured Admin Dashboard (dhruvg.cs24@bmsce.ac.in)
    │   ├── api/
    │   │   ├── admin/
    │   │   │   ├── auth/route.ts       # Admin session & authentication verification
    │   │   │   └── certificates/route.ts # Admin CRUD API (add / delete certificates)
    │   │   └── certificates/route.ts   # Public case-insensitive search route (?q=...)
    │   ├── globals.css                 # Clean developer theme tokens
    │   ├── layout.tsx                  # SEO metadata & Geist typography
    │   └── page.tsx                    # Public search & download portal with growth funnel
    └── data/
        └── certificates.json           # Synced backup catalog
```

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies

```powershell
# Node.js dependencies
npm install

# Python dependencies for generator
pip install pandas Pillow openpyxl
```

### Step 2: Run the Bulk Certificate Generator

```powershell
python generate_certs.py
```

*This reads both `Attendance Sheet Participants .xlsx` and `volunteers.xlsx`, overlays names without square brackets on their respective templates, outputs all 288 PNGs to `public/certificates/`, and writes `public/certificates.json`.*

### Step 3: Start the Development Server

```powershell
npm run dev
```

Navigate to:
- Public Portal: **[http://localhost:3000](http://localhost:3000)**
- Admin Dashboard: **[http://localhost:3000/admin](http://localhost:3000/admin)**

---

## 🔐 Admin Panel Credentials

To access the Admin Dashboard at `/admin`:

| Field | Value |
| :--- | :--- |
| **Admin Email** | `dhruvg.cs24@bmsce.ac.in` *(strictly enforced)* |
| **Admin Password** | `codelocked2026` *(default)* |

> **Security Note:** You can configure a custom admin password by setting the `ADMIN_PASSWORD` environment variable in your `.env.local` or Vercel project settings:
> ```env
> ADMIN_PASSWORD=your_secure_password_here
> ```

---

## 🌐 API Endpoints Reference

### Public API: `GET /api/certificates?q=<email_or_id>`
Searches by email address or Unique ID (`PAR-XXX` or `VOL-XXX`) case-insensitively.

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "certificate": {
    "id": "PAR-001",
    "name": "Dev Ballav",
    "email": "devballav.ch26@bmsce.ac.in",
    "type": "participant",
    "fileUrl": "/certificates/PAR-001.png",
    "organization": "TeamCodeLocked",
    "college": "B.M.S. College of Engineering",
    "event": "Club Orientation 2026",
    "partner": "BitByBit",
    "partnerUrl": "https://bitbybit-9h8e.vercel.app"
  }
}
```

### Admin API: `GET /api/admin/certificates`
Returns all certificate records and metrics. Requires valid admin session.

### Admin API: `POST /api/admin/certificates`
Creates a new certificate, dynamically rendering the appropriate template PNG and appending it to `certificates.json`.
```json
{
  "name": "Kavya Rao",
  "email": "kavya.rao@bmsce.ac.in",
  "type": "participant"
}
```

### Admin API: `DELETE /api/admin/certificates?id=<id>`
Removes a certificate record from `certificates.json` and deletes its generated PNG.

---

## 🚢 Deploying to Vercel

1. Commit and push the repository to GitHub / GitLab:
   ```powershell
   git add .
   git commit -m "feat: Participant & Volunteer Certificate Portal with Admin Dashboard"
   git push origin main
   ```
2. Import the project in [Vercel](https://vercel.com).
3. Set your environment variable:
   - `ADMIN_PASSWORD`: Your secret admin password
4. Click **Deploy**. Vercel will build the Next.js app and serve all pre-generated certificates directly from its global Edge CDN.
