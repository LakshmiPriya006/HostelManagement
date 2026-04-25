-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'hosteller');

  IF v_role NOT IN ('owner', 'hosteller') THEN
    v_role := 'hosteller';
  END IF;

  -- Always ensure user role exists.
  INSERT INTO public.user_roles (id, role)
  VALUES (new.id, v_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- Owner-specific profile bootstrap.
  IF v_role = 'owner' THEN
    -- Insert into owners
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

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
