require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.NODE_ENV = "test";
process.env.PORT = "0";

const app = require("../src/app.js");
const {
  DEPARTMENT_CATEGORIES,
  isValidDepartmentCategoryPair,
  classifyComplaint,
  clearClassifierCache,
} = require("../src/services/complaintClassifier.service.js");

describe("Complaint Classifier Service & API Endpoint Test Suite", () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    clearClassifierCache();
  });

  describe("Predefined DEPARTMENT_CATEGORIES validation", () => {
    it("should export the exact predefined department and category mapping", () => {
      assert.ok(DEPARTMENT_CATEGORIES["Hostel & Mess"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["Hostel & Mess"], ["Hostel", "Mess"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["Academic Affairs"], ["Academic"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["Examination Cell"], ["Academic"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["Anti-Ragging Committee"], ["Ragging"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["Internal Complaints Committee"], ["Harassment"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["Library"], ["Academic", "Infrastructure", "Other"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["IT & Infrastructure"], ["Infrastructure"]);
      assert.deepStrictEqual(DEPARTMENT_CATEGORIES["Administration"], [
        "Administration",
        "Finance",
        "Discipline",
        "Transport",
        "Medical",
        "Other",
      ]);
    });

    it("isValidDepartmentCategoryPair helper correctly validates pairs", () => {
      assert.strictEqual(isValidDepartmentCategoryPair("Hostel & Mess", "Mess"), true);
      assert.strictEqual(isValidDepartmentCategoryPair("Hostel & Mess", "Hostel"), true);
      assert.strictEqual(isValidDepartmentCategoryPair("Examination Cell", "Academic"), true);
      assert.strictEqual(isValidDepartmentCategoryPair("Anti-Ragging Committee", "Ragging"), true);
      assert.strictEqual(isValidDepartmentCategoryPair("Hostel & Mess", "Finance"), false);
      assert.strictEqual(isValidDepartmentCategoryPair("NonExistentDept", "Academic"), false);
      assert.strictEqual(isValidDepartmentCategoryPair("Administration", "InvalidCategory"), false);
    });
  });

  describe("POST /api/classify-complaint input validation (HTTP 400)", () => {
    it("rejects request with missing title (400)", async () => {
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Valid description here" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, "VALIDATION_ERROR");
      assert.ok(data.message.includes("title"));
    });

    it("rejects request with missing description (400)", async () => {
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Valid title here" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, "VALIDATION_ERROR");
      assert.ok(data.message.includes("description"));
    });

    it("rejects whitespace-only title (400)", async () => {
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "   ", description: "Valid description here" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, "VALIDATION_ERROR");
      assert.ok(data.message.includes("empty or whitespace-only"));
    });

    it("rejects whitespace-only description (400)", async () => {
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Valid Title", description: "   " }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, "VALIDATION_ERROR");
      assert.ok(data.message.includes("empty or whitespace-only"));
    });

    it("rejects non-string title or description (400)", async () => {
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: 12345, description: true }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, "VALIDATION_ERROR");
    });

    it("rejects title exceeding 300 characters (400)", async () => {
      const longTitle = "A".repeat(301);
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: longTitle, description: "Valid description" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes("300"));
    });

    it("rejects description exceeding 5000 characters (400)", async () => {
      const longDesc = "A".repeat(5001);
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Valid Title", description: longDesc }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes("5000"));
    });
  });

  describe("Controlled Quota, Fallback, and Error Handling Suites (Mocked)", () => {
    // 1. Primary model succeeds
    it("1. Primary model succeeds with correct classification", async () => {
      const mockAi = {
        models: {
          generateContent: async ({ model }) => {
            assert.strictEqual(model, "gemini-3.6-flash");
            return {
              text: JSON.stringify({
                department: "Hostel & Mess",
                category: "Mess",
                explanation: "Food quality issue in dining hall.",
                needsHumanReview: false,
              }),
            };
          },
        },
      };

      const result = await classifyComplaint(
        "Mess Food Issue",
        "The food served in the mess is cold and unhygienic.",
        {
          aiClient: mockAi,
          apiKey: "test_key",
          model: "gemini-3.6-flash",
          fallbackModel: "gemini-3.5-flash-lite",
          bypassCache: true,
        }
      );

      assert.strictEqual(result.department, "Hostel & Mess");
      assert.strictEqual(result.category, "Mess");
      assert.strictEqual(result.needsHumanReview, false);
    });

    // 2. Primary model returns 429 and fallback succeeds
    it("2. Primary model returns 429 and fallback model succeeds", async () => {
      const calls = [];
      const mockAi = {
        models: {
          generateContent: async ({ model }) => {
            calls.push(model);
            if (model === "gemini-3.6-flash") {
              const err = new Error("RESOURCE_EXHAUSTED: Rate limit exceeded");
              err.status = 429;
              throw err;
            }
            return {
              text: JSON.stringify({
                department: "Examination Cell",
                category: "Academic",
                explanation: "Delay in semester grade card release.",
                needsHumanReview: false,
              }),
            };
          },
        },
      };

      const result = await classifyComplaint(
        "Exam Results",
        "The semester exam results are not declared yet.",
        {
          aiClient: mockAi,
          apiKey: "test_key",
          model: "gemini-3.6-flash",
          fallbackModel: "gemini-3.5-flash-lite",
          bypassCache: true,
        }
      );

      assert.deepStrictEqual(calls, ["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
      assert.strictEqual(result.department, "Examination Cell");
      assert.strictEqual(result.category, "Academic");
    });

    // 3. Both models return 429
    it("3. Both models return 429 quota exhaustion; stops immediately and throws AI_QUOTA_EXHAUSTED", async () => {
      const calls = [];
      const mockAi = {
        models: {
          generateContent: async ({ model }) => {
            calls.push(model);
            const err = new Error("RESOURCE_EXHAUSTED: Daily quota reached");
            err.status = 429;
            throw err;
          },
        },
      };

      await assert.rejects(
        async () => {
          await classifyComplaint("Wifi issue", "Wifi is disconnected.", {
            aiClient: mockAi,
            apiKey: "test_key",
            model: "gemini-3.6-flash",
            fallbackModel: "gemini-3.5-flash-lite",
            bypassCache: true,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "AI_QUOTA_EXHAUSTED");
          assert.strictEqual(err.status, 429);
          return true;
        }
      );

      // Primary tried once (no retry on 429), Fallback tried once (no retry on 429)
      assert.deepStrictEqual(calls, ["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    });

    // 4. Primary model returns 503 and a bounded retry succeeds
    it("4. Primary model returns 503 and a bounded retry succeeds without triggering fallback", async () => {
      let callCount = 0;
      const calls = [];
      const mockAi = {
        models: {
          generateContent: async ({ model }) => {
            calls.push(model);
            callCount++;
            if (callCount === 1) {
              const err = new Error("UNAVAILABLE: The model is overloaded");
              err.status = 503;
              throw err;
            }
            return {
              text: JSON.stringify({
                department: "IT & Infrastructure",
                category: "Infrastructure",
                explanation: "Computer laboratory network router failure.",
                needsHumanReview: false,
              }),
            };
          },
        },
      };

      const result = await classifyComplaint(
        "Lab Network Down",
        "The computer network in the engineering lab is completely down.",
        {
          aiClient: mockAi,
          apiKey: "test_key",
          model: "gemini-3.6-flash",
          fallbackModel: "gemini-3.5-flash-lite",
          maxTransientRetries: 1,
          bypassCache: true,
        }
      );

      // Primary retried once bounded and succeeded; fallback was never invoked
      assert.deepStrictEqual(calls, ["gemini-3.6-flash", "gemini-3.6-flash"]);
      assert.strictEqual(result.department, "IT & Infrastructure");
      assert.strictEqual(result.category, "Infrastructure");
    });

    // 5. Both models fail with temporary errors (503)
    it("5. Both models fail with temporary errors (503); throws AI_SERVICE_UNAVAILABLE", async () => {
      const calls = [];
      const mockAi = {
        models: {
          generateContent: async ({ model }) => {
            calls.push(model);
            const err = new Error("UNAVAILABLE: Service high demand");
            err.status = 503;
            throw err;
          },
        },
      };

      await assert.rejects(
        async () => {
          await classifyComplaint("Library Book", "The book is missing.", {
            aiClient: mockAi,
            apiKey: "test_key",
            model: "gemini-3.6-flash",
            fallbackModel: "gemini-3.5-flash-lite",
            maxTransientRetries: 1,
            bypassCache: true,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "AI_SERVICE_UNAVAILABLE");
          assert.strictEqual(err.status, 503);
          return true;
        }
      );

      // Primary tried twice (1 call + 1 bounded retry), then fallback tried twice (1 call + 1 bounded retry)
      assert.deepStrictEqual(calls, [
        "gemini-3.6-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash-lite",
      ]);
    });

    // 6. Invalid API key or permanent configuration error
    it("6. Missing or invalid API key throws CONFIG_ERROR immediately with 0 retries and no fallback", async () => {
      await assert.rejects(
        async () => {
          await classifyComplaint("Title", "Description", {
            apiKey: "",
            bypassCache: true,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "CONFIG_ERROR");
          return true;
        }
      );

      let attempts = 0;
      const permErrorAi = {
        models: {
          generateContent: async () => {
            attempts++;
            const err = new Error("API_KEY_INVALID");
            err.status = 401;
            throw err;
          },
        },
      };

      await assert.rejects(
        async () => {
          await classifyComplaint("Title", "Description", {
            aiClient: permErrorAi,
            apiKey: "bad_key",
            bypassCache: true,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "CONFIG_ERROR");
          return true;
        }
      );
      assert.strictEqual(attempts, 1, "Permanent error must not be retried");
    });

    // 7. Invalid classifier output
    it("7. Invalid classifier output: overrides mismatched department/category pair safely", async () => {
      const invalidPairMock = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              department: "Hostel & Mess",
              category: "Finance", // Invalid category for Hostel & Mess
              explanation: "Incorrect bill deduction in hostel.",
              needsHumanReview: false,
            }),
          }),
        },
      };

      const result = await classifyComplaint(
        "Hostel Bill",
        "Fee deduction in hostel.",
        {
          aiClient: invalidPairMock,
          apiKey: "test_key",
          bypassCache: true,
        }
      );

      assert.strictEqual(result.needsHumanReview, true);
      assert.strictEqual(isValidDepartmentCategoryPair(result.department, result.category), true);
    });

    it("7b. Invalid JSON output from AI model throws INVALID_MODEL_OUTPUT (502)", async () => {
      const malformedAiMock = {
        models: {
          generateContent: async () => ({
            text: "NOT_JSON_AT_ALL",
          }),
        },
      };

      await assert.rejects(
        async () => {
          await classifyComplaint("Title", "Description", {
            aiClient: malformedAiMock,
            apiKey: "test_key",
            bypassCache: true,
          });
        },
        { code: "INVALID_MODEL_OUTPUT", status: 502 }
      );
    });

    // 8. In-memory caching and deduplication prevents redundant requests
    it("8. In-memory caching and in-flight deduplication prevents redundant model invocations", async () => {
      let callCount = 0;
      const mockAi = {
        models: {
          generateContent: async () => {
            callCount++;
            return {
              text: JSON.stringify({
                department: "Administration",
                category: "Discipline",
                explanation: "Student misconduct in campus.",
                needsHumanReview: false,
              }),
            };
          },
        },
      };

      // Call 1
      const res1 = await classifyComplaint("Discipline issue", "Loud music at midnight.", {
        aiClient: mockAi,
        apiKey: "test_key",
      });
      assert.strictEqual(callCount, 1);

      // Call 2 with identical title/desc (case insensitive, trimmed)
      const res2 = await classifyComplaint("  discipline issue  ", "loud music at midnight. ", {
        aiClient: mockAi,
        apiKey: "test_key",
      });
      assert.strictEqual(callCount, 1, "Should be answered from cache without invoking Gemini API");
      assert.strictEqual(res2.department, res1.department);
      assert.strictEqual(res2.category, res1.category);
    });

    // 9. No infinite retry or fallback loops
    it("9. No infinite retry or fallback loops under severe network turbulence", async () => {
      let totalInvocations = 0;
      const turbulentAi = {
        models: {
          generateContent: async () => {
            totalInvocations++;
            const err = new Error("Network connection reset by peer");
            err.status = 503;
            throw err;
          },
        },
      };

      await assert.rejects(async () => {
        await classifyComplaint("Sample", "Sample description", {
          aiClient: turbulentAi,
          apiKey: "test_key",
          maxTransientRetries: 1,
          bypassCache: true,
        });
      });

      // Exactly 2 on primary (1 + 1 retry) and 2 on fallback (1 + 1 retry) = 4 max
      assert.strictEqual(totalInvocations, 4);
    });

    // 10. API keys are never exposed to the client
    it("10. API keys and sensitive credentials are never exposed in success or error responses", async () => {
      // Test error response via HTTP endpoint
      const res = await fetch(`${baseUrl}/api/classify-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "A".repeat(305), // triggers validation error
          description: "Valid description",
        }),
      });

      const bodyText = await res.text();
      assert.strictEqual(bodyText.includes(process.env.GEMINI_API_KEY || "AIza"), false);
      assert.strictEqual(bodyText.includes("API_KEY"), false);
      assert.strictEqual(bodyText.includes("stack"), false);
    });
  });
});
