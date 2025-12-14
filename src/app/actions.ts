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
  
  // Debug: Log what we're getting from the database
  if (data && data.length > 0) {
    console.log('[Server] Fetched projects. Sample materials_list:', data[0]?.materials_list);
  }
  
  return data;
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return null;
  }
  
  console.log('[Server] Fetched single project:', {
    id: data?.id,
    title: data?.title,
    materials_list: data?.materials_list,
    materials_list_type: typeof data?.materials_list
  });
  
  return data;
}

export async function createProject(data: { 
  title: string; 
  description?: string; 
  richContent?: string; 
  materialsList?: any;
  plans?: any;
  inspiration?: any;
  imageUrl?: string; 
  tags?: string[]; 
  status?: string;
  position?: number;
  attachments?: { id: string; url: string; name: string; type: string; size: number }[];
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .insert({
        id: uuidv4(),
        title: data.title,
        description: data.description,
        rich_content: data.richContent,
        materials_list: JSON.stringify(data.materialsList || []), 
        plans: JSON.stringify(data.plans || []), // Convert to JSON
        inspiration: JSON.stringify(data.inspiration || []), // Convert to JSON
        image_url: data.imageUrl,
        tags: data.tags,
        attachments: data.attachments,
        status: data.status || 'todo',
        position: data.position ?? 0, 
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
  if (data.materialsList !== undefined) {
    dbData.materials_list = JSON.stringify(data.materialsList);
    console.log('[Server] Saving materialsList:', data.materialsList, '-> JSON:', dbData.materials_list);
  }
  if (data.plans !== undefined) dbData.plans = JSON.stringify(data.plans);
  if (data.inspiration !== undefined) dbData.inspiration = JSON.stringify(data.inspiration);
  if (data.imageUrl !== undefined) dbData.image_url = data.imageUrl;
  if (data.tags !== undefined) dbData.tags = data.tags;
  if (data.attachments !== undefined) dbData.attachments = data.attachments;
  if (data.status !== undefined) dbData.status = data.status;
  if (data.position !== undefined) dbData.position = data.position;

  console.log('[Server] Updating project', id, 'with data:', dbData);

  const { error } = await supabase
    .from('projects')
    .update(dbData)
    .eq('id', id);

  if (error) {
    console.error('Error updating project:', error);
  } else {
    console.log('[Server] Project updated successfully');
  }
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
        visibleProjects: data.visible_projects || [],
        visibleTags: data.visible_tags || [],
        hiddenProjects: data.hidden_projects || [],
        hiddenTags: data.hidden_tags || [],
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
  if (data.visibleProjects !== undefined) dbData.visible_projects = data.visibleProjects;
  if (data.visibleTags !== undefined) dbData.visible_tags = data.visibleTags;
  if (data.hiddenProjects !== undefined) dbData.hidden_projects = data.hiddenProjects;
  if (data.hiddenTags !== undefined) dbData.hidden_tags = data.hiddenTags;

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
  const supabase = await createClient();
  const file = formData.get('file') as File;
  
  if (!file) {
    throw new Error('No file uploaded');
  }

  const fileExt = path.extname(file.name) || '.jpg';
  const fileName = `${uuidv4()}${fileExt}`;
  
  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('board-uploads')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Supabase upload error:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('board-uploads')
    .getPublicUrl(fileName);

  return {
    id: uuidv4(),
    url: publicUrl,
    name: file.name || 'uploaded-file',
    type: file.type || 'application/octet-stream',
    size: file.size
  };
}

// Keep for backward compatibility if needed, but uploadFile is preferred
export async function uploadProjectImage(formData: FormData) {
    const result = await uploadFile(formData);
    return result.url;
}

export async function uploadImageBase64(base64Data: string, fileName: string, fileType: string) {
  const supabase = await createClient();
  try {
    if (!base64Data || !base64Data.includes(',')) {
        throw new Error('Invalid base64 data received');
    }

    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    const ext = path.extname(fileName) || '.jpg';
    const storageFileName = `${uuidv4()}${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('board-uploads')
      .upload(storageFileName, buffer, {
        contentType: fileType || 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error(`Server upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('board-uploads')
      .getPublicUrl(storageFileName);
      
    return publicUrl;
  } catch (error: any) {
    console.error('[Server] Upload failed:', error);
    throw new Error(`Server upload failed: ${error.message}`);
  }
}

// --- Media Management ---

export async function getAllMediaFiles() {
  try {
    const supabase = await createClient();
    
    // Get all projects with their media
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, image_url, inspiration, plans');
    
    if (error) {
      console.error('Error fetching projects for media:', error);
      return [];
    }
    
    // Collect all media URLs and track which projects use them
    const mediaMap = new Map<string, {
      url: string;
      name: string;
      type: string;
      size: number;
      usedBy: string[];
    }>();
    
    projects.forEach(project => {
      // Cover images
      if (project.image_url) {
        if (!mediaMap.has(project.image_url)) {
          mediaMap.set(project.image_url, {
            url: project.image_url,
            name: extractFileName(project.image_url),
            type: 'image/jpeg',
            size: 0,
            usedBy: []
          });
        }
        mediaMap.get(project.image_url)!.usedBy.push(project.id);
      }
      
      // Inspiration images
      if (project.inspiration) {
        const inspiration = typeof project.inspiration === 'string' 
          ? JSON.parse(project.inspiration) 
          : project.inspiration;
        
        if (Array.isArray(inspiration)) {
          inspiration.forEach((item: any) => {
            if (item.url) {
              if (!mediaMap.has(item.url)) {
                mediaMap.set(item.url, {
                  url: item.url,
                  name: item.name || extractFileName(item.url),
                  type: item.type || 'image/jpeg',
                  size: item.size || 0,
                  usedBy: []
                });
              }
              mediaMap.get(item.url)!.usedBy.push(project.id);
            }
          });
        }
      }
      
      // Plans/sketches
      if (project.plans) {
        const plans = typeof project.plans === 'string' 
          ? JSON.parse(project.plans) 
          : project.plans;
        
        if (Array.isArray(plans)) {
          plans.forEach((item: any) => {
            if (item.url) {
              if (!mediaMap.has(item.url)) {
                mediaMap.set(item.url, {
                  url: item.url,
                  name: item.name || extractFileName(item.url),
                  type: item.type || 'image/jpeg',
                  size: item.size || 0,
                  usedBy: []
                });
              }
              mediaMap.get(item.url)!.usedBy.push(project.id);
            }
          });
        }
      }
    });
    
    return Array.from(mediaMap.values());
  } catch (error) {
    console.error('Error getting all media files:', error);
    return [];
  }
}

export async function deleteMediaFile(fileUrl: string) {
  try {
    const supabase = await createClient();
    
    // Extract the file name from the URL
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('board-uploads')
      .remove([fileName]);
    
    if (storageError) {
      console.error('Error deleting from storage:', storageError);
      throw new Error('Failed to delete file from storage');
    }
    
    // Get all projects that might use this file
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('id, image_url, inspiration, plans');
    
    if (fetchError) {
      console.error('Error fetching projects:', fetchError);
      return;
    }
    
    // Remove the file URL from all projects
    for (const project of projects) {
      let updated = false;
      const updates: any = {};
      
      // Remove from cover image
      if (project.image_url === fileUrl) {
        updates.image_url = null;
        updated = true;
      }
      
      // Remove from inspiration
      if (project.inspiration) {
        const inspiration = typeof project.inspiration === 'string'
          ? JSON.parse(project.inspiration)
          : project.inspiration;
        
        if (Array.isArray(inspiration)) {
          const filtered = inspiration.filter((item: any) => item.url !== fileUrl);
          if (filtered.length !== inspiration.length) {
            updates.inspiration = JSON.stringify(filtered);
            updated = true;
          }
        }
      }
      
      // Remove from plans
      if (project.plans) {
        const plans = typeof project.plans === 'string'
          ? JSON.parse(project.plans)
          : project.plans;
        
        if (Array.isArray(plans)) {
          const filtered = plans.filter((item: any) => item.url !== fileUrl);
          if (filtered.length !== plans.length) {
            updates.plans = JSON.stringify(filtered);
            updated = true;
          }
        }
      }
      
      // Update the project if needed
      if (updated) {
        await supabase
          .from('projects')
          .update(updates)
          .eq('id', project.id);
      }
    }
    
    revalidatePath('/');
  } catch (error) {
    console.error('Error deleting media file:', error);
    throw error;
  }
}

function extractFileName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1] || 'unknown';
}

// --- Tags ---

export async function getAllTags() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
  
  return data;
}

export async function createTag(tag: { name: string; color: string; emoji?: string; icon?: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('tags')
    .insert(tag);
  
  if (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
  
  revalidatePath('/');
}

export async function updateTag(name: string, updates: { color?: string; emoji?: string; icon?: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('tags')
    .update(updates)
    .eq('name', name);
  
  if (error) {
    console.error('Error updating tag:', error);
    throw error;
  }
  
  revalidatePath('/');
}

export async function deleteTag(name: string) {
  const supabase = await createClient();
  
  // Remove tag from all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, tags');
  
  if (projects) {
    for (const project of projects) {
      if (project.tags && project.tags.includes(name)) {
        const newTags = project.tags.filter((t: string) => t !== name);
        await supabase
          .from('projects')
          .update({ tags: newTags })
          .eq('id', project.id);
      }
    }
  }
  
  // Delete the tag
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('name', name);
  
  if (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
  
  revalidatePath('/');
}

// --- Project Groups ---

export async function getAllProjectGroups() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('project_groups')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching project groups:', error);
    return [];
  }
  
  return data;
}

export async function createProjectGroup(group: { name: string; color: string; emoji?: string; icon?: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('project_groups')
    .insert({
      id: uuidv4(),
      ...group,
    });
  
  if (error) {
    console.error('Error creating project group:', error);
    throw error;
  }
  
  revalidatePath('/');
}

export async function updateProjectGroup(id: string, updates: { name?: string; color?: string; emoji?: string; icon?: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('project_groups')
    .update(updates)
    .eq('id', id);
  
  if (error) {
    console.error('Error updating project group:', error);
    throw error;
  }
  
  revalidatePath('/');
}

export async function deleteProjectGroup(id: string) {
  const supabase = await createClient();
  
  // Remove parent_project_id from all projects in this group
  await supabase
    .from('projects')
    .update({ parent_project_id: null })
    .eq('parent_project_id', id);
  
  // Delete the project group
  const { error } = await supabase
    .from('project_groups')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting project group:', error);
    throw error;
  }
  
  revalidatePath('/');
}
