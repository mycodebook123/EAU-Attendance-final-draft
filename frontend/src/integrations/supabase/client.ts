// Supabase replaced with Django REST API
// This file is kept to avoid import errors in any remaining components
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
    signInWithPassword: async () => ({ error: new Error("Use Django API instead") }),
    signUp: async () => ({ error: new Error("Use Django API instead") }),
  },
  from: (_table: string) => ({
    select: (_cols?: string) => ({
      eq: (_col: string, _val: any) => ({ data: null, error: null }),
      ilike: (_col: string, _val: any) => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      limit: (_n: number) => ({ data: [], error: null }),
    }),
  }),
};
