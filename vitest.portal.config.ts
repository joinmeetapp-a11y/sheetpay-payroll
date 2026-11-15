import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/portalPayroll.test.ts",
      "tests/caylaAgent.test.ts",
      "tests/bulkPayslipEmail.test.ts",
    ],
  },
});
