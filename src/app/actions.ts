'use server';

import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// --- Projects ---

export async function getProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('position', { ascending: true });
    
  if (error) {
    console.error('Error fetching projects:', JSON.stringify(error, null, 2));
    return [];
  }
  return data;
}

export async function createProject(data: { 
  title: string; 
  description?: string; 
  richContent?: string; 
  imageUrl?: string; 
  tags?: string[]; 
  status?: string;
  attachments?: { id: string; url: string; name: string; type: string; size: number }[];
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .insert({
        id: uuidv4(),
        title: data.title,
        description: data.description,
        rich_content: data.richContent, // Maps to snake_case in DB
        image_url: data.imageUrl, // Maps to snake_case in DB
        tags: data.tags,
        attachments: data.attachments,
        status: data.status || 'todo',
        position: 0, 
    });

  if (error) console.error('Error creating project:', error);
  revalidatePath('/');
}

export async function updateProject(id: string, data: any) {
  const supabase = await createClient();
  // Convert camelCase to snake_case for DB
  const dbData: any = {};
  if (data.title !== undefined) dbData.title = data.title;
  if (data.description !== undefined) dbData.description = data.description;
  if (data.richContent !== undefined) dbData.rich_content = data.richContent;
  if (data.imageUrl !== undefined) dbData.image_url = data.imageUrl;
  if (data.tags !== undefined) dbData.tags = data.tags;
  if (data.attachments !== undefined) dbData.attachments = data.attachments;
  if (data.status !== undefined) dbData.status = data.status;
  if (data.position !== undefined) dbData.position = data.position;

  const { error } = await supabase
    .from('projects')
    .update(dbData)
    .eq('id', id);

  if (error) console.error('Error updating project:', error);
  revalidatePath('/');
}

export async function updateProjectStatus(id: string, status: string, position: number) {
  const supabase = await createClient();
  const safePosition = Math.max(0, position);
  
  // Debug log
  console.log(`[updateProjectStatus] ID: ${id}, Status: ${status}, Position: ${safePosition}`);
  
  const { error } = await supabase
    .from('projects')
    .update({ status, position: safePosition })
    .eq('id', id);

  if (error) {
      console.error('Error updating project status:', JSON.stringify(error, null, 2));
  } else {
      console.log(`[updateProjectStatus] Success for ${id}`);
  }
  
  revalidatePath('/');
}

export async function updateColumnOrder(columnId: string, projectIds: string[]) {
  const supabase = await createClient();
  // Batch update all projects in the column to ensure strict ordering and correct status
  for (let i = 0; i < projectIds.length; i++) {
    await supabase
      .from('projects')
      .update({ position: i, status: columnId })
      .eq('id', projectIds[i]);
  }
  revalidatePath('/');
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('Error deleting project:', error);
  revalidatePath('/');
}

// --- Columns ---

export async function getColumns() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('columns')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
     console.error('Error fetching columns:', error);
     return [];
  }

  if (data.length === 0) {
    // Seed default columns if none exist
    const defaults = [
      { id: uuidv4(), title: 'Todo', order: 0 },
      { id: uuidv4(), title: 'In Progress', order: 1 },
      { id: uuidv4(), title: 'Done', order: 2 },
    ];
    const { error: insertError } = await supabase.from('columns').insert(defaults);
    if (insertError) console.error('Error seeding columns:', insertError);
    return defaults;
  }
  return data;
}

export async function createColumn(title: string) {
  const supabase = await createClient();
  const { count } = await supabase.from('columns').select('*', { count: 'exact', head: true });
  const { error } = await supabase.from('columns').insert({
    id: uuidv4(),
    title,
    order: count || 0,
  });
  
  if (error) console.error('Error creating column:', error);
  revalidatePath('/');
}

export async function updateColumn(id: string, title: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('columns').update({ title }).eq('id', id);
  if (error) console.error('Error updating column:', error);
  revalidatePath('/');
}

export async function deleteColumn(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('columns').delete().eq('id', id);
  if (error) console.error('Error deleting column:', error);
  revalidatePath('/');
}

export async function updateColumnsOrder(newOrder: { id: string; order: number }[]) {
  const supabase = await createClient();
  for (const col of newOrder) {
    await supabase.from('columns').update({ order: col.order }).eq('id', col.id);
  }
  revalidatePath('/');
}

// --- Settings ---

export async function getSettings() {
  const supabase = await createClient();
  
  // Debug auth state
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
      console.warn("getSettings: No authenticated user found. Auth Error:", authError?.message || "No user session");
  }

  const { data, error } = await supabase.from('settings').select('*').limit(1).single();
  
  if (data) {
    // Map snake_case to camelCase for frontend
    return {
        id: data.id,
        aiPromptTemplate: data.ai_prompt_template,
        boardTitle: data.board_title,
        cardSize: data.card_size,
    };
  }
  
  // Create default settings if not exists
  const defaultSettings = {
    id: 'default',
    ai_prompt_template: 'A professional, modern project cover image for a project named "{title}". Abstract, minimal, geometric shapes, soft lighting.',
    board_title: 'Project Board',
    card_size: 'medium',
  };
  
  // Try to insert with the user's client first
  const { error: insertError } = await supabase.from('settings').insert(defaultSettings);
  
  if (insertError) {
      // If RLS fails (common for first-time setup or shared settings), try with Admin client
      // This allows the app to self-heal/init even if the specific user doesn't have creation rights
      // for global settings.
      console.log('Creating default settings via Admin client...');
      const adminClient = createServiceRoleClient();
      const { error: adminError } = await adminClient.from('settings').insert(defaultSettings);
      
      if (adminError) {
          console.error('Error creating default settings (Admin):', JSON.stringify(adminError, null, 2));
          // Fallback to in-memory return
          return {
            id: 'default',
            aiPromptTemplate: defaultSettings.ai_prompt_template,
            boardTitle: defaultSettings.board_title,
            cardSize: defaultSettings.card_size,
          };
      }
  }

  return {
    id: 'default',
    aiPromptTemplate: defaultSettings.ai_prompt_template,
    boardTitle: defaultSettings.board_title,
    cardSize: defaultSettings.card_size,
  };
}

export async function updateSettings(data: any) {
  const supabase = await createClient();
  // Get current settings ID
  const { data: current } = await supabase.from('settings').select('id').limit(1).single();
  if (!current) return;

  const dbData: any = {};
  if (data.aiPromptTemplate !== undefined) dbData.ai_prompt_template = data.aiPromptTemplate;
  if (data.boardTitle !== undefined) dbData.board_title = data.boardTitle;
  if (data.cardSize !== undefined) dbData.card_size = data.cardSize;

  const { error } = await supabase.from('settings').update(dbData).eq('id', current.id);
  if (error) console.error('Error updating settings:', error);
  revalidatePath('/');
}

// --- AI & Upload ---

export async function generateProjectImage(projectData: { title: string; description?: string }) {
  const settings = await getSettings();
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  let enhancedPrompt = `${settings.aiPromptTemplate.replace('{title}', projectData.title).replace('{description}', projectData.description || '')}`;
  
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
      const result = await model.generateContent(`Create a short, descriptive image generation prompt based on this context. Keep it under 100 words, focused on visual details. Context: ${enhancedPrompt}`);
      enhancedPrompt = result.response.text();
    } catch (e) {
      console.warn("Gemini generation failed, using raw prompt", e);
    }
  }

  // Clean up prompt for URL
  const encodedPrompt = encodeURIComponent(enhancedPrompt.slice(0, 200).replace(/\n/g, ' ')); // Limit length and remove newlines
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}`;
}

export async function uploadFile(formData: FormData) {
  // Since we are moving to Supabase, ideally we should use Supabase Storage.
  // But to keep changes minimal and matching previous logic (local file system for now or maybe switch to Supabase Storage later),
  // we will keep the local file system logic for now. 
  // WARNING: Local file uploads will NOT work on Netlify (ephemeral file system).
  // We should switch to Supabase Storage for production.
  
  // For this demo, we will return a placeholder or use an external service if possible.
  // Or better, let's try to use Supabase Storage if a bucket exists.
  
  // FALLBACK: Use the existing local logic but warn it won't persist on Netlify.
  
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file uploaded');
  }

  // Convert file to array buffer immediately to avoid passing File object further down if not needed
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // Fallback to .jpg if no extension (e.g. pasted blobs often don't have one)
  const ext = path.extname(file.name) || '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const filepath = path.join(uploadDir, filename);

  // Ensure upload directory exists
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
  }

  await writeFile(filepath, buffer);
  
  return {
    id: uuidv4(),
    url: `/uploads/${filename}`,
    name: file.name || 'pasted-image.jpg',
    type: file.type || 'image/jpeg',
    size: file.size
  };
}

// Keep for backward compatibility if needed, but uploadFile is preferred
export async function uploadProjectImage(formData: FormData) {
    const result = await uploadFile(formData);
    return result.url;
}

export async function uploadImageBase64(base64Data: string, fileName: string, fileType: string) {
  try {
    if (!base64Data || !base64Data.includes(',')) {
        throw new Error('Invalid base64 data received');
    }

    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    const ext = path.extname(fileName) || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filepath = path.join(uploadDir, filename);

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Ignore error if directory already exists
    }

    await writeFile(filepath, buffer);
    
    return `/uploads/${filename}`;
  } catch (error: any) {
    console.error('[Server] Upload failed:', error);
    throw new Error(`Server upload failed: ${error.message}`);
  }
}
