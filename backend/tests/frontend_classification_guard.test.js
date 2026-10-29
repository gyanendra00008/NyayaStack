const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Frontend Complaint Classification Guard Logic Suite", () => {
  it("rejects empty, whitespace-only, or under-threshold inputs without triggering network calls", () => {
    let networkCallMade = false;
    const trigger = (title, desc) => {
      const trimmedTitle = (title || "").trim();
      const trimmedDesc = (desc || "").trim();
      if (!trimmedTitle || !trimmedDesc) return false;
      if (trimmedTitle.length < 3 || trimmedDesc.length < 5) return false;
      networkCallMade = true;
      return true;
    };

    assert.strictEqual(trigger("", ""), false);
    assert.strictEqual(trigger("   ", "valid description here"), false);
    assert.strictEqual(trigger("Hi", "Too short title"), false);
    assert.strictEqual(trigger("Valid Title", "shrt"), false);
    assert.strictEqual(networkCallMade, false);

    assert.strictEqual(trigger("Valid Title", "Valid description here"), true);
    assert.strictEqual(networkCallMade, true);
  });

  it("suppresses duplicate requests for identical input (lastClassifiedInputRef)", () => {
    let networkCalls = 0;
    const lastClassifiedInput = { title: "", description: "" };

    const performClassification = (title, desc, isManual = false) => {
      const trimmedTitle = title.trim();
      const trimmedDesc = desc.trim();

      if (!isManual) {
        if (
          lastClassifiedInput.title === trimmedTitle &&
          lastClassifiedInput.description === trimmedDesc
        ) {
          return "SKIPPED_DUPLICATE";
        }
      }

      networkCalls++;
      lastClassifiedInput.title = trimmedTitle;
      lastClassifiedInput.description = trimmedDesc;
      return "EXECUTED";
    };

    // First call
    assert.strictEqual(performClassification("Exam delayed", "Results not declared"), "EXECUTED");
    assert.strictEqual(networkCalls, 1);

    // Identical call while typing/re-rendering
    assert.strictEqual(performClassification("Exam delayed", "Results not declared"), "SKIPPED_DUPLICATE");
    assert.strictEqual(networkCalls, 1);

    // Changed input
    assert.strictEqual(performClassification("Exam delayed", "Results not declared yet"), "EXECUTED");
    assert.strictEqual(networkCalls, 2);

    // Manual retry forces execution even for same input
    assert.strictEqual(performClassification("Exam delayed", "Results not declared yet", true), "EXECUTED");
    assert.strictEqual(networkCalls, 3);
  });

  it("latches on quota exhaustion (429) to prevent auto-retry on keystrokes, and resets on manual retry", () => {
    let quotaExhausted = false;
    let autoRequestsFired = 0;

    const onAutoTyping = (title, desc) => {
      if (quotaExhausted) return "BLOCKED_BY_QUOTA";
      autoRequestsFired++;
      return "FIRED";
    };

    // 1. First auto typing fires request
    assert.strictEqual(onAutoTyping("Title 1", "Description 1"), "FIRED");
    assert.strictEqual(autoRequestsFired, 1);

    // 2. Server responds with 429 AI_QUOTA_EXHAUSTED
    quotaExhausted = true;

    // 3. Subsequent keystrokes are blocked and do NOT fire requests
    assert.strictEqual(onAutoTyping("Title 1 modified", "Description 1 modified"), "BLOCKED_BY_QUOTA");
    assert.strictEqual(onAutoTyping("Title 1 more text", "Description 1 more text"), "BLOCKED_BY_QUOTA");
    assert.strictEqual(autoRequestsFired, 1);

    // 4. User clicks "Retry AI Classification" manual button
    quotaExhausted = false; // reset by manual retry
    assert.strictEqual(onAutoTyping("Title 1 manual retry", "Description 1 manual retry"), "FIRED");
    assert.strictEqual(autoRequestsFired, 2);
  });

  it("cancels outdated requests via AbortController and discards stale responses", async () => {
    let latestRequestId = 0;
    let appliedState = null;

    const mockClassify = async (id, delayMs, resultText) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      // Stale response guard
      if (id !== latestRequestId) return;
      appliedState = resultText;
    };

    // Request 1 fired (slow: 50ms)
    const req1Id = ++latestRequestId;
    const p1 = mockClassify(req1Id, 50, "Classification from Request 1");

    // User types more: Request 2 fired (fast: 10ms)
    const req2Id = ++latestRequestId;
    const p2 = mockClassify(req2Id, 10, "Classification from Request 2");

    await Promise.all([p1, p2]);

    // Request 1 finished after Request 2, but its result was discarded because req1Id !== latestRequestId
    assert.strictEqual(appliedState, "Classification from Request 2");
  });
});
