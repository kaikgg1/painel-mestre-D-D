// assets/js/supabase.js
// Inicializa cliente Supabase global. Espera que o SDK já tenha sido
// carregado antes (vendorizado localmente, perf-4 — não é mais via CDN).
//
// Uso no HTML:
//   <script src="../assets/vendor/supabase-js-2.45.0.min.js"></script>
//   <script src="../assets/js/supabase.js"></script>
// Depois disso, window.sb é o cliente.

(function () {
  const URL = 'https://ehbngkmxwsjxuetjnztz.supabase.co';
  // anon key — pública por design, protegida por RLS no banco
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYm5na214d3NqeHVldGpuenR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NTk2MDQsImV4cCI6MjA5NTEzNTYwNH0.nKUMwOOzlzZnaWDU7h450D-7yySVJd1kGdYXWSz36l0';

  if (typeof window.supabase === 'undefined') {
    console.error('[sb] @supabase/supabase-js não carregado. Inclua assets/vendor/supabase-js-2.45.0.min.js antes deste arquivo.');
    return;
  }

  window.sb = window.supabase.createClient(URL, ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  window.SUPABASE_URL = URL;
})();
