"use client";

import React, { useState } from "react";
import Editor, { DiffEditor, useMonaco, loader } from "@monaco-editor/react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Page = () => {
  const theme = useTheme();
  const [code, setCode] = useState<string | undefined>();
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");

  const handleCodeExecution = async () => {
    setOutput("Running...");

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          content: code ?? "",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setOutput(`Request failed (${res.status}): ${text}`);
        return;
      }

      const data = await res.json();

      setOutput(data.run.output)
    } catch (e: any) {
      setOutput(`Error: ${e?.message ?? "Unknown error"}`);
    }
  };

  return (
    <div className="grid grid-cols-10 max-h-screen">
      <div className="col-span-7">
        <Card className="p-6 bg-main/80 m-2">
          <div className="flex justify-between">
            <div>Editor</div>
            <div className="flex gap-2">
              <Select onValueChange={setLanguage} value={language}>
                <SelectTrigger className="w-45 shadow-shadow hover:cursor-pointer">
                  <SelectValue placeholder="Select a Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="python">Python 3</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="c++">C++ v10.2</SelectItem>
                    <SelectItem value="java">Java v15</SelectItem>
                    <SelectItem value="c#">C#</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button onClick={handleCodeExecution}>
                Run <PlayIcon />
              </Button>
            </div>
          </div>

          <CardContent>
            <Editor
              className="shadow-shadow"
              theme={theme.theme === "dark" ? "vs-dark" : "light"}
              height="75vh"
              defaultLanguage="python"
              language={language}
              onChange={(value) => setCode(value)}
            />
          </CardContent>
        </Card>
      </div>
      <div className="col-span-3">
        <Card className="p-6 bg-main/80 m-2"></Card>
        <Card className="max-h-screen overflow-scroll p-6 bg-main/80 m-2">
          <CardTitle>Output</CardTitle>
          <CardContent>
            <pre className="whitespace-pre-wrap wrap-break-word">{output}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Page;
