import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { z } from 'https://esm.sh/zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const TextSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().max(2000).optional(),
});


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const token = authHeader.replace('Bearer ', '')

    // Get user from auth token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const formData = await req.formData()
    const rawName = formData.get('name')
    const rawBio = formData.get('bio')
    const profilePic = formData.get('profile_pic')
    const coverPhoto = formData.get('cover_photo')

    // Validate text fields
    const parsed = TextSchema.safeParse({
      name: typeof rawName === 'string' ? rawName : undefined,
      bio: typeof rawBio === 'string' ? rawBio : undefined,
    })
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { name, bio } = parsed.data

    // Validate uploaded files (mime/size) up-front
    const validateFile = (f: unknown, label: string): File | null => {
      if (!(f instanceof File) || f.size === 0) return null
      if (!ALLOWED_MIME.has(f.type)) {
        throw new Error(`${label} must be a JPEG, PNG, WEBP, or GIF image`)
      }
      if (f.size > MAX_IMAGE_BYTES) {
        throw new Error(`${label} must be smaller than 5 MB`)
      }
      return f
    }

    let profilePicFile: File | null = null
    let coverPhotoFile: File | null = null
    try {
      profilePicFile = validateFile(profilePic, 'Profile picture')
      coverPhotoFile = validateFile(coverPhoto, 'Cover photo')
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: e.message || 'Invalid file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let profilePicUrl: string | null = null
    let coverPhotoUrl: string | null = null

    // Handle profile picture upload
    if (profilePicFile) {
      const ext = (profilePicFile.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5)
      const profilePicPath = `image/${user.id}/profile_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(profilePicPath, profilePicFile, { contentType: profilePicFile.type })
      if (uploadError) {
        console.error('Profile pic upload error:', uploadError)
      } else {
        const { data } = supabase.storage.from('media').getPublicUrl(profilePicPath)
        profilePicUrl = data.publicUrl
      }
    }

    // Handle cover photo upload
    if (coverPhotoFile) {
      const ext = (coverPhotoFile.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5)
      const coverPhotoPath = `image/${user.id}/cover_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(coverPhotoPath, coverPhotoFile, { contentType: coverPhotoFile.type })
      if (uploadError) {
        console.error('Cover photo upload error:', uploadError)
      } else {
        const { data } = supabase.storage.from('media').getPublicUrl(coverPhotoPath)
        coverPhotoUrl = data.publicUrl
      }
    }

    // Update user profile
    type UpdatePayload = {
      name?: string;
      bio?: string;
      profile_pic_url?: string;
      cover_photo_url?: string;
    };
    const updateData: UpdatePayload = {}
    if (name) updateData.name = name
    if (bio !== undefined) updateData.bio = bio
    if (profilePicUrl) updateData.profile_pic_url = profilePicUrl
    if (coverPhotoUrl) updateData.cover_photo_url = coverPhotoUrl

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No fields to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Profile update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ data: updatedUser }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
