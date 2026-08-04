-- Set Admin role for your user
-- Ganti 'admin@domin.com' dengan email admin Anda yang terdaftar di Supabase Auth
INSERT INTO public.user_roles (id, role)
SELECT id, 'Admin' FROM auth.users WHERE email = 'admin@domin.com'
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Verifikasi role berhasil disimpan
SELECT auth.users.email, user_roles.role
FROM auth.users
LEFT JOIN user_roles ON auth.users.id = user_roles.id
WHERE auth.users.email = 'admin@domin.com';
