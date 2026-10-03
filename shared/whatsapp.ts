/**
 * WhatsApp helpers shared by client and server.
 * Routing priority for an enquiry:
 *   1. city.routingWhatsapp (explicit override)
 *   2. city's assigned manager (if active)
 *   3. site default business WhatsApp
 */
export function normaliseWhatsapp(num: string): string {
  return (num || "").replace(/[^0-9]/g, "");
}

export function waLink(number: string, message: string): string {
  const n = normaliseWhatsapp(number);
  const text = encodeURIComponent(message);
  return n ? `https://wa.me/${n}?text=${text}` : `https://wa.me/?text=${text}`;
}

export type EnquirySummary = {
  name: string;
  city: string;
  projectType: string;
  budget: string;
  preferredDate: string;
  preferredTime: string;
  meetingType: string;
  meetingAddress?: string;
  message?: string;
  reference?: string | number;
};

function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function buildEnquiryMessage(e: EnquirySummary, brand = "Oak & Line"): string {
  const lines = [
    `Hello ${brand}, I'd like to discuss my project.`,
    "",
    `Name: ${e.name}`,
    `City: ${e.city}`,
    `Project: ${e.projectType}`,
    `Budget: ${e.budget}`,
    `Preferred date: ${prettyDate(e.preferredDate)}`,
    `Preferred time: ${e.preferredTime}`,
    `Meeting: ${e.meetingType === "offline" ? "In person (site / home visit)" : "Online video call"}`,
  ];
  if (e.meetingType === "offline" && e.meetingAddress) lines.push(`Address: ${e.meetingAddress}`);
  if (e.message) lines.push("", `Notes: ${e.message}`);
  if (e.reference) lines.push("", `Enquiry ref: OL-${e.reference}`);
  return lines.join("\n");
}

export function buildContextMessage(context: { projectName?: string; serviceName?: string }, brand = "Oak & Line") {
  if (context.projectName) {
    return `Hello ${brand}, I saw your project "${context.projectName}" and would like to discuss something similar for my home.`;
  }
  if (context.serviceName) {
    return `Hello ${brand}, I'm interested in ${context.serviceName}. Could we set up a consultation?`;
  }
  return `Hello ${brand}, I'd like a consultation for my home interiors.`;
}
