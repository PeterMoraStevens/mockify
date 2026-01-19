import { NextRequest, NextResponse } from "next/server";

const languageMapping: Record<string, string> = {
  python: "3.10.0",
  javascript: "18.15.0",
  "c++": "10.2",
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
        { status: 400 }
      );
    }

    const pistonPayload = {
      language,
      version: languageMapping[language],
      files: [
        {
          content,
        },
      ],
    };

    const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pistonPayload),
    });

    const result = await pistonRes.json();

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to execute code" },
      { status: 500 }
    );
  }
}
