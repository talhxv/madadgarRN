import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ixoanvsfwuginciacavt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4b2FudnNmd3VnaW5jaWFjYXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4OTM0NTYsImV4cCI6MjA1MDQ2OTQ1Nn0.-4L2LwCxoxPGshKR7Srs603OxVDknCKJu6O7hQWkREg'
/*
const supabaseUrl = 'https://pwfxxnzzikzivgzsieoa.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Znh4bnp6aWt6aXZnenNpZW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzOTA4OTIsImV4cCI6MjA0OTk2Njg5Mn0.9skCmCgHeSTwEQzfRfvJQ83DYAWctFgHs0X-uVbqB5U'
*/

export const supabase = createClient(supabaseUrl, supabaseAnonKey)