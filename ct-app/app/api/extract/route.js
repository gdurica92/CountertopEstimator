import { NextResponse } from 'next/server';

const PROMPT = `You are a countertop estimating assistant. Read all pages of this shop drawing PDF and extract countertop dimensions for every unit or room shown.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences:

[{"unit":"213","shape":"straight","runs":[{"length":55.5,"isPeninsula":false,"overhang":12,"label":"sink wall"}],"corners":0,"vanities":[{"width":27}],"notes":"excluded 24.75 fridge/pantry tower"}]

RULES:
- shape: straight=1 wall, L=2 walls, U=3 walls of base cabinets with countertop
- runs: one entry per wall of base cabinets that gets countertop. EXCLUDE full-height fridge panels, floor-to-ceiling pantry towers, tall cabinet sections (no countertop above them). Subtract excluded sections from labeled CABS total.
- corners: inside 90 degree corners where two runs meet. L-shape=1, U-shape=2 typically.
- vanities: one entry per bathroom vanity. width = total cabinet width including fillers. V24+V12 gives 36. Depth not needed here.
- Convert all fractions to decimal: 1/2=0.5, 3/4=0.75, 1/4=0.25, 1/8=0.125
- isPeninsula: always false — user sets this manually after reviewing
- notes: briefly state what was excluded and how many inches were removed per wall`;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set. Add it to your .env.local file.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { pdfBase64 } = body;
  if (!pdfBase64) {
    return NextResponse.json({ error: 'No PDF data provided.' }, { status: 400 });
  }

  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach Anthropic API: ' + e.message }, { status: 502 });
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => '');
    return NextResponse.json(
      { error: `Anthropic API error ${anthropicRes.status}: ${errText}` },
      { status: 502 }
    );
  }

  const data = await anthropicRes.json();
  const text = (data.content || []).map((b) => b.text || '').join('');

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const extracted = JSON.parse(clean);
    return NextResponse.json({ units: extracted });
  } catch {
    return NextResponse.json(
      { error: 'Could not parse extraction result. Raw output: ' + text.slice(0, 500) },
      { status: 500 }
    );
  }
}
