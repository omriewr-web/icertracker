# ICER Property Tracker

A comprehensive web-based property management and rent collection tracking application.

## Features

- **Dashboard** — Portfolio-wide KPIs: occupancy, total arrears, collection rates
- **Daily Summary** — What needs attention today (overdue, expiring leases, follow-ups)
- **Arrears Alerts** — Tenants with outstanding balances categorized by severity (30/60/90+ days)
- **Legal Cases** — Manual legal case pipeline with 9 stages (Notice → Eviction → Settled)
- **Vacancies** — Vacant unit tracking with lost rent calculations
- **Lease Management** — Lease expiration tracking and renewal alerts
- **Payment Tracking** — Log payments with date, amount, method, and notes
- **Collection Notes** — 6 note categories (Phone Call, Payment Promise, Letter Sent, Door Knock, Email/Text, Other)
- **PDF Reports** — Generate collection reports with tenant details and notes
- **Excel Export** — Export filtered tenant data to spreadsheet
- **Bulk Actions** — Select multiple tenants for batch operations
- **Advanced Filters** — Filter by arrears, lease status, balance range, property

## Tech Stack

Single-file HTML application with embedded data:
- Vanilla JavaScript (no framework dependencies)
- Chart.js for analytics visualizations
- SheetJS (XLSX) for Excel import/export
- LocalStorage for data persistence
- CSS custom properties for theming

## Planned: Full-Stack Multi-User System

- Node.js + Express backend
- PostgreSQL database
- JWT authentication with role-based access
- 5 user roles: Admin, Property Manager, Collector, Owner, Broker/Leasing Agent
- Docker deployment

## Getting Started

Open `ICER-Property-Tracker.html` in any modern browser. No server required.

## License

Proprietary — ICER Management
