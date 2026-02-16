import { NextRequest, NextResponse } from "next/server";

const languageMapping: Record<string, { language: string; version: string }> = {
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  "c++": { language: "c++", version: "10.2.0" },
  java: { language: "java", version: "15.0.2" },
  "c#": { language: "csharp", version: "6.12.0" },
};

type ProgramRequest = {
  language: keyof typeof languageMapping;
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProgramRequest;

    const { language, content } = body;

    if (!language || !content) {
      return NextResponse.json(
        { error: "Missing language or content" },
        { status: 400 },
      );
    }

    const mapping = languageMapping[language];
    if (!mapping) {
      return NextResponse.json(
        { error: `Unsupported language: ${language}` },
        { status: 400 },
      );
    }

    const pistonPayload = {
      language: mapping.language,
      version: mapping.version,
      files: [
        {
          content,
        },
      ],
    };

    const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: {
        Authorization: `${process.env.PISTON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pistonPayload),
    });

    if (!pistonRes.ok) {
      const errorText = await pistonRes.text();
      console.error("Piston API error:", pistonRes.status, errorText);
      return NextResponse.json(
        { error: `Piston API error: ${errorText}` },
        { status: pistonRes.status },
      );
    }

    const result = await pistonRes.json();

    if (!result.run) {
      console.error("Unexpected Piston response:", result);
      return NextResponse.json(
        { error: result.message || "Unexpected response from code runner" },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to execute code" },
      { status: 500 },
    );
  }
}
