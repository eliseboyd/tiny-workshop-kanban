import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'shortcuts', 'quick-add.signed.shortcut');
  const file = await readFile(filePath);

  return new Response(file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="quick-add.signed.shortcut"',
    },
  });
}
