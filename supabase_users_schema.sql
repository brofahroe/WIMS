-- ==============================================================================
-- WIMS v3 - SUPABASE USERS & ROLES SCHEMA
-- ==============================================================================
-- Instruksi:
-- 1. Pastikan Anda sudah membuat user(s) di dashboard Supabase (Authentication -> Users).
-- 2. Jalankan script SQL ini di menu "SQL Editor" pada dashboard Supabase Anda.
-- 3. Isi role manual untuk setiap user dengan mengubah 'email_anda@domain.com' dengan email asli.

-- 1. Buat tabel user_roles
create table if not exists public.user_roles (
  id uuid references auth.users not null primary key,
  role text not null check (role in ('Admin', 'Manager', 'Staff Gudang')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Aktifkan RLS (Row Level Security) agar aman
alter table public.user_roles enable row level security;

-- 3. Beri akses bagi user untuk membaca rolenya sendiri
create policy "Users can read own role" on public.user_roles
  for select using (auth.uid() = id);

-- 4. Beri akses untuk admin (opsional, agar bisa manage role) atau buka sementara untuk kemudahan
create policy "Allow all read for now" on public.user_roles
  for select using (true);


-- ==============================================================================
-- CARA MENGISI ROLE SECARA MANUAL
-- ==============================================================================
-- Hapus tanda komentar (--) pada block di bawah ini dan jalankan SETELAH Anda 
-- membuat user di tab Authentication.
-- Gantilah email dengan email user yang sudah Anda daftarkan!

/*
-- Beri role Admin:
INSERT INTO public.user_roles (id, role)
SELECT id, 'Admin' FROM auth.users WHERE email = 'admin@wimsv3.local'
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Beri role Manager:
INSERT INTO public.user_roles (id, role)
SELECT id, 'Manager' FROM auth.users WHERE email = 'manager@wimsv3.local'
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Beri role Staff Gudang:
INSERT INTO public.user_roles (id, role)
SELECT id, 'Staff Gudang' FROM auth.users WHERE email = 'staff@wimsv3.local'
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
*/
