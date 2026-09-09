"use client";

import { Info } from "lucide-react";

import { ParameterEditor, type ToolParameter } from "@/components/http";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface BrowserToolConfigProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    parameters: ToolParameter[];
    onParametersChange: (parameters: ToolParameter[]) => void;
    timeoutMs: number;
    onTimeoutMsChange: (timeout: number) => void;
}

export function BrowserToolConfig({
    name,
    onNameChange,
    description,
    onDescriptionChange,
    parameters,
    onParametersChange,
    timeoutMs,
    onTimeoutMsChange,
}: BrowserToolConfigProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Browser Tool Configuration</CardTitle>
                <CardDescription>
                    Runs in the visitor&apos;s browser during voice embed calls. Register a matching handler in your app via{" "}
                    <code className="text-xs">clientTools</code> or{" "}
                    <code className="text-xs">DograhWidget.setClientTools</code>.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="settings" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                        <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings" className="space-y-4 mt-4">
                        <div className="grid gap-2">
                            <Label>Tool Name</Label>
                            <Label className="text-xs text-muted-foreground">
                                Becomes the function name the LLM calls (e.g. &quot;Lookup Order&quot; →{" "}
                                <code className="text-xs">lookup_order</code>)
                            </Label>
                            <Input
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder="e.g., Lookup Order"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Label className="text-xs text-muted-foreground">
                                Tell the agent exactly when to call this tool and what it returns
                            </Label>
                            <Textarea
                                value={description}
                                onChange={(e) => onDescriptionChange(e.target.value)}
                                placeholder="Fetch order details from the host app when the caller provides an order ID."
                                rows={3}
                            />
                        </div>

                        <div className="grid gap-2 max-w-xs">
                            <Label>Timeout (ms)</Label>
                            <Input
                                type="number"
                                value={timeoutMs}
                                onChange={(e) =>
                                    onTimeoutMsChange(parseInt(e.target.value, 10) || 15000)
                                }
                                min={1000}
                                max={60000}
                            />
                        </div>

                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-600 flex gap-2 items-start">
                            <Info className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                Voice embed only. The handler name must match the generated function name from the tool name above.
                                See the client-tools docs for security guidance.
                            </span>
                        </div>
                    </TabsContent>

                    <TabsContent value="parameters" className="mt-4">
                        <ParameterEditor
                            parameters={parameters}
                            onChange={onParametersChange}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
