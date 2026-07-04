/* ============================================================================
   CONFIG  —  public front-end settings
   ----------------------------------------------------------------------------
   These two values are SAFE to ship in the website. The Supabase "anon public"
   key is designed to be public; real protection comes from Row Level Security
   rules on the database (added when we move predictions to the server).
   The SECRET keys (service_role, the football API key) never live here — they
   stay server-side in a Supabase Edge Function.
   ========================================================================== */

const SUPABASE_URL = 'https://puvpmvtrtvnglrzyplkk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dnBtdnRydHZuZ2xyenlwbGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDE5MDksImV4cCI6MjA5ODY3NzkwOX0.W_48tfbbP35SvL9MxKbT2OggJY7ReYDs_Eo9xvuZvGY';
