import { supabase } from '@/lib/supabaseClient'

export default async function Page() {
  const { data, error } = await supabase
    .from('tips')
    .select('*')

  return (
    <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
  )
}
