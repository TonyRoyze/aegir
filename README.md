# Aegir - Swimming Meet Management System

Aegir is a high-performance, real-time platform designed for organizing swimming meets, managing student registrations, and generating official competition documents.

## 🚀 Features

- **🏆 Meet Management**: Create, edit, and archive swimming meets. Each meet can have its own unique set of events and dates.
- **📝 Real-time Registration**: A spreadsheet-style interface for rapid student registration. Data is synchronized in real-time across all devices using **Convex**.
- **📋 Smart Validation**: Ensures registrations follow meet rules (e.g., limiting the number of events per student).
- **🔄 Event Reordering**: An intuitive drag-and-drop interface using `dnd-kit` to perfectly sequence your meet's program.
- **📄 High-Fidelity PDF Generation**: Automated generation of official documents via a headless browser (**Puppeteer**) for perfect A4 printing:
    - **Registration Sheets**: Auto-populated and filtered by Gender and Faculty.
    - **Meet Programs**: Showing the official sequence of events and participants.
- **📱 Mobile Ready**: Dedicated mobile-optimized views for poolside registration and data entry.
- **🎨 Modern UI**: Built with a sleek, premium design using Tailwind CSS, Radix UI primitives, and Lucide icons.

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Backend / Database**: [Convex](https://www.convex.dev/) (Real-time syncing)
- **PDF Engine**: [Puppeteer](https://pptr.dev/) (Headless browser rendering)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **Drag & Drop**: [@dnd-kit](https://dnd-kit.com/)

## 📖 Documentation

- [PDF Generation Blueprint](./BLUEPRINT_PDF_GENERATION.md) - Deep dive into the architectural pattern for PDF generation.
- [PDF Usage Instructions](./PDF_INSTRUCTIONS.md) - How to use and extend the PDF system.

## 🚦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file with your Convex and App URL details:
```env
NEXT_PUBLIC_CONVEX_URL=your_convex_url_here
CONVEX_DEPLOYMENT=your_deployment_name_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
npm run dev
# or
npx convex dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📄 License
MIT
