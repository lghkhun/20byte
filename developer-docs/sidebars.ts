import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  apiSidebar: [
    "overview",
    "authentication",
    {
      type: "category",
      label: "Endpoints",
      items: [
        "endpoints/endpoints-messages",
        "endpoints/endpoints-groups",
        "endpoints/endpoints-device",
        "endpoints/endpoints-schedules",
        "endpoints/endpoints-webhook"
      ]
    },
    "payloads",
    "error-codes",
    "migration-woowa"
  ]
};

export default sidebars;
