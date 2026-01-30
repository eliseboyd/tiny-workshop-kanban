'use server';

import { createServiceRoleClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash, randomBytes } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Helper function to download image from URL and upload to Supabase
async function downloadAndUploadImage(imageUrl: string): Promise<string | null> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return null;
    }
    
    // Get the image as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Determine file extension from content-type or URL
    const contentType = response.headers.get('content-type');
    let fileExt = '.jpg';
    if (contentType?.includes('png')) fileExt = '.png';
    else if (contentType?.includes('webp')) fileExt = '.webp';
    else if (contentType?.includes('gif')) fileExt = '.gif';
    else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) fileExt = '.jpg';
    
    const fileName = `og-${uuidv4()}${fileExt}`;
    
    // Upload to Supabase Storage
    const supabase = createServiceRoleClient();
    const { error: uploadError } = await supabase.storage
      .from('board-uploads')
      .upload(fileName, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType || 'image/jpeg'
      });
    
    if (uploadError) {
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('board-uploads')
      .getPublicUrl(fileName);
    
    return publicUrl;
  } catch (error) {
    return null;
  }
}

// Helper function to clean URLs by removing unnecessary query parameters
function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // List of query parameters to remove (tracking, tokens, etc.)
    const paramsToRemove = [
      'mcp_token',       // MakerWorld authentication token
      'utm_source',      // UTM tracking
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',             // Referral tracking
      'referrer',
      'source',
      'fbclid',          // Facebook tracking
      'gclid',           // Google tracking
      'msclkid',         // Microsoft tracking
    ];
    
    // Remove specified parameters
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Return cleaned URL (keep hash fragments like #profileId-312104)
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original
    return url;
  }
}

// Helper function to clean URLs in HTML content
function cleanUrlsInHtml(html: string): string {
  // Clean href attributes
  html = html.replace(/href=["']([^"']+)["']/gi, (match, url) => {
    if (url.startsWith('http')) {
      const cleanedUrl = cleanUrl(url);
      return `href="${cleanedUrl}"`;
    }
    return match;
  });
  
  // Clean plain text URLs
  html = html.replace(/(https?:\/\/[^\s<>"']+)/gi, (url) => {
    return cleanUrl(url);
  });
  
  return html;
}

// Helper function to extract Open Graph image from a URL
async function fetchOpenGraphImage(url: string): Promise<string | null> {
  try {
    // Clean the URL before fetching
    const cleanedUrl = cleanUrl(url);
    
    // Special handling for MakerWorld - they have strong bot protection
    if (cleanedUrl.includes('makerworld.com')) {
      return null;
    }
    
    // Use native https module with increased header size limit
    const https = require('https');
    const urlObj = new URL(cleanedUrl);
    
    const html = await new Promise<string>((resolve, reject) => {
      const req = https.get({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Referer': urlObj.origin,
        },
        maxHeaderSize: 32768, // Increase to 32KB to handle large headers
      }, (res: any) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          reject(new Error(`Redirect not followed: ${res.statusCode}`));
          return;
        }
        
        // Some sites may block server requests - fail gracefully
        if (res.statusCode === 403) {
          resolve(''); // Return empty string instead of error
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => resolve(data));
      });
      
      req.on('error', reject);
      req.end();
    });
    
    if (!html) {
      return null;
    }
    
    // Check if there's ANY og:image meta tag
    const hasOgImage = html.includes('og:image');
    const hasTwitterImage = html.includes('twitter:image');
    
    if (!hasOgImage && !hasTwitterImage) {
      return null;
    }
    
    // Try multiple meta tag patterns
    const patterns = [
      // Standard og:image with property
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
      // og:image with name (Printables uses this)
      /<meta[^>]*name=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']og:image["'][^>]*>/i,
      // Twitter image
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*>/i,
      // og:image:secure_url
      /<meta[^>]*property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image:secure_url["'][^>]*>/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];
        
        // Handle relative URLs
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          const urlObj = new URL(url);
          imageUrl = urlObj.origin + imageUrl;
        }
        
        return imageUrl;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to extract URLs from text
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const urls = text.match(urlRegex) || [];
  // Clean URLs before returning
  return urls.map(url => cleanUrl(url));
}

// Helper function to extract URLs from HTML content
function extractUrlsFromHtml(html: string): string[] {
  // Extract from href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(hrefRegex)];
  const urls = matches.map(m => m[1]).filter(url => url.startsWith('http'));
  
  // Also extract plain URLs from text content
  const textUrls = extractUrls(html);
  
  // Combine and clean all URLs
  const allUrls = [...new Set([...urls, ...textUrls])];
  return allUrls.map(url => cleanUrl(url));
}

// Helper function to extract image URL from specific platforms
function extractPlatformImage(url: string): string | null {
  try {
    // YouTube - extract video ID and get thumbnail
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (youtubeMatch) {
      return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`;
    }
    
    // MakerWorld - Since they block scraping, return null and let user manually set image
    // We could potentially add API support or image URL construction in the future
    // For now, the "From Link" button can be used to manually trigger image fetch
    
    // For other platforms, rely on OG tag fetching
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to process link with AI and metadata
export async function processLinkWithAI(url: string) {
  const cleanedUrl = cleanUrl(url);
  const ogImage = await fetchOpenGraphImage(cleanedUrl);

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { url: cleanedUrl, image: ogImage };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Analyze this URL and provide a JSON response with suggested metadata:
URL: ${cleanedUrl}

Return ONLY valid JSON with this structure:
{
  "title": "suggested title",
  "description": "brief description",
  "suggestedTags": ["tag1", "tag2"],
  "contentType": "tutorial|product|inspiration|article|video|other"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const normalized = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(normalized);

    return {
      url: cleanedUrl,
      image: ogImage,
      ...parsed,
    };
  } catch (error) {
    console.error('AI processing failed:', error);
    return { url: cleanedUrl, image: ogImage };
  }
}

// --- Projects ---

export async function getProjects() {
  // Use service role client to bypass RLS for server-side reads
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .or('is_idea.is.null,is_idea.eq.false')
    .order('position', { ascending: true });
    
  if (error) {
    console.error('Error fetching projects:', JSON.stringify(error, null, 2));
    return [];
  }
  
  return data;
}

export async function getIdeas() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_idea', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching ideas:', JSON.stringify(error, null, 2));
    return [];
  }

  return data;
}

export async function getProject(id: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return null;
  }
  
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
  is_task?: boolean;
}) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('projects')
    .insert({
        id: uuidv4(),
        title: data.title,
        description: data.description,
        rich_content: data.richContent ? cleanUrlsInHtml(data.richContent) : data.richContent,
        materials_list: JSON.stringify(data.materialsList || []), 
        plans: JSON.stringify(data.plans || []), // Convert to JSON
        inspiration: JSON.stringify(data.inspiration || []), // Convert to JSON
        image_url: data.imageUrl,
        tags: data.tags,
        attachments: data.attachments,
        status: data.status || 'todo',
        position: data.position ?? 0,
        is_task: data.is_task || false,
        is_idea: false,
    });

  if (error) console.error('Error creating project:', error);
  revalidatePath('/');
}

export async function createIdea(data: {
  title: string;
  description?: string;
  url?: string;
  tags?: string[];
}) {
  const supabase = createServiceRoleClient();
  const id = uuidv4();

  const cleanedUrl = data.url ? cleanUrl(data.url) : undefined;
  let imageUrl = null;

  if (cleanedUrl) {
    const ogImage = await fetchOpenGraphImage(cleanedUrl);
    if (ogImage) {
      imageUrl = await downloadAndUploadImage(ogImage);
    }
  }

  const { data: idea, error } = await supabase
    .from('projects')
    .insert({
      id,
      title: data.title,
      description: data.description,
      rich_content: cleanedUrl ? `<p><a href="${cleanedUrl}">${cleanedUrl}</a></p>` : null,
      image_url: imageUrl,
      tags: data.tags || [],
      status: 'todo',
      position: 0,
      is_task: false,
      is_idea: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating idea:', JSON.stringify(error, null, 2));
    return null;
  }

  revalidatePath('/');
  return idea;
}

export async function updateProject(id: string, data: any) {
  const supabase = createServiceRoleClient();
  
  // Check if we should fetch an Open Graph image
  let shouldFetchOgImage = false;
  let urlsToCheck: string[] = [];
  
  // Get current project to check if it has a cover image
  const { data: currentProject } = await supabase
    .from('projects')
    .select('image_url, title, rich_content')
    .eq('id', id)
    .single();
  
  const hasNoCoverImage = !currentProject?.image_url && data.imageUrl === undefined;
  
  if (hasNoCoverImage) {
    // Check if title or richContent has been updated with a URL
    if (data.title !== undefined) {
      urlsToCheck.push(...extractUrls(data.title));
    }
    if (data.richContent !== undefined) {
      urlsToCheck.push(...extractUrlsFromHtml(data.richContent));
    }
    
    // If no new URLs, check existing content
    if (urlsToCheck.length === 0) {
      if (currentProject?.title) {
        urlsToCheck.push(...extractUrls(currentProject.title));
      }
      if (currentProject?.rich_content) {
        urlsToCheck.push(...extractUrlsFromHtml(currentProject.rich_content));
      }
    }
    
    shouldFetchOgImage = urlsToCheck.length > 0;
  }
  
  // Convert camelCase to snake_case for DB
  const dbData: any = {};
  if (data.title !== undefined) dbData.title = data.title;
  if (data.description !== undefined) dbData.description = data.description;
  if (data.richContent !== undefined) {
    // Clean URLs in rich content before saving
    dbData.rich_content = cleanUrlsInHtml(data.richContent);
  }
  if (data.materialsList !== undefined) {
    dbData.materials_list = JSON.stringify(data.materialsList);
  }
  if (data.plans !== undefined) dbData.plans = JSON.stringify(data.plans);
  if (data.inspiration !== undefined) dbData.inspiration = JSON.stringify(data.inspiration);
  if (data.imageUrl !== undefined) dbData.image_url = data.imageUrl;
  if (data.tags !== undefined) dbData.tags = data.tags;
  if (data.attachments !== undefined) dbData.attachments = data.attachments;
  if (data.status !== undefined) dbData.status = data.status;
  if (data.position !== undefined) dbData.position = data.position;
  if (data.parent_project_id !== undefined) dbData.parent_project_id = data.parent_project_id;
  if (data.is_task !== undefined) dbData.is_task = data.is_task;
  if (data.is_completed !== undefined) dbData.is_completed = data.is_completed;
  if (data.is_idea !== undefined) dbData.is_idea = data.is_idea;
  
  // Try to fetch Open Graph image if needed
  if (shouldFetchOgImage && urlsToCheck.length > 0) {
    for (const url of urlsToCheck) {
      // First try platform-specific extraction
      const platformImage = extractPlatformImage(url);
      if (platformImage) {
        const uploadedUrl = await downloadAndUploadImage(platformImage);
        if (uploadedUrl) {
          dbData.image_url = uploadedUrl;
          break;
        }
      }
      
      // Fall back to OG tag extraction
      const ogImage = await fetchOpenGraphImage(url);
      if (ogImage) {
        const uploadedUrl = await downloadAndUploadImage(ogImage);
        if (uploadedUrl) {
          dbData.image_url = uploadedUrl;
          break; // Use the first successful OG image found
        }
      }
    }
  }

  const { error } = await supabase
    .from('projects')
    .update(dbData)
    .eq('id', id);

  if (error) {
    console.error('Error updating project:', error);
  }
  revalidatePath('/');
}

// Manual action to fetch OG image from project content
export async function fetchAndSetOgImage(projectId: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const supabase = createServiceRoleClient();
    
    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('title, rich_content')
      .eq('id', projectId)
      .single();
    
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    
    // Extract URLs from title and content
    const urlsToCheck: string[] = [];
    if (project.title) {
      const titleUrls = extractUrls(project.title);
      urlsToCheck.push(...titleUrls);
    }
    if (project.rich_content) {
      const contentUrls = extractUrlsFromHtml(project.rich_content);
      urlsToCheck.push(...contentUrls);
    }
    
    if (urlsToCheck.length === 0) {
      return { success: false, error: 'No URLs found in project' };
    }
    
    // Try to fetch OG image
    for (const url of urlsToCheck) {
      // Try platform-specific first
      const platformImage = extractPlatformImage(url);
      if (platformImage) {
        const uploadedUrl = await downloadAndUploadImage(platformImage);
        if (uploadedUrl) {
          await supabase
            .from('projects')
            .update({ image_url: uploadedUrl })
            .eq('id', projectId);
          
          revalidatePath('/');
          return { success: true, imageUrl: uploadedUrl };
        }
      }
      
      // Try OG tags
      const ogImage = await fetchOpenGraphImage(url);
      if (ogImage) {
        const uploadedUrl = await downloadAndUploadImage(ogImage);
        if (uploadedUrl) {
          await supabase
            .from('projects')
            .update({ image_url: uploadedUrl })
            .eq('id', projectId);
          
          revalidatePath('/');
          return { success: true, imageUrl: uploadedUrl };
        }
      }
    }
    
    return { success: false, error: 'No OG image found' };
  } catch (error) {
    console.error('[fetchAndSetOgImage] Error:', error);
    return { success: false, error: 'Failed to fetch OG image' };
  }
}

export async function updateProjectStatus(id: string, status: string, position: number) {
  const supabase = createServiceRoleClient();
  const safePosition = Math.max(0, position);
  
  // Check if the status/column is a "done" column
  const { data: column } = await supabase
    .from('columns')
    .select('title')
    .eq('id', status)
    .single();
  
  const isDoneColumn = column?.title?.toLowerCase().includes('done') || 
                       column?.title?.toLowerCase().includes('completed') ||
                       column?.title?.toLowerCase().includes('complete');
  
  const updateData: any = { status, position: safePosition };
  if (isDoneColumn !== undefined) {
    updateData.is_completed = isDoneColumn;
  }
  
  const { error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating project status:', JSON.stringify(error, null, 2));
  }
  
  revalidatePath('/');
}

export async function moveIdeaToKanban(ideaId: string, status: string) {
  const supabase = createServiceRoleClient();

  const { data: columnProjects } = await supabase
    .from('projects')
    .select('position')
    .eq('status', status)
    .or('is_idea.is.null,is_idea.eq.false');

  const maxPosition = columnProjects?.length || 0;

  const { error } = await supabase
    .from('projects')
    .update({
      is_idea: false,
      status,
      position: maxPosition,
    })
    .eq('id', ideaId);

  if (error) {
    console.error('Error moving idea to kanban:', JSON.stringify(error, null, 2));
  }

  revalidatePath('/');
}

export async function getQuickAddTokenStatus() {
  const supabase = createServiceRoleClient();
  const authed = await createClient();
  const { data: { user } } = await authed.auth.getUser();

  if (!user) {
    return { exists: false, createdAt: null as string | null };
  }

  const { data, error } = await supabase
    .from('quick_add_tokens')
    .select('created_at')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return { exists: false, createdAt: null as string | null };
  }

  return { exists: true, createdAt: data.created_at as string };
}

export async function createQuickAddToken() {
  const supabase = createServiceRoleClient();
  const authed = await createClient();
  const { data: { user } } = await authed.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = `qa_${randomBytes(24).toString('hex')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { error } = await supabase
    .from('quick_add_tokens')
    .upsert({
      user_id: user.id,
      token_hash: tokenHash,
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving quick add token:', JSON.stringify(error, null, 2));
    throw new Error('Failed to save token');
  }

  return { token };
}

export async function toggleProjectPinned(id: string, pinned: boolean) {
  const supabase = createServiceRoleClient();
  
  const { error } = await supabase
    .from('projects')
    .update({ pinned })
    .eq('id', id);

  if (error) {
    console.error('Error toggling project pinned:', error);
  }
  
  revalidatePath('/');
}

// Toggle project completion - moves to Done column or back to first column
// Move project from Done to In Progress when new unchecked todos are added
export async function moveProjectFromDoneIfNeeded(projectId: string) {
  const supabase = createServiceRoleClient();
  
  // Get the project's current status
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('status')
    .eq('id', projectId)
    .single();
  
  if (projectError || !project) {
    console.error('Error fetching project:', projectError);
    return;
  }
  
  // Get all columns
  const { data: columns, error: colError } = await supabase
    .from('columns')
    .select('*')
    .order('order', { ascending: true });
  
  if (colError || !columns || columns.length === 0) {
    console.error('Error fetching columns:', colError);
    return;
  }
  
  // Find the Done column
  const doneColumn = columns.find(c => 
    c.title.toLowerCase() === 'done' || 
    c.title.toLowerCase() === 'completed'
  );
  
  // Check if project is in Done column
  if (!doneColumn || project.status !== doneColumn.id) {
    return; // Project is not in Done, no need to move
  }
  
  // Find "In Progress" or similar column
  const inProgressColumn = columns.find(c => 
    c.title.toLowerCase() === 'in progress' || 
    c.title.toLowerCase() === 'in-progress' ||
    c.title.toLowerCase() === 'doing' ||
    c.title.toLowerCase() === 'working'
  );
  
  // If no In Progress column, use the second column, or first if only one column
  const targetColumn = inProgressColumn || columns[Math.min(1, columns.length - 1)];
  
  // Get max position in target column
  const { data: projectsInColumn } = await supabase
    .from('projects')
    .select('position')
    .eq('status', targetColumn.id)
    .order('position', { ascending: false })
    .limit(1);
  
  const newPosition = projectsInColumn && projectsInColumn.length > 0 
    ? projectsInColumn[0].position + 1 
    : 0;
  
  const { error } = await supabase
    .from('projects')
    .update({ status: targetColumn.id, position: newPosition })
    .eq('id', projectId);
  
  if (error) {
    console.error('Error moving project from Done:', error);
  }
  
  revalidatePath('/');
}

export async function toggleProjectCompletion(projectId: string, currentStatus: string) {
  const supabase = createServiceRoleClient();
  
  // Get all columns to find Done column and first column
  const { data: columns, error: colError } = await supabase
    .from('columns')
    .select('*')
    .order('order', { ascending: true });
  
  if (colError || !columns || columns.length === 0) {
    console.error('Error fetching columns:', colError);
    return;
  }
  
  // Find the Done column (case-insensitive)
  const doneColumn = columns.find(c => 
    c.title.toLowerCase() === 'done' || 
    c.title.toLowerCase() === 'completed'
  );
  
  // First column as fallback for uncompleting
  const firstColumn = columns[0];
  
  // Check if project is currently in the Done column
  const isCurrentlyDone = doneColumn && currentStatus === doneColumn.id;
  
  let targetColumnId: string;
  
  if (isCurrentlyDone) {
    // Move back to first column (uncomplete)
    targetColumnId = firstColumn.id;
  } else {
    // Move to Done column (or first column if no Done column exists)
    targetColumnId = doneColumn?.id || firstColumn.id;
  }
  
  // Get count of projects in target column to set position at end
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', targetColumnId);
  
  const newPosition = count || 0;
  
  const { error } = await supabase
    .from('projects')
    .update({ status: targetColumnId, position: newPosition })
    .eq('id', projectId);
  
  if (error) {
    console.error('Error toggling project completion:', error);
  }
  
  revalidatePath('/');
}

export async function updateColumnOrder(columnId: string, projectIds: string[]) {
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('Error deleting project:', error);
  revalidatePath('/');
}

// --- Columns ---

export async function getColumns() {
  // Use service role client to bypass RLS for server-side reads
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('columns').update({ title }).eq('id', id);
  if (error) console.error('Error updating column:', error);
  revalidatePath('/');
}

export async function deleteColumn(id: string) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('columns').delete().eq('id', id);
  if (error) console.error('Error deleting column:', error);
  revalidatePath('/');
}

export async function updateColumnsOrder(newOrder: { id: string; order: number }[]) {
  const supabase = createServiceRoleClient();
  for (const col of newOrder) {
    await supabase.from('columns').update({ order: col.order }).eq('id', col.id);
  }
  revalidatePath('/');
}

// --- Settings ---

export async function getSettings() {
  // Use service role client to bypass RLS for server-side reads
  const supabase = createServiceRoleClient();

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
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
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
    const supabase = createServiceRoleClient();
    
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
    const supabase = createServiceRoleClient();
    
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
  // Use service role client to bypass RLS for server-side reads
  const supabase = createServiceRoleClient();
  
  // Get all tags from the tags table
  const { data: tagsData, error: tagsError } = await supabase
    .from('tags')
    .select('*')
    .order('name');
  
  if (tagsError) {
    console.error('Error fetching tags:', tagsError);
  }
  
  // Get all unique tags from projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('tags');
  
  if (projectsError) {
    console.error('Error fetching project tags:', projectsError);
  }
  
  // Collect all unique tags from projects
  const projectTagsSet = new Set<string>();
  projects?.forEach(project => {
    project.tags?.forEach((tag: string) => projectTagsSet.add(tag));
  });
  
  // Create a map of existing tags
  const tagsMap = new Map<string, any>();
  tagsData?.forEach(tag => {
    tagsMap.set(tag.name, tag);
  });
  
  // Add project tags that don't exist in tags table yet
  projectTagsSet.forEach(tagName => {
    if (!tagsMap.has(tagName)) {
      tagsMap.set(tagName, {
        name: tagName,
        color: '#64748b',
        emoji: null,
        icon: null,
      });
    }
  });
  
  // Return all tags sorted by name
  return Array.from(tagsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createTag(tag: { name: string; color: string; emoji?: string; icon?: string }) {
  const supabase = createServiceRoleClient();
  
  // Check if tag already exists
  const { data: existing } = await supabase
    .from('tags')
    .select('name')
    .eq('name', tag.name)
    .single();
  
  if (existing) {
    // Tag already exists, just update it
    return updateTag(tag.name, { color: tag.color, emoji: tag.emoji, icon: tag.icon });
  }
  
  const { error } = await supabase
    .from('tags')
    .insert(tag);
  
  if (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
  
  revalidatePath('/');
}

// Auto-create tag if it doesn't exist (called when adding tags to projects)
export async function ensureTagExists(tagName: string) {
  const supabase = createServiceRoleClient();
  
  // Check if tag exists
  const { data: existing } = await supabase
    .from('tags')
    .select('name')
    .eq('name', tagName)
    .single();
  
  if (!existing) {
    // Create tag with default values
    await supabase
      .from('tags')
      .insert({
        name: tagName,
        color: '#64748b',
        emoji: null,
        icon: null,
      });
  }
}

export async function updateTag(name: string, updates: { color?: string; emoji?: string; icon?: string }) {
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
  
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
  // Use service role client to bypass RLS for server-side reads
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
  
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

// --- Dashboard Widgets ---

export async function getAllWidgets() {
  // Use service role client to bypass RLS for server-side reads
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('widgets')
    .select('*')
    .order('position', { ascending: true });
  
  if (error) {
    console.error('Error fetching widgets:', error);
    return [];
  }
  
  return data;
}

export async function createWidget(widget: { 
  type: string; 
  title: string; 
  config: Record<string, any>;
  position?: number;
}) {
  const supabase = createServiceRoleClient();
  
  // Get the highest position
  const { data: existing } = await supabase
    .from('widgets')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);
  
  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;
  
  const { error } = await supabase
    .from('widgets')
    .insert({
      id: uuidv4(),
      type: widget.type,
      title: widget.title,
      config: widget.config,
      position: widget.position ?? nextPosition,
    });
  
  if (error) {
    console.error('Error creating widget:', error);
    throw error;
  }
  
  revalidatePath('/');
}

export async function updateWidget(id: string, updates: { 
  title?: string; 
  config?: Record<string, any>;
  position?: number;
}) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('widgets')
    .update(updates)
    .eq('id', id);
  
  if (error) {
    console.error('Error updating widget:', error);
    throw error;
  }
  
  revalidatePath('/');
}

export async function deleteWidget(id: string) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('widgets')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting widget:', error);
    throw error;
  }
  
  revalidatePath('/');
}

export async function reorderWidgets(widgetIds: string[]) {
  const supabase = createServiceRoleClient();
  
  for (let i = 0; i < widgetIds.length; i++) {
    await supabase
      .from('widgets')
      .update({ position: i })
      .eq('id', widgetIds[i]);
  }
  
  revalidatePath('/');
}

// Get all materials across all projects (for shopping widget)
export async function getAllMaterials() {
  // Use service role client to bypass RLS for server-side reads
  const supabase = createServiceRoleClient();
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, tags, parent_project_id, materials_list');
  
  if (error) {
    console.error('Error fetching projects for materials:', error);
    return [];
  }
  
  const materials: Array<{
    id: string;
    text: string;
    toBuy: boolean;
    toBuild: boolean;
    projectId: string;
    projectTitle: string;
    projectTags: string[];
    parentProjectId: string | null;
  }> = [];
  
  projects.forEach(project => {
    let materialsList: any[] = [];
    
    try {
      if (project.materials_list) {
        materialsList = typeof project.materials_list === 'string'
          ? JSON.parse(project.materials_list)
          : project.materials_list;
      }
    } catch (e) {
      console.error('Failed to parse materials_list for project:', project.id);
    }
    
    if (Array.isArray(materialsList)) {
      materialsList.forEach(material => {
        materials.push({
          id: material.id,
          text: material.text,
          toBuy: material.toBuy || false,
          toBuild: material.toBuild || false,
          projectId: project.id,
          projectTitle: project.title,
          projectTags: project.tags || [],
          parentProjectId: project.parent_project_id,
        });
      });
    }
  });
  
  return materials;
}

// --- Standalone Plans ---

export type StandalonePlan = {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  projectId: string | null;
  projectTitle?: string;
  notes: string | null;
  createdAt: Date;
};

export async function getStandalonePlans(): Promise<StandalonePlan[]> {
  const supabase = createServiceRoleClient();
  
  // Get standalone plans with project info
  const { data, error } = await supabase
    .from('standalone_plans')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching standalone plans:', error);
    return [];
  }
  
  // Get project titles for assigned plans
  const projectIds = [...new Set(data.filter(p => p.project_id).map(p => p.project_id))];
  let projectTitles: Record<string, string> = {};
  
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title')
      .in('id', projectIds);
    
    if (projects) {
      projectTitles = Object.fromEntries(projects.map(p => [p.id, p.title]));
    }
  }
  
  return data.map(plan => ({
    id: plan.id,
    url: plan.url,
    name: plan.name,
    type: plan.type,
    size: plan.size,
    projectId: plan.project_id,
    projectTitle: plan.project_id ? projectTitles[plan.project_id] : undefined,
    notes: plan.notes,
    createdAt: new Date(plan.created_at),
  }));
}

export async function createStandalonePlan(data: {
  url: string;
  name: string;
  type: string;
  size: number;
  projectId?: string | null;
  notes?: string;
}) {
  const supabase = createServiceRoleClient();
  const id = uuidv4();
  
  const { error } = await supabase
    .from('standalone_plans')
    .insert({
      id,
      url: data.url,
      name: data.name,
      type: data.type,
      size: data.size,
      project_id: data.projectId || null,
      notes: data.notes || null,
    });
  
  if (error) {
    console.error('Error creating standalone plan:', error);
    throw new Error('Failed to create plan');
  }
  
  revalidatePath('/');
  return { id };
}

export async function updateStandalonePlan(id: string, data: {
  projectId?: string | null;
  notes?: string | null;
}) {
  const supabase = createServiceRoleClient();
  
  const updateData: any = {};
  if (data.projectId !== undefined) updateData.project_id = data.projectId;
  if (data.notes !== undefined) updateData.notes = data.notes;
  
  const { error } = await supabase
    .from('standalone_plans')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('Error updating standalone plan:', error);
    throw new Error('Failed to update plan');
  }
  
  revalidatePath('/');
}

export async function deleteStandalonePlan(id: string) {
  const supabase = createServiceRoleClient();
  
  const { error } = await supabase
    .from('standalone_plans')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting standalone plan:', error);
    throw new Error('Failed to delete plan');
  }
  
  revalidatePath('/');
}

// Get all plans from both standalone_plans table AND from projects' plans field
export async function getAllPlans(): Promise<Array<StandalonePlan & { source: 'standalone' | 'project' }>> {
  const supabase = createServiceRoleClient();
  
  // Get standalone plans
  const standalonePlans = await getStandalonePlans();
  
  // Get plans from projects
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, plans');
  
  if (error) {
    console.error('Error fetching project plans:', error);
    return standalonePlans.map(p => ({ ...p, source: 'standalone' as const }));
  }
  
  const projectPlans: Array<StandalonePlan & { source: 'project' }> = [];
  
  projects.forEach(project => {
    let plansList: any[] = [];
    
    try {
      if (project.plans) {
        plansList = typeof project.plans === 'string'
          ? JSON.parse(project.plans)
          : project.plans;
      }
    } catch (e) {
      console.error('Failed to parse plans for project:', project.id, e);
    }
    
    if (Array.isArray(plansList) && plansList.length > 0) {
      plansList.forEach(plan => {
        projectPlans.push({
          id: plan.id,
          url: plan.url,
          name: plan.name,
          type: plan.type,
          size: plan.size || 0,
          projectId: project.id,
          projectTitle: project.title,
          notes: null,
          createdAt: new Date(),
          source: 'project',
        });
      });
    }
  });
  
  // Combine and sort by date (standalone plans have dates, project plans don't)
  const allPlans = [
    ...standalonePlans.map(p => ({ ...p, source: 'standalone' as const })),
    ...projectPlans,
  ];
  
  return allPlans;
}
