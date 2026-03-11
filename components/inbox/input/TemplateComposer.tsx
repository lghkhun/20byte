import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEMPLATE_COST } from "@/components/inbox/input/utils";

type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";

type TemplateComposerProps = {
  density: "compact" | "comfy";
  disabled: boolean;
  isSendingTemplate: boolean;
  templateName: string;
  templateCategory: TemplateCategory;
  templateLanguageCode: string;
  onTemplateNameChange: (value: string) => void;
  onTemplateCategoryChange: (value: TemplateCategory) => void;
  onTemplateLanguageCodeChange: (value: string) => void;
  onSendTemplate: () => void;
};

export function TemplateComposer({
  density,
  disabled,
  isSendingTemplate,
  templateName,
  templateCategory,
  templateLanguageCode,
  onTemplateNameChange,
  onTemplateCategoryChange,
  onTemplateLanguageCodeChange,
  onSendTemplate
}: TemplateComposerProps) {
  return (
    <div className={`rounded-xl border border-border/80 bg-background/40 text-xs shadow-sm ${density === "compact" ? "p-1.5" : "p-2"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">Template Message</p>
        <span
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
          title="Meta charges per conversation window, not per single message."
        >
          Conversation window pricing
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Input
          value={templateName}
          onChange={(event) => onTemplateNameChange(event.target.value)}
          placeholder="template_name"
          disabled={disabled || isSendingTemplate}
        />
        <select
          className="rounded-md border border-border bg-background px-2 py-2 text-xs text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring"
          value={templateCategory}
          onChange={(event) => onTemplateCategoryChange(event.target.value as TemplateCategory)}
          disabled={disabled || isSendingTemplate}
        >
          <option value="MARKETING">Marketing ({TEMPLATE_COST.MARKETING})</option>
          <option value="UTILITY">Utility ({TEMPLATE_COST.UTILITY})</option>
          <option value="AUTHENTICATION">Authentication ({TEMPLATE_COST.AUTHENTICATION})</option>
          <option value="SERVICE">Service ({TEMPLATE_COST.SERVICE})</option>
        </select>
        <Input
          value={templateLanguageCode}
          onChange={(event) => onTemplateLanguageCodeChange(event.target.value)}
          placeholder="en"
          disabled={disabled || isSendingTemplate}
        />
        <Button type="button" className="transition" disabled={disabled || isSendingTemplate} onClick={onSendTemplate}>
          {isSendingTemplate ? "Sending..." : "Send Template"}
        </Button>
      </div>
    </div>
  );
}
