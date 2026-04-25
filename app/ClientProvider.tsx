'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '../src/services/supabase';
import { ensureOwnerAuthRecords } from '../src/services/authBootstrap';
import { useAuthStore } from '../src/store/authStore';
import { useHostelStore } from '../src/store/hostelStore';
import type { User } from '@supabase/supabase-js';

export function ClientProvider({ children, hostname }: { children: React.ReactNode, hostname: string }) {
  const { setUser, setSession, setRole, setOwnerProfile, setHostellerProfile, setLoading, setCurrentDomain } = useAuthStore();
  const { setHostels, setSelectedHostelId } = useHostelStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const domain = hostname.startsWith('owner.')
      ? 'owner'
      : hostname.startsWith('app.')
        ? 'hosteller'
        : pathname.startsWith('/owner')
          ? 'owner'
          : pathname.startsWith('/hosteller')
            ? 'hosteller'
            : null;
    setCurrentDomain(domain);
    async function loadUser(user: User) {
      let { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const metadataRole = user.user_metadata?.role;
      if (!roleData && metadataRole === 'owner') {
        await ensureOwnerAuthRecords({
          userId: user.id,
          email: user.email ?? '',
          name: user.user_metadata?.name,
          phone: user.user_metadata?.phone,
        });

        const { data: repairedRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        roleData = repairedRoleData;
      }

      if (!roleData) {
        setLoading(false);
        return;
      }

      setRole(roleData.role);

      const domain = hostname.startsWith('owner.')
        ? 'owner'
        : hostname.startsWith('app.')
          ? 'hosteller'
          : roleData.role;

      if (roleData.role !== domain) {
        // Domain mismatch! Force sign out
        await supabase.auth.signOut();
        return;
      }

      if (domain === 'owner') {
        const { data: ownerData } = await supabase
          .from('owners')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (ownerData) setOwnerProfile(ownerData);

        const { data: hostelsData } = await supabase
          .from('hostels')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });
        if (hostelsData && hostelsData.length > 0) {
          setHostels(hostelsData);
          setSelectedHostelId(hostelsData[0].id);
        }
      } else if (domain === 'hosteller') {
        const { data: hostellerData } = await supabase
          .from('hostellers')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (hostellerData) setHostellerProfile(hostellerData);
      }

      setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT') {
          initializedRef.current = false;
          setUser(null);
          setSession(null);
          setRole(null);
          setOwnerProfile(null);
          setHostellerProfile(null);
          setHostels([]);
          setLoading(false);
          return;
        }
        if (session) {
          if (initializedRef.current && event === 'TOKEN_REFRESHED') return;
          initializedRef.current = true;
          setSession(session);
          setUser(session.user);
          await loadUser(session.user);
        } else if (!initializedRef.current) {
          initializedRef.current = true;
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
