# PRD - WIMS v3
## Warehouse Inventory Monitoring System

---

## 1. Executive Summary

### 1.1 Product Vision
WIMS v3 adalah sistem monitoring inventaris gudang berbasis web yang dirancang untuk mengelola pergerakan material (barang masuk, keluar, transfer, dan peminjaman) di lingkungan warehouse operasional GCI-EJ-EMR-MALANG. Sistem ini menggantikan proses manual berbasis Excel dengan platform digital terintegrasi yang mendukung real-time tracking, reporting, dan multi-user collaboration.

### 1.2 Target Audience
- **Admin WH**: Administrator gudang dengan akses penuh, bertanggung jawab input data, verifikasi, dan maintenance sistem.
- **Manager**: Supervisor operasional dengan akses baca, reporting, dan oversight tanpa kemampuan mengubah data transaksi.
- **Staff Gudang**: Operator gudang yang melakukan input transaksi harian (inbound, outbound, transfer, borrow).

### 1.3 Business Objectives
- Mengurangi human error pada pencatatan manual Excel.
- Menyediakan real-time visibility stok material per warehouse.
- Mendukung traceability material per drum/haspel.
- Memudahkan reporting dan export data untuk audit.
- Mendukung operasi multi-warehouse (GCI cabang Malang dan cabang lain).

---

## 2. Current State Analysis

### 2.1 Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 19.0.0 / 5.7.0 |
| Build Tool | Vite | 7.0.0 |
| Database | Supabase PostgreSQL | - |
| Auth | Supabase Auth | - |
| Storage | Supabase Storage (proof images) | - |
| Icons | Lucide React | 0.475.0 |
| Spreadsheet | XLSX (Excel import) | 0.18.5 |
| State Management | React Hooks + localStorage | - |

### 2.2 Existing Database Schema

#### Tabel Transactions
Primary table untuk semua transaksi. Dibagi menjadi 2 sumber: `logfile` dan `leftovers`.
- `id`, `source`, `rowId`, `tagId`, `lineId`
- `taggingType`: LOGFILE / LEFTOVERS
- `transactionType`: INBOUND / OUTBOUND / BORROW IN / BORROW OUT / TRANSFER IN / TRANSFER OUT
- `notaNo`, `whGci`, `picWarehouse`, `date`, `time`
- `sourceDestination`, `typeMaterial`, `materialName`, `materialCode`, `unit`
- `qty`, `siteId`, `siteName`, `doNumber`, `dnNumber`
- `condition`, `picDelivery`, `vendorSupplier`, `idCard`, `carPlate`
- `remarks`, `taggingManual`, `cableLengthMarker`, `cableRoll`, `inOutQty`, `loCriteria`, `drumNumber`, `proofLink`
- `created_at`

#### Tabel Master Materials
- `materialName` (PK), `typeMaterial`, `sourceMaterial`, `materialCode`, `unit`
- `inbound`, `outbound`, `transferIn`, `transferOut`, `borrowIn`, `borrowOut`
- `stockWh`, `leftoversStock`, `addRemark`

#### Tabel Warehouses
- `whGci` (PK), `whId`, `picWh`

#### Tabel Sites
- `id` (serial PK), `no`, `region`, `city`, `siteId`, `siteName`, `address`
- `team`, `permit`, `snd`, `donation`, `implementation`, `atp`, `acceptance`, `finalMilestone`
- `materialRequest`, `milestoneByZte`, `projectName`, `statusCity`, `materials` (jsonb)

#### Tabel Delivery Orders
- `id` (serial PK), `siteId`, `siteName`, `subcon`, `region`, `city`, `dropCity`
- `doNumber`, `dnNumber`, `materialPickUpdate`, `materialName`, `qty`

#### Tabel App Settings
- `id` (PK), `data` (jsonb) - menyimpan master data lain (transaction types, units, sources, conditions, label prefixes, cable rolls, material milestones)

#### Tabel User Roles
- `id` (uuid, ref auth.users), `role` (Admin / Manager / Staff Gudang)

### 2.3 Existing Features (v3)
1. **Authentication** - Login via Supabase Auth dengan role-based access.
2. **Dashboard** - Ringkasan stok, event log terbaru, quick actions.
3. **Inbound** - Input barang masuk ke warehouse (logfile).
4. **Outbound** - Input barang keluar dari warehouse (logfile).
5. **Transfer** - Transfer material antar warehouse.
6. **Borrow** - Peminjaman dan pengembalian material.
7. **Inventory Summary** - Tabel stok material per warehouse dengan kalkulasi real-time.
8. **Logfile Tables** - Daftar transaksi logfile dan leftovers dengan filter dan edit.
9. **Leftovers Management** - Kelola material sisa/damage dengan kriteria LO.
10. **Site Tracker** - Database site/proyek.
11. **Site Summary Outbound** - Ringkasan outbound per site.
12. **Master Material** - Kelola data master material.
13. **Report & Export** - Export data ke Excel dan laporan.
14. **Nota Print** - Panel cetak nota transaksi.
15. **Material History** - Riwayat pergerakan material tertentu.
16. **Drum History** - Riwayat pergerakan per drum/haspel.
17. **Delivery Orders** - Kelola data DO.

### 2.4 Current Limitations
- **No offline mode** untuk Supabase (hanya localStorage fallback).
- **No real-time sync** antar user.
- **No audit trail** yang terstruktur (hanya event log sederhana).
- **No approval workflow** untuk transaksi.
- **No barcode/QR scanning** untuk tagging.
- **No advanced reporting** (BI-style dashboard, scheduled reports).
- **No notification system** (email, push).
- **No image gallery** untuk proof (hanya link).
- **No multi-currency / multi-unit conversion**.
- **No integration** dengan sistem eksternal (ERP, accounting).
- **RLS policies terlalu permisif** (allow all) untuk production.
- **seedData.json** besar dan potentially out-of-sync dengan Excel sumber.
- **Tidak ada unit test** atau E2E test.

---

## 3. Product Roadmap

### Phase 1: Stabilisasi & Hardening (Q3 2026)
**Goal:** Menyiapkan sistem untuk production deployment yang aman dan stabil.

#### P1.1 Security Hardening
- [ ] Implement RLS policies berbasis role untuk semua tabel.
- [ ] Audit dan sanitasi semua Supabase API calls.
- [ ] Enforce input validation di frontend dan backend.
- [ ] Implementasi session timeout dan auto-logout.
- [ ] Proteksi route berdasarkan role (Admin-only pages, Manager-only pages).
- [ ] Rate limiting untuk API endpoints (jika perlu via Edge Functions).

#### P1.2 Data Integrity & Backup
- [ ] Automated database backup strategy (Supabase).
- [ ] Implement soft-delete untuk transaksi penting.
- [ ] Audit trail terstruktur (mengganti event log sederhana).
- [ ] Data validation rules untuk transaksi (stok tidak boleh negatif, dll).
- [ ] Duplicate detection untuk transaksi (notaNo, drumNumber).

#### P1.3 Performance & UX
- [ ] Optimasi loading state (skeleton, suspense boundaries).
- [ ] Implementasi virtual scrolling untuk large datasets (logfile, leftovers).
- [ ] Lazy loading untuk routes/komponen.
- [ ] Error boundary dan fallback UI.
- [ ] Offline indicator dan retry mechanism untuk Supabase.
- [ ] Responsive design improvements untuk tablet dan mobile.

#### P1.4 Testing & CI/CD
- [ ] Setup unit test framework (Vitest).
- [ ] Setup E2E test (Playwright).
- [ ] CI/CD pipeline (GitHub Actions) untuk build, lint, test.
- [ ] Pre-commit hooks (lint, format, typecheck).

---

### Phase 2: Enhanced Features (Q4 2026)
**Goal:** Menambahkan fitur produktivitas yang meningkatkan efisiensi operasional.

#### P2.1 Barcode / QR Integration
- [ ] Generate QR code untuk tag material, drum, dan nota.
- [ ] Scan QR untuk cepat input transaksi (mobile-friendly).
- [ ] Print label dengan QR code untuk tagging material.

#### P2.2 Advanced Reporting
- [ ] Dashboard analytics dengan chart (stok per warehouse, pergerakan harian, top material).
- [ ] Scheduled report generation (daily/weekly/monthly) dengan export otomatis.
- [ ] Custom report builder (filter, group, aggregate).
- [ ] Inventory aging report (material lama di gudang).
- [ ] Variance report (stok fisik vs stok sistem).

#### P2.3 Multi-User Collaboration
- [ ] Real-time updates via Supabase Realtime (CRDT atau last-write-wins).
- [ ] User presence indicator (siapa yang sedang online).
- [ ] Activity feed global per warehouse.
- [ ] Comment/notes pada transaksi untuk komunikasi antar user.

#### P2.4 Proof & Documentation
- [ ] Image upload untuk proof (receipt, damaged goods).
- [ ] Image gallery per transaksi.
- [ ] OCR untuk membaca nomor nota dari gambar (opsional).
- [ ] Attachment dokumen lain (PDF, Excel).

#### P2.5 Approval Workflow (Opsional)
- [ ] Transaksi besar memerlukan approval dari Manager.
- [ ] Notification via email atau in-app.
- [ ] Approval history dan tracking.

---

### Phase 3: Integration & Scale (Q1 2027)
**Goal:** Integrasi dengan ekosistem bisnis dan skalabilitas.

#### P3.1 ERP / Accounting Integration
- [ ] Webhook atau API untuk push data ke sistem eksternal.
- [ ] Import master data dari sistem lain (SAP, Odoo, Excel advanced).
- [ ] Export laporan ke format standar industri.

#### P3.2 Mobile App (Opsional)
- [ ] PWA (Progressive Web App) untuk akses cepat di tablet/HP.
- [ ] Offline-first mode dengan sync saat online.
- [ ] Mobile-optimized transaction forms.

#### P3.3 Advanced Inventory Features
- [ ] Cycle count / stock opname module.
- [ ] Discrepancy resolution workflow.
- [ ] Automated reorder point alerts.
- [ ] Batch/lot tracking untuk material perishable atau regulated.

#### P3.4 Scalability
- [ ] Sharding atau partitioning untuk tabel transaksi besar (>1M rows).
- [ ] Read replicas untuk reporting queries.
- [ ] Archival strategy untuk data lama (cold storage).

---

## 4. Functional Requirements Detail

### 4.1 Authentication & Authorization

| Req ID | Description | Priority | Role Impact |
|--------|-------------|----------|-------------|
| AUTH-01 | User login via email/password menggunakan Supabase Auth. | Must | All |
| AUTH-02 | Role-based access control (Admin, Manager, Staff Gudang). | Must | All |
| AUTH-03 | Auto-logout setelah idle timeout (30 menit). | Should | All |
| AUTH-04 | Admin dapat mengelola user dan role (CRUD). | Should | Admin |
| AUTH-05 | Password reset via email. | Could | All |

### 4.2 Transaction Management

| Req ID | Description | Priority | Role Impact |
|--------|-------------|----------|-------------|
| TRX-01 | Input Inbound (barang masuk ke gudang). | Must | Admin, Staff |
| TRX-02 | Input Outbound (barang keluar dari gudang). | Must | Admin, Staff |
| TRX-03 | Input Transfer antar warehouse. | Must | Admin, Staff |
| TRX-04 | Input Borrow In / Borrow Out (peminjaman/pengembalian). | Must | Admin, Staff |
| TRX-05 | Validasi form: qty > 0, material master valid, stok mencukupi untuk outbound. | Must | All |
| TRX-06 | Auto-generate nota number dengan format prefix + warehouse + year-month + sequence. | Must | All |
| TRX-07 | Rollback / edit transaksi (hanya transaksi terbaru dalam window tertentu). | Should | Admin |
| TRX-08 | Void transaksi dengan alasan yang dicatat. | Should | Admin |
| TRX-09 | Barcode/QR scan untuk cepat input material dan drum. | Could | All |

### 4.3 Inventory & Stock Management

| Req ID | Description | Priority | Role Impact |
|--------|-------------|----------|-------------|
| INV-01 | Real-time kalkulasi stok per material per warehouse. | Must | All |
| INV-02 | Stok gabungan (logfile + leftovers). | Must | All |
| INV-03 | Filter stok per warehouse atau All Warehouses. | Must | All |
| INV-04 | Low stock warning (threshold bisa dikonfigurasi). | Should | All |
| INV-05 | Inventory history / movement log per material. | Should | All |
| INV-06 | Stock opname / cycle count module. | Could | Admin |

### 4.4 Leftovers & Tagging

| Req ID | Description | Priority | Role Impact |
|--------|-------------|----------|-------------|
| LEF-01 | Input transaksi leftovers (material sisa/damage). | Must | Admin, Staff |
| LEF-02 | Auto-classify leftover berdasarkan qty (>2000, >1500, >1000, >500, >250, >100, <100). | Must | All |
| LEF-03 | Auto-generate tag ID dengan prefix berdasarkan material. | Must | All |
| LEF-04 | Reel balance tracking per drum/haspel (FIFO). | Must | All |
| LEF-05 | History per drum number. | Should | All |

### 4.5 Delivery Orders & Site Management

| Req ID | Description | Priority | Role Impact |
|--------|-------------|----------|-------------|
| DO-01 | CRUD Delivery Orders (DO, DN, material pick update). | Must | Admin, Staff |
| DO-02 | Auto-fill site dan material dari DO saat input transaksi. | Must | All |
| DO-03 | Site database dengan tracking milestone proyek. | Must | All |
| DO-04 | Site summary outbound (total keluar per site). | Should | All |

### 4.6 Reporting & Export

| Req ID | Description | Priority | Role Impact |
|--------|-------------|----------|-------------|
| RPT-01 | Export logfile ke Excel (CSV/XLSX). | Must | Admin, Manager |
| RPT-02 | Export inventory summary ke Excel. | Must | Admin, Manager |
| RPT-03 | Print nota transaksi. | Must | All |
| RPT-04 | Material history report (pergerakan per material). | Should | All |
| RPT-05 | Custom date range filter untuk laporan. | Should | All |
| RPT-06 | Dashboard dengan KPI cards. | Must | All |

### 4.7 Data Import

| Req ID | Description | Priority | Role Impact |
|--------|-------------|----------|-------------|
| IMP-01 | Import data dari Excel (WIMS V1_GCI-EJ-EMR-MALANG.xlsm). | Must | Admin |
| IMP-02 | Validasi format Excel sebelum import. | Must | Admin |
| IMP-03 | Preview data sebelum commit import. | Should | Admin |

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **Page Load**: < 3 detik untuk initial load pada koneksi 4G.
- **Transaction Processing**: < 500ms untuk save transaksi.
- **Concurrent Users**: Mendukung minimal 20 concurrent users tanpa degradation.

### 5.2 Availability
- **Uptime Target**: 99.5% (menggunakan Supabase SLA).
- **Offline Fallback**: Aplikasi tetap bisa dibuka dan input transaksi disimpan di localStorage saat Supabase down. Data akan di-sync otomatis saat koneksi pulih.

### 5.3 Security
- **Data at Rest**: Terenkripsi di Supabase (PostgreSQL encryption).
- **Data in Transit**: HTTPS enforced.
- **Access Control**: RLS policies berbasis role.
- **Input Sanitization**: Semua input user divalidasi dan di-sanitasi.

### 5.4 Scalability
- **Database**: Dapat menampung >1 juta transaksi tanpa perlu re-architecture.
- **Frontend Bundle**: Target < 500KB gzipped untuk initial bundle.
- **Storage**: Supabase Storage untuk proof images dengan cleanup policy.

### 5.5 Maintainability
- **Code Quality**: TypeScript strict mode, ESLint, Prettier.
- **Testing Coverage**: Target >70% untuk core logic (wims.ts, supabase.ts).
- **Documentation**: Inline documentation untuk fungsi kompleks, README untuk setup.

---

## 6. Architecture & Design Decisions

### 6.1 Frontend Architecture
- **Component Structure**: Komponen besar di `src/components/`, utilities di `src/lib/`, types di `src/types.ts`.
- **State Management**: React useState + useMemo di App.tsx sebagai single source of truth. Prop drilling untuk now, cukup untuk skala saat ini. Pertimbangkan Zustand/Jotai jika kompleksitas meningkat.
- **Routing**: Conditional rendering berbasis `activeView` state (bukan React Router). Cukup untuk aplikasi single-page dengan ~15 views. Migrasi ke React Router jika perlu deep linking atau code splitting.

### 6.2 Data Flow
```
User Input -> Form State -> Validation -> Temp Rows -> Process -> LogRows/LeftoverRows -> Supabase (if enabled) + localStorage
```

### 6.3 Offline Strategy
- **Supabase Enabled**: Data disimpan di Supabase, localStorage hanya sebagai cache fallback untuk UI.
- **Supabase Disabled**: Aplikasi berjalan sepenuhnya di localStorage (mode demo/offline).

### 6.4 Naming Conventions
- **Database**: camelCase dengan quotes (misal `"materialName"`).
- **TypeScript**: camelCase untuk properties.
- **Constants**: UPPER_SNAKE_CASE untuk konstanta seperti `POSITIVE_TYPES`.
- **Files**: PascalCase untuk komponen React, camelCase untuk utilities.

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data Entry Accuracy | < 1% error rate | Audit sample transaksi vs fisik. |
| Transaction Processing Time | < 30 detik per transaksi | User testing. |
| System Uptime | > 99.5% | Supabase monitoring. |
| User Adoption | 100% staf gudang menggunakan sistem | Attendance log. |
| Report Generation Time | < 10 detik | Performance testing. |
| Bug Rate | < 5 bugs per sprint | Issue tracker. |

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Supabase downtime | Medium | High | Implement offline fallback, periodic health check, komunikasi ke user. |
| Data inconsistency antar warehouse | Medium | High | Implement transaction locking atau eventual sync dengan conflict resolution. |
| User resistance to change | High | Medium | Training, phased rollout, maintain Excel export untuk transisi. |
| Large Excel import timeout | Medium | Medium | Batch import, progress indicator, rollback on error. |
| RLS misconfiguration | Medium | High | Automated security tests, code review untuk schema changes. |

---

## 9. Appendix

### 9.1 Glossary
- **LOGFILE**: Transaksi regular masuk/keluar/transfer/borrow.
- **LEFTOVERS**: Transaksi untuk material sisa/damage.
- **Tagging Type**: Klasifikasi transaksi sebagai LOGFILE atau LEFTOVERS.
- **Nota No**: Nomor nota transaksi dengan format `PREFIX-WHIDYYMM-NNN`.
- **Drum Number**: Identifikasi unik per haspel/ gulungan material.
- **WH GCI**: Kode warehouse GCI.
- **Site**: Lokasi proyek / cabang tujuan material.
- **DO**: Delivery Order.
- **DN**: Delivery Note.

### 9.2 References
- Source workbook: `WIMS V1_GCI-EJ-EMR-MALANG.xlsm`
- Supabase project: (sesuai `.env` / VITE_SUPABASE_URL)
- Script import: `scripts/importExcel.js`

### 9.3 Changelog
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-15 | Kilo | Initial PRD creation |
