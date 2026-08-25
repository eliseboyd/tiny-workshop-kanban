'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const supabase = await createClient();

  let error;
  try {
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch {
    return redirect(`/login?message=${encodeURIComponent('Unable to connect. The service may be temporarily unavailable — please try again shortly.')}`);
  }

  if (error) {
    console.error('Login Error:', error);
    return redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

// No signup action. This is a single-account board, so an open registration
// form is only a way in for someone else — and until 0022 lands, every kanban
// policy grants any authenticated user the whole board.
//
// Removing this button is not the fix on its own: signups are still open at the
// Supabase API, and the publishable key is in the browser bundle, so anyone can
// POST /auth/v1/signup directly. Turn signups off in the dashboard (Auth →
// Sign In / Up → Email) — that is the real fence. New accounts are created from
// the dashboard and added to public.app_users.

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
