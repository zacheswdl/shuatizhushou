/**
 * Configuration & Supabase Client Initialization
 */
var CONFIG = {
  SUPABASE_URL: 'https://kvkflegnewntmijaovho.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2a2ZsZWduZXdudG1pamFvdmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDM0ODgsImV4cCI6MjA4NzY3OTQ4OH0.RMLjc0qEVEBJHGuwZ3RmVRG0tkHsXv_288jVFpEjcEU',
  ADMIN_PASS: 'admin123'
};

// Supabase client singleton
var supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Device ID (persistent per browser)
function getDeviceId() {
  var key = 'quiz_device_id';
  var id = localStorage.getItem(key);
  if (!id) {
    if (window.crypto && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
    }
    localStorage.setItem(key, id);
  }
  return id;
}

var DEVICE_ID = getDeviceId();