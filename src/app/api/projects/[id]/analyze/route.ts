import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readProjectDir, checkPortStatus } from '@/lib/process-manager';
import ZAI from 'z-ai-web-dev-sdk';

// POST /api/projects/[id]/analyze - LLM analyzes project directory
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      include: { environments: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Read project directory
    const dirInfo = await readProjectDir(project.path);
    if (!dirInfo.success) {
      return NextResponse.json({ error: dirInfo.error }, { status: 400 });
    }

    // Build context for LLM
    const configSummary = (dirInfo.configFile || [])
      .map(f => `=== ${f.name} ===\n${f.content}`)
      .join('\n\n');

    // Check which ports are already in use
    const commonlyUsedPorts = [3000, 3001, 3002, 4000, 5000, 5173, 5174, 8000, 8080, 8081, 8888, 9000];
    const portUsage: Record<number, string> = {};
    for (const p of commonlyUsedPorts) {
      if (await checkPortStatus(p)) {
        portUsage[p] = 'in use';
      }
    }

    const prompt = `You are a DevOps expert. Analyze the following project directory and generate startup configurations for both a test environment and a production environment.

Project path: ${project.path}
Project name: ${project.name}

Currently used ports (DO NOT assign these): ${Object.keys(portUsage).join(', ') || 'none detected'}

Key files found:
${configSummary}

Based on the project files, generate a JSON response with this exact structure:
{
  "projectName": "string - a descriptive name for the project",
  "description": "string - brief description of what the project does",
  "icon": "string - a lucide-react icon name that represents the project (e.g., 'globe', 'code', 'database', 'smartphone', 'shopping-cart', 'layout', 'palette', 'cpu', 'book-open', 'music', 'gamepad-2', 'bar-chart', 'shield', 'heart', 'camera', 'map', 'cloud', 'terminal', 'rocket', 'puzzle')",
  "environments": [
    {
      "name": "test",
      "cmd": "string - the command to start in test/dev mode",
      "port": number - the port the app runs on in test mode (MUST be different from production port),
      "envVars": { "KEY": "VALUE" } - environment variables for test mode
    },
    {
      "name": "production",
      "cmd": "string - the command to start in production mode",
      "port": number - the port the app runs on in production mode (MUST be different from test port),
      "envVars": { "KEY": "VALUE" } - environment variables for production mode
    }
  ]
}

CRITICAL Rules:
1. Test and Production MUST use DIFFERENT ports. For example: test=3001, production=3000
2. Do NOT assign any port that is listed as "in use" above
3. Common port conventions:
   - Next.js: test uses 'npm run dev' (port 3001), production uses 'npm run build && npm run start' (port 3000)
   - Vite/Vue: test uses 'npm run dev' (port 5173), production uses 'npm run build && npm run preview' (port 4173)
   - React: test uses 'npm start' (port 3001), production uses 'npx serve -s build' (port 3000)
   - Python/Flask: test uses 'flask run' (port 5001), production uses 'gunicorn' (port 5000)
4. Use 'bun run' instead of 'npm run' if the project uses bun (has bun.lock or bun.lockb)
5. Environment variables should have proper values:
   - NODE_ENV: "development" for test, "production" for production
   - HOST: "0.0.0.0" (NOT "0.0.0.0.0" - exactly four octets)
   - PORT: the port number as a string
6. Set appropriate env vars based on the project type
7. Respond with ONLY valid JSON, no markdown or explanation
8. The icon should be a lucide-react icon name (e.g., 'globe', 'code', 'database', 'smartphone', 'terminal', 'rocket') that best represents the project's purpose`;

    // Get LLM configuration
    const llmConfig = await db.llmConfig.findUnique({ where: { id: 'default' } });
    const provider = llmConfig?.provider || 'zai';

    let response: string;

    if (provider === 'zai' || !llmConfig?.apiKey) {
      // Use built-in z-ai-web-dev-sdk
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'You are a DevOps expert that analyzes project structures and generates startup configurations. Always respond with valid JSON only. Ensure all port numbers are different between environments and all IP addresses are valid.' },
          { role: 'user', content: prompt },
        ],
        thinking: { type: 'disabled' },
      });
      response = completion.choices[0]?.message?.content || '';
    } else {
      // Use custom OpenAI-compatible API
      const apiUrl = llmConfig.baseUrl
        ? `${llmConfig.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
        : 'https://api.openai.com/v1/chat/completions';
      const model = llmConfig.model || 'gpt-4o-mini';

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a DevOps expert that analyzes project structures and generates startup configurations. Always respond with valid JSON only. Ensure all port numbers are different between environments and all IP addresses are valid.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return NextResponse.json({
          error: `LLM API error (${res.status}): ${errorText.slice(0, 200)}`,
        }, { status: 500 });
      }

      const data = await res.json();
      response = data.choices?.[0]?.message?.content || '';
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonStr.trim());
    } catch {
      return NextResponse.json({
        error: 'Failed to parse LLM response',
        rawResponse: response.slice(0, 500),
      }, { status: 500 });
    }

    // Validate and fix port conflicts
    const envs = analysis.environments || [];
    const usedPorts = new Set<number>();
    for (const env of envs) {
      if (usedPorts.has(env.port)) {
        // Find next available port
        let newPort = env.port + 1;
        while (usedPorts.has(newPort) || await checkPortStatus(newPort)) {
          newPort++;
        }
        env.port = newPort;
      }
      usedPorts.add(env.port);
    }

    // Update project info
    await db.project.update({
      where: { id },
      data: {
        name: analysis.projectName || project.name,
        description: analysis.description || project.description,
        icon: analysis.icon || project.icon,
      },
    });

    // Create environments
    for (const env of envs) {
      const existing = project.environments.find(e => e.name === env.name);
      if (existing) {
        await db.environment.update({
          where: { id: existing.id },
          data: {
            cmd: env.cmd,
            port: env.port,
            envVars: JSON.stringify(env.envVars || {}),
          },
        });
      } else {
        await db.environment.create({
          data: {
            projectId: id,
            name: env.name,
            cmd: env.cmd,
            port: env.port,
            envVars: JSON.stringify(env.envVars || {}),
          },
        });
      }
    }

    // Return the updated project
    const updatedProject = await db.project.findUnique({
      where: { id },
      include: { environments: true },
    });

    return NextResponse.json({
      project: updatedProject,
      analysis: {
        projectName: analysis.projectName,
        description: analysis.description,
        icon: analysis.icon,
        environments: envs,
        provider,
      },
    });
  } catch (e: any) {
    console.error('Analyze error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
