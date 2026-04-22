import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://abeveiimcmroceakyvli.supabase.co'

const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZXZlaWltY21yb2NlYWt5dmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDg4NzIsImV4cCI6MjA5MjAyNDg3Mn0.fCLI4_ljh0cBO98CZgTUvzz9EW3x3Ji-N7TCaN9fl2k'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)