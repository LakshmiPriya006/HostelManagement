'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';
import { useHostelStore } from '../src/store/hostelStore';

export function ClientProvider({ children, hostname }: { children: React.ReactNode, hostname: string }) {
  const { setUser, setSession, setRole, setOwnerProfile, setHostellerProfile, setLoading, setCurrentDomain } = useAuthStore();
  const { setHostels, setSelectedHostelId } = useHostelStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    const domain = hostname.startsWith('owner.') ? 'owner' : 'hosteller';
    setCurrentDomain(domain);
    async function loadUser(userId: string) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (!roleData) {
        setLoading(false);
        return;
      }

      setRole(roleData.role);

      const domain = hostname.startsWith('owner.') ? 'owner' : 'hosteller';

      if (roleData.role !== domain) {
        // Domain mismatch! Force sign out
        await supabase.auth.signOut();
        return;
      }

      if (domain === 'owner') {
        const { data: ownerData } = await supabase
          .from('owners')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (ownerData) setOwnerProfile(ownerData);

        const { data: hostelsData } = await supabase
          .from('hostels')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: true });
        if (hostelsData && hostelsData.length > 0) {
          setHostels(hostelsData);
          setSelectedHostelId(hostelsData[0].id);
        }
      } else if (domain === 'hosteller') {
        const { data: hostellerData } = await supabase
          .from('hostellers')
          .select('*')
          .eq('id', userId)
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
          await loadUser(session.user.id);
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
