-- Fix auth signup trigger to always create role rows and owner profiles reliably.
-- Also backfill missing rows for users already present in auth.users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'hosteller');

  IF v_role NOT IN ('owner', 'hosteller') THEN
    v_role := 'hosteller';
  END IF;

  INSERT INTO public.user_roles (id, role)
  VALUES (new.id, v_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  IF v_role = 'owner' THEN
    INSERT INTO public.owners (id, name, email, phone)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'name', ''),
      COALESCE(new.email, ''),
      COALESCE(new.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill role rows for already-created auth users.
INSERT INTO public.user_roles (id, role)
SELECT
  u.id,
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'role', 'hosteller') IN ('owner', 'hosteller')
      THEN COALESCE(u.raw_user_meta_data->>'role', 'hosteller')
    ELSE 'hosteller'
  END AS role
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Backfill owner profiles for existing users marked as owner.
INSERT INTO public.owners (id, name, email, phone)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', ''),
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'phone', '')
FROM auth.users u
WHERE COALESCE(u.raw_user_meta_data->>'role', 'hosteller') = 'owner'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;
