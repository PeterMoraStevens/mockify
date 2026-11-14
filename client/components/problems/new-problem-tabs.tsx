"use client";

import { Braces, Hammer } from "lucide-react";
import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { ProblemBuilder } from "./builder";
import { UploadForm } from "./upload-form";

export function NewProblemTabs() {
  const [tab, setTab] = useState<"builder" | "json">("builder");
  return (
    <div className="mt-8">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "builder", label: "Builder", icon: <Hammer /> },
          { value: "json", label: "Upload JSON", icon: <Braces /> },
        ]}
      />
      {tab === "builder" ? <ProblemBuilder /> : <UploadForm />}
    </div>
  );
}
