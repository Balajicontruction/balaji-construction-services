// Customer Profile Save Fix
// Keeps profile persistence isolated from the rest of the Customer Dashboard.
(function () {
  'use strict';
  const SUPABASE_URL = 'https://iefxfyjmyssuiuyncfqz.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
  if (!window.supabase || !SUPABASE_ANON_KEY) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.saveCustomerProfile = async function saveCustomerProfile(profile) {
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Customer login session not found.');

    const payload = {
      id: user.id,
      full_name: profile.name || null,
      phone: profile.phone || null,
      email: profile.email || user.email || null,
      avatar_url: profile.avatar_url || null,
      address: profile.address || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('customers')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  };
})();
