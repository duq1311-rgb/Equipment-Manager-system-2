import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function makeMissingProxy(message){
	// Return a function that throws when called, or a proxy that throws on any access
	const thrower = () => { throw new Error(message) }
	return new Proxy(thrower, {
		get(){ return thrower },
		apply(){ return thrower() }
	})
}

let _supabase
if (!url || !anonKey) {
	const msg = 'Supabase not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment (Vercel env vars)'
	// Log to console for deploy logs / client debugging
	console.warn(msg)
	// Provide a proxy that throws a clear error when used instead of letting the library throw during import
	_supabase = makeMissingProxy(msg)
} else {
	_supabase = createClient(url, anonKey)
}

export const supabase = _supabase
