// Edge Function per gestione utenti (richiede Service Role Key)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  action: 'create'
  calling_user_id: string
  email: string
  password: string
  full_name: string
  role: 'admin' | 'tecnico' | 'utente' | 'userdm329'
}

interface UpdateUserRequest {
  action: 'update'
  calling_user_id: string
  userId: string
  full_name?: string
  role?: 'admin' | 'tecnico' | 'utente' | 'userdm329'
  is_suspended?: boolean
}

interface DeleteUserRequest {
  action: 'delete'
  calling_user_id: string
  userId: string
}

interface ResetPasswordRequest {
  action: 'reset-password'
  calling_user_id: string
  userId: string
  newPassword: string
}

type ManageUserRequest = CreateUserRequest | UpdateUserRequest | DeleteUserRequest | ResetPasswordRequest

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== Edge Function Called ===')

    // Creare client con Service Role Key per tutte le operazioni
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Parsare il body della richiesta
    const requestData: ManageUserRequest = await req.json()
    console.log('Action:', requestData.action)
    console.log('Calling user ID:', requestData.calling_user_id)

    // Verificare che l'utente chiamante sia admin usando Admin client
    const { data: callingUser, error: callingUserError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, is_suspended')
      .eq('id', requestData.calling_user_id)
      .single()

    console.log('Calling user:', callingUser)
    console.log('Calling user error:', callingUserError)

    if (callingUserError || !callingUser) {
      console.error('Calling user not found')
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (callingUser.is_suspended) {
      console.error('Calling user is suspended')
      return new Response(
        JSON.stringify({ error: 'User account is suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (callingUser.role !== 'admin') {
      console.error('Calling user is not admin, role:', callingUser.role)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authorization check passed, processing request...')

    // Gestire le diverse azioni
    switch (requestData.action) {
      case 'create': {
        // Creare utente in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: requestData.email,
          password: requestData.password,
          email_confirm: true,
          user_metadata: {
            full_name: requestData.full_name,
          },
        })

        if (authError) {
          throw new Error(`Auth error: ${authError.message}`)
        }

        if (!authData.user) {
          throw new Error('User not created')
        }

        // Aggiornare il profilo con il ruolo corretto
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('users')
          .update({
            role: requestData.role,
            full_name: requestData.full_name,
          })
          .eq('id', authData.user.id)
          .select()
          .single()

        if (profileError) {
          // Rollback: eliminare utente auth
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
          throw new Error(`Profile error: ${profileError.message}`)
        }

        return new Response(
          JSON.stringify({ success: true, user: profileData }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        // Aggiornare profilo utente
        const updates: any = {
          updated_at: new Date().toISOString(),
        }

        if (requestData.full_name !== undefined) {
          updates.full_name = requestData.full_name
        }
        if (requestData.role !== undefined) {
          updates.role = requestData.role
        }
        if (requestData.is_suspended !== undefined) {
          updates.is_suspended = requestData.is_suspended
        }

        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('users')
          .update(updates)
          .eq('id', requestData.userId)
          .select()
          .single()

        if (profileError) {
          throw new Error(`Update error: ${profileError.message}`)
        }

        return new Response(
          JSON.stringify({ success: true, user: profileData }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        console.log('Starting delete operation for user:', requestData.userId)

        // STEP 1: Eliminare prima i dati collegati dall'utente
        // Nota: Le richieste create_by potrebbero avere constraint, quindi le gestiamo

        // Eliminare le richieste assegnate all'utente (impostare assigned_to a NULL)
        console.log('Updating assigned requests...')
        const { error: updateAssignedError } = await supabaseAdmin
          .from('requests')
          .update({ assigned_to: null })
          .eq('assigned_to', requestData.userId)

        if (updateAssignedError) {
          console.error('Error updating assigned requests:', updateAssignedError)
          throw new Error(`Error updating assigned requests: ${updateAssignedError.message}`)
        }

        // Mantenere le richieste create dall'utente impostando created_by a NULL
        console.log('Updating created_by to NULL for user requests...')
        const { error: updateCreatedError } = await supabaseAdmin
          .from('requests')
          .update({ created_by: null })
          .eq('created_by', requestData.userId)

        if (updateCreatedError) {
          console.error('Error updating created_by:', updateCreatedError)
          throw new Error(`Error updating created_by: ${updateCreatedError.message}`)
        }

        // Eliminare le notifiche dell'utente
        console.log('Deleting notifications...')
        const { error: deleteNotificationsError } = await supabaseAdmin
          .from('notifications')
          .delete()
          .eq('user_id', requestData.userId)

        if (deleteNotificationsError) {
          console.error('Error deleting notifications:', deleteNotificationsError)
          // Non blocchiamo se le notifiche falliscono
        }

        // STEP 2: Eliminare l'utente da public.users
        console.log('Deleting from public.users...')
        const { error: deletePublicUserError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', requestData.userId)

        if (deletePublicUserError) {
          console.error('Error deleting from public.users:', deletePublicUserError)
          throw new Error(`Error deleting from public.users: ${deletePublicUserError.message}`)
        }

        // STEP 3: Eliminare l'utente da auth.users
        console.log('Deleting from auth.users...')
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
          requestData.userId
        )

        if (deleteAuthError) {
          console.error('Error deleting from auth.users:', deleteAuthError)
          throw new Error(`Delete error: ${deleteAuthError.message}`)
        }

        console.log('User deleted successfully')
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reset-password': {
        // Resettare password utente
        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
          requestData.userId,
          { password: requestData.newPassword }
        )

        if (resetError) {
          throw new Error(`Reset password error: ${resetError.message}`)
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
