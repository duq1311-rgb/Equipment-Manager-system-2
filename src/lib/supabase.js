import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function makeMissingProxy(message){
	// Return a safe stub that mimics supabase-js enough for the app to continue
	const result = { data: null, error: new Error(message) }

	// chainable builder that is awaitable (thenable)
	function makeBuilder(resOverride){
		const res = resOverride || { data: [], error: new Error(message) }
		const builder = {
			select(){ return builder },
			order(){ return builder },
			eq(){ return builder },
			maybeSingle(){ return builder },
			insert(){ return builder },
			update(){ return builder },
			delete(){ return builder },
			then(onFulfilled){ return Promise.resolve(res).then(onFulfilled) },
			catch(onRejected){ return Promise.resolve(res).catch(onRejected) }
		}
		return builder
	}

	return {
		from: ()=> makeBuilder(),
		// auth stub methods
		auth: {
			async signInWithPassword(){ return { data: null, error: new Error(message) } },
			async signOut(){ return { error: new Error(message) } },
			async getUser(){ return { data: null, error: new Error(message) } }
		},
		// fallback: any other access returns a thrower to make issue visible
		_missingMessage: message
	}
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
