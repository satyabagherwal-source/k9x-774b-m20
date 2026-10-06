# Forensic Learning Record (Deep Inspection): ag-ui-protocol/ag-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/ag-ui-protocol-ag-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:47:14.036Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ag-ui-protocol/ag-ui`
- **Description**: AG-UI: the Agent-User Interaction Protocol. Bring Agents into Frontend Applications.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16335 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/dojo/e2e/featurePages/HumanInTheLoopPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../utils/copilot-selectors";
import { sendAndAwaitResponse } from "../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../lib/constants";

export class HumanInTheLoopPage {
  readonly page: Page;
  readonly planTaskButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly plan: Locator;
  readonly performStepsButton: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.planTaskButton = page.getByRole("button", {
      name: "Human in the loop Plan a task",
    });
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.plan = page.getByTestId("select-steps");
    this.performStepsButton = page.getByRole("button", { name: "Confirm" });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendAndAwaitResponse(this.page, message);
  }

  async selectItemsInPlanner() {
    await expect(this.plan).toBeVisible();
    await this.plan.click();
  }

  async getPlannerOnClick(name: string | RegExp) {
    return this.page.getByRole("button", { name });
  }

  async uncheckItem(identifier: number | string): Promise<string> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof identifier === "number") {
      item = items.nth(identifier);
    } else {
      item = items
        .filter({
          has: this.page
            .getByTestId("step-text")
            .filter({ hasText: identifier }),
        })
        .first();
    }
    const stepTextElement = item.getByTestId("step-text");
    const text = await stepTextElement.innerText();
    await item.click();

    return text;
  }

  async isStepItemUnchecked(target: number | string): Promise<boolean> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof target === "number") {
      item = items.nth(target);
    } else {
      item = items
        .filter({
          has: this.page.getByTestId("step-text").filter({ hasText: target }),
        })
        .first();
    }
    const checkbox = item.locator('input[type="checkbox"]');
    return !(await checkbox.isChecked());
  }

  async performSteps() {
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
  }

  async performStepsAndAwait() {
    const countBefore = await this.page
      .locator('[data-testid="copilot-assistant-message"]')
      .count();
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
    await this.page.waitForFunction(
      (before) =>
        document.querySelectorAll('[data-testid="copilot-assistant-message"]')
          .length > before,
      countBefore,
      { timeout: 30000 },
    );
    await this.page.waitForFunction(
      () => document.querySelector('[data-copilot-running="false"]') !== null,
      null,
      { timeout: 60000 },
    );
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(
      this.agentMessage.last().getByText(expectedText),
    ).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/featurePages/SharedStatePage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../utils/copilot-selectors";
import {
  sendChatMessage,
  awaitLLMResponseDone,
} from "../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../lib/constants";

export class SharedStatePage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;
  readonly promptResponseLoader: Locator;
  readonly ingredientCards: Locator;
  readonly instructionsContainer: Locator;
  readonly addIngredient: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.promptResponseLoader = page.getByRole("button", {
      name: "Please Wait...",
      disabled: true,
    });
    this.instructionsContainer = page.locator(".instructions-container");
    this.addIngredient = page.getByRole("button", { name: "+ Add Ingredient" });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
    this.ingredientCards = page.locator(".ingredient-card");
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async awaitAgentReady() {
    await expect(this.page.getByTestId("recipe-card")).toHaveAttribute(
      "data-agent-ready",
      "true",
    );
  }

  async sendMessage(message: string) {
    await sendChatMessage(this.page, message);
    await awaitLLMResponseDone(this.page);
  }

  async loader() {
    // Wait for the LLM stream to finish using data-copilot-running
    await awaitLLMResponseDone(this.page);
  }

  async awaitIngredientCard(name: string) {
    // Use page.waitForFunction for case-insensitive matching on input values,
    // since CSS attribute selectors are case-sensitive
    await this.page.waitForFunction(
      (ingredientName) => {
        const inputs = document.querySelectorAll<HTMLInputElement>(
          ".ingredient-card input.ingredient-name-input",
        );
        return Array.from(inputs).some((input) =>
          input.value.toLowerCase().includes(ingredientName.toLowerCase()),
        );
      },
      name,
      { timeout: 15000 },
    );
  }

  async addNewIngredient(placeholderText: string) {
    await this.addIngredient.click();
    await expect(
      this.page.locator(`input[placeholder="${placeholderText}"]`),
    ).toBeVisible();
  }

  async getInstructionItems(containerLocator: Locator) {
    const count = await containerLocator.locator(".instruction-item").count();
    if (count <= 0) {
      throw new Error("No instruction items found in the container.");
    }
    console.log(`✅ Found ${count} instruction items.`);
    return count;
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(this.agentMessage.getByText(expectedText)).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  // --- Dietary preferences (client -> agent shared-state write-back) ---

  dietaryCheckbox(label: string): Locator {
    return this.page
      .locator(".dietary-option", { hasText: label })
      .locator('input[type="checkbox"]');
  }

  async isDietaryChecked(label: string): Promise<boolean> {
    return this.dietaryCheckbox(label).isChecked();
  }

  async setDietary(label: string, checked: boolean) {
    const box = this.dietaryCheckbox(label);
    if (checked) await box.check();
    else await box.uncheck();
  }

  /** Click "Improve with AI" and wait for the agent run to finish. */
  async improve() {
    await this.page.getByTestId("improve-button").click();
    await awaitLLMResponseDone(this.page);
    // Let the streamed state settle onto the UI before asserting.
    await this.page.waitForTimeout(1500);
  }

  /**
   * Resolve with the completed runtime SSE body for the run whose request body
   * contains `marker` (a quote-free fragment of the prompt — the prompt's own
   * quotes get JSON-escaped in the body, so match a bare fragment). Scopes to
   * the run POST (agent-info / suggestion POSTs to the same endpoint lack the
   * marker). Call BEFORE sending the message.
   */
  captureRuntimeSSE(integrationId: string, marker: string): Promise<string> {
    const idRe = integrationId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pathRe = new RegExp(`/api/copilotkit/${idRe}(/|$)`);
    let settled = false;
    return new Promise<string>((resolve) => {
      this.page.on("response", async (response) => {
        if (settled) return;
        try {
          if (
            !pathRe.test(new URL(response.url()).pathname) ||
            response.request().method() !== "POST" ||
            !(response.request().postData() ?? "").includes(marker)
          ) {
            return;
          }
          // Read the body defensively: a matching response whose body can't be
          // buffered (redirect, aborted retry, teardown race) must not reject
          // the capture — keep waiting for the real run response.
          const body = await response.text();
          if (!settled) {
            settled = true;
            resolve(body);
          }
        } catch {
          // ignore this response; a readable match may still arrive
        }
      });
    });
  }

  /**
   * OSS-414: assert the agent's working-memory update streamed as MULTIPLE
   * incremental STATE_DELTAs DURING the run (before RUN_FINISHED), so shared
   * state renders progressively as the model writes it — not as one blob at the
   * end (and not only via the run-end STATE_SNAPSHOT the bridge always emitted).
   * The bridge consumes Mastra's `updateWorkingMemory` arg-deltas and re-parses
   * the growing JSON, so a healthy run shows many small state patches.
   */
  assertStreamedStateDelta(sse: string): void {
    const deltaCount = (sse.match(/"type":"STATE_DELTA"/g) ?? []).length;
    expect(
      deltaCount,
      "working memory must stream as MULTIPLE incremental STATE_DELTAs (progressive render), not one blob",
    ).toBeGreaterThan(1);
    const firstSnapshotIdx = sse.indexOf('"type":"STATE_SNAPSHOT"');
    const firstDeltaIdx = sse.indexOf('"type":"STATE_DELTA"');
    const finishedIdx = sse.indexOf('"type":"RUN_FINISHED"');
    // A leading STATE_SNAPSHOT must establish the base BEFORE the first delta:
    // the runtime applies deltas from an empty document, so without it the first
    // delta's paths are unresolvable, the run never finishes, and the Mastra
    // thread lock leaks (OSS-414 regression — the "stuck on stop" bug).
    expect(
      firstSnapshotIdx,
      "a STATE_SNAPSHOT must establish the base before any STATE_DELTA",
    ).toBeGreaterThan(-1);
    expect(
      firstSnapshotIdx,
      "the establishing STATE_SNAPSHOT must precede the first STATE_DELTA",
    ).toBeLessThan(firstDeltaIdx);
    // The run must actually finish (this is what reverts the stop button to
    // send) and it must not error out mid-stream.
    expect(finishedIdx, "RUN_FINISHED must reach the wire").toBeGreaterThan(-1);
    expect(sse.includes('"type":"RUN_ERROR"'), "run must not error").toBe(
      false,
    );
    expect(
      firstDeltaIdx,
      "STATE_DELTA must stream BEFORE RUN_FINISHED (live, not just the run-end snapshot)",
    ).toBeLessThan(finishedIdx);
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/adkMiddlewarePages/HumanInLoopPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import { sendAndAwaitResponse } from "../../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../../lib/constants";

export class HumanInLoopPage {
  readonly page: Page;
  readonly planTaskButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly plan: Locator;
  readonly performStepsButton: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.planTaskButton = page.getByRole("button", {
      name: "Human in the loop Plan a task",
    });
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.plan = page.getByTestId("select-steps");
    this.performStepsButton = page.getByRole("button", { name: "Confirm" });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendAndAwaitResponse(this.page, message);
  }

  async selectItemsInPlanner() {
    await expect(this.plan).toBeVisible();
    await this.plan.click();
  }

  async getPlannerOnClick(name: string | RegExp) {
    return this.page.getByRole("button", { name });
  }

  async uncheckItem(identifier: number | string): Promise<string> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof identifier === "number") {
      item = items.nth(identifier);
    } else {
      item = items
        .filter({
          has: this.page
            .getByTestId("step-text")
            .filter({ hasText: identifier }),
        })
        .first();
    }
    const stepTextElement = item.getByTestId("step-text");
    const text = await stepTextElement.innerText();
    await item.click();

    return text;
  }

  async isStepItemUnchecked(target: number | string): Promise<boolean> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof target === "number") {
      item = items.nth(target);
    } else {
      item = items
        .filter({
          has: this.page.getByTestId("step-text").filter({ hasText: target }),
        })
        .first();
    }
    const checkbox = item.locator('input[type="checkbox"]');
    return !(await checkbox.isChecked());
  }

  async performSteps() {
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
  }

  async performStepsAndAwait() {
    const countBefore = await this.page
      .locator('[data-testid="copilot-assistant-message"]')
      .count();
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
    await this.page.waitForFunction(
      (before) =>
        document.querySelectorAll('[data-testid="copilot-assistant-message"]')
          .length > before,
      countBefore,
      { timeout: 30000 },
    );
    await this.page.waitForFunction(
      () => document.querySelector('[data-copilot-running="false"]') !== null,
      null,
      { timeout: 60000 },
    );
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(
      this.agentMessage.last().getByText(expectedText),
    ).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/adkMiddlewarePages/PredictiveStateUpdatesPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import {
  sendChatMessage,
  awaitLLMResponseDone,
} from "../../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../../lib/constants";

export class PredictiveStateUpdatesPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly agentResponsePrompt: Locator;
  readonly userApprovalModal: Locator;
  readonly approveButton: Locator;
  readonly acceptedButton: Locator;
  readonly confirmedChangesResponse: Locator;
  readonly rejectedChangesResponse: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;
  readonly highlights: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.agentResponsePrompt = page.locator("div.tiptap.ProseMirror");
    this.userApprovalModal = page.locator(
      '[data-testid="confirm-changes-modal"]',
    );
    this.acceptedButton = page.getByText("✓ Accepted");
    this.confirmedChangesResponse = page
      .locator('[data-testid="status-display"]', { hasText: "✓ Accepted" })
      .last();
    this.rejectedChangesResponse = page
      .locator('[data-testid="status-display"]', { hasText: "✗ Rejected" })
      .last();
    this.highlights = page.locator(".tiptap em");
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendChatMessage(this.page, message);
  }

  async getPredictiveResponse() {
    await expect(this.agentResponsePrompt).toBeVisible();
    await this.agentResponsePrompt.click();
  }

  async getButton(page, buttonName) {
    return page.getByRole("button", { name: buttonName }).click();
  }

  async getStatusLabelOfButton(page, statusText) {
    return page.getByText(statusText, { exact: true });
  }

  async getUserApproval() {
    const modal = this.userApprovalModal.last();
    const confirmBtn = modal.locator('[data-testid="confirm-button"]');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await awaitLLMResponseDone(this.page);
  }

  async getUserRejection() {
    const modal = this.userApprovalModal.last();
    const rejectBtn = modal.locator('[data-testid="reject-button"]');
    await expect(rejectBtn).toBeEnabled();
    await rejectBtn.click();
    await awaitLLMResponseDone(this.page);
  }

  async verifyAgentResponse(dragonName) {
    const paragraphWithName = await this.page
      .locator(`div.tiptap >> text=${dragonName}`)
      .first();

    const fullText = await paragraphWithName.textContent();
    if (!fullText) {
      return null;
    }

    const match = fullText.match(new RegExp(dragonName, "i"));
    return match ? match[0] : null;
  }

  async verifyHighlightedText() {
    const highlightSelectors = [
      ".tiptap em",
      ".tiptap s",
      "div.tiptap em",
      "div.tiptap s",
    ];

    let count = 0;
    for (const selector of highlightSelectors) {
      count = await this.page.locator(selector).count();
      if (count > 0) {
        break;
      }
    }

    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      const modal = this.page
        .locator('[data-testid="confirm-changes-modal"]')
        .last();
      await expect(modal).toBeVisible();
    }
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/agnoPages/HumanInLoopPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import { sendAndAwaitResponse } from "../../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../../lib/constants";

export class HumanInLoopPage {
  readonly page: Page;
  readonly planTaskButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly plan: Locator;
  readonly performStepsButton: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.planTaskButton = page.getByRole("button", {
      name: "Human in the loop Plan a task",
    });
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.plan = page.getByTestId("select-steps");
    this.performStepsButton = page.getByRole("button", { name: "Confirm" });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendAndAwaitResponse(this.page, message);
  }

  async selectItemsInPlanner() {
    await expect(this.plan).toBeVisible();
    await this.plan.click();
  }

  async getPlannerOnClick(name: string | RegExp) {
    return this.page.getByRole("button", { name });
  }

  async uncheckItem(identifier: number | string): Promise<string> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof identifier === "number") {
      item = items.nth(identifier);
    } else {
      item = items
        .filter({
          has: this.page
            .getByTestId("step-text")
            .filter({ hasText: identifier }),
        })
        .first();
    }
    const stepTextElement = item.getByTestId("step-text");
    const text = await stepTextElement.innerText();
    await item.click();

    return text;
  }

  async isStepItemUnchecked(target: number | string): Promise<boolean> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof target === "number") {
      item = items.nth(target);
    } else {
      item = items
        .filter({
          has: this.page.getByTestId("step-text").filter({ hasText: target }),
        })
        .first();
    }
    const checkbox = item.locator('input[type="checkbox"]');
    return !(await checkbox.isChecked());
  }

  async performSteps() {
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
  }

  async performStepsAndAwait() {
    const countBefore = await this.page
      .locator('[data-testid="copilot-assistant-message"]')
      .count();
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
    await this.page.waitForFunction(
      (before) =>
        document.querySelectorAll('[data-testid="copilot-assistant-message"]')
          .length > before,
      countBefore,
      { timeout: 30000 },
    );
    await this.page.waitForFunction(
      () => document.querySelector('[data-copilot-running="false"]') !== null,
      null,
      { timeout: 60000 },
    );
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(
      this.agentMessage.last().getByText(expectedText),
    ).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/awsStrandsPages/HumanInLoopPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import { sendAndAwaitResponse } from "../../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../../lib/constants";

export class HumanInLoopPage {
  readonly page: Page;
  readonly planTaskButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly plan: Locator;
  readonly performStepsButton: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.planTaskButton = page.getByRole("button", {
      name: "Human in the loop Plan a task",
    });
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.plan = page.getByTestId("select-steps");
    this.performStepsButton = page.getByRole("button", { name: "Confirm" });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendAndAwaitResponse(this.page, message);
  }

  async selectItemsInPlanner() {
    await expect(this.plan).toBeVisible();
    await this.plan.click();
  }

  async getPlannerOnClick(name: string | RegExp) {
    return this.page.getByRole("button", { name });
  }

  async uncheckItem(identifier: number | string): Promise<string> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof identifier === "number") {
      item = items.nth(identifier);
    } else {
      item = items
        .filter({
          has: this.page
            .getByTestId("step-text")
            .filter({ hasText: identifier }),
        })
        .first();
    }
    const stepTextElement = item.getByTestId("step-text");
    const text = await stepTextElement.innerText();
    await item.click();

    return text;
  }

  async isStepItemUnchecked(target: number | string): Promise<boolean> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof target === "number") {
      item = items.nth(target);
    } else {
      item = items
        .filter({
          has: this.page.getByTestId("step-text").filter({ hasText: target }),
        })
        .first();
    }
    const checkbox = item.locator('input[type="checkbox"]');
    return !(await checkbox.isChecked());
  }

  async performSteps() {
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
  }

  async performStepsAndAwait() {
    const countBefore = await this.page
      .locator('[data-testid="copilot-assistant-message"]')
      .count();
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
    await this.page.waitForFunction(
      (before) =>
        document.querySelectorAll('[data-testid="copilot-assistant-message"]')
          .length > before,
      countBefore,
      { timeout: 30000 },
    );
    await this.page.waitForFunction(
      () => document.querySelector('[data-copilot-running="false"]') !== null,
      null,
      { timeout: 60000 },
    );
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(
      this.agentMessage.last().getByText(expectedText),
    ).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/awsStrandsPages/PredictiveStateUpdatesPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import {
  sendChatMessage,
  awaitResponseAfterAction,
} from "../../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../../lib/constants";
import {
  captureRuntimeSSE,
  escapeForRegExp,
  sseFrameAt,
} from "../../utils/runtime-sse";

/**
 * Page object for the AWS Strands `predictive_state_updates` demos, which drive
 * the feature through the FRONTEND `write_document` tool.
 *
 * Separate from the other integrations' copies rather than shared with them: on
 * the legacy `confirm_changes` path their specs exercise, the dialog stays
 * mounted after a decision and shows an accepted/rejected chip, so
 * `awaitConfirmDismissed` would never settle there.
 */
export class PredictiveStateUpdatesPage {
  readonly page: Page;
  readonly agentGreeting: Locator;
  readonly confirmModal: Locator;
  readonly assistantMessages: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.confirmModal = page
      .locator('[data-testid="confirm-changes-modal"]')
      .last();
    this.assistantMessages = CopilotSelectors.assistantMessages(page);
  }

  /**
   * Wait for the chat to be ready.
   *
   * The sidebar is already open via the page's `chatDefaultOpen` default, so
   * there is nothing to click; the welcome message is the readiness signal.
   */
  async awaitChatReady() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendChatMessage(this.page, message);
  }

  async approveChanges() {
    const confirm = this.confirmModal.locator('[data-testid="confirm-button"]');
    await expect(confirm).toBeEnabled();
    await awaitResponseAfterAction(this.page, () => confirm.click());
  }

  async rejectChanges() {
    const reject = this.confirmModal.locator('[data-testid="reject-button"]');
    await expect(reject).toBeEnabled();
    await awaitResponseAfterAction(this.page, () => reject.click());
  }

  /**
   * Wait for the confirm dialog to go away.
   *
   * On the `write_document` path the dialog is only rendered while the tool is
   * executing, so answering it unmounts the card. Its disappearance is the
   * signal that the decision reached the agent.
   */
  async awaitConfirmDismissed() {
    await expect(
      this.page.locator('[data-testid="confirm-changes-modal"]'),
    ).toHaveCount(0, { timeout: 30_000 });
  }

  /** Capture the runtime's SSE body for the run carrying `marker`. */
  captureRuntimeSSE(integrationId: string, marker: string): Promise<string> {
    return captureRuntimeSSE(this.page, integrationId, marker);
  }

  /**
   * Assert the wire carried a predict-state mapping for `tool`, ahead of that
   * tool's argument deltas, and that the arguments then streamed incrementally.
   *
   * This is what makes the demo predictive rather than merely eventually
   * correct. Without the mapping the browser has nothing to project partial
   * arguments onto, and the editor only fills when the authoritative
   * `StateSnapshot` lands, which happens anyway. So a DOM-only assertion passes
   * with the mapping deleted, and only the wire distinguishes the two.
   */
  assertPredictStatePrecedesArgs(
    sse: string,
    tool: string,
    stateKey: string,
    argument: string,
  ) {
    // The frame for THIS tool, not merely the first PredictState on the wire: a
    // demo mapping several tools would otherwise be asserted against whichever
    // frame happened to come first.
    const predictIdx = sse.search(
      new RegExp(
        `"type":"CUSTOM"[^\\n]*"name":"PredictState"[^\\n]*"tool":"${escapeForRegExp(tool)}"`,
      ),
    );
    expect(
      predictIdx,
      `a PredictState custom event naming ${tool} must reach the wire`,
    ).toBeGreaterThanOrEqual(0);

    // The whole mapping entry as one object, scoped to the single frame. Three
    // separate `toContain` checks would each pass against a DIFFERENT entry in
    // the array, and a bare `toContain(stateKey)` would pass on the tool name
    // alone whenever the key is a substring of it ("document" sits inside
    // "write_document"). Asserting the object also covers `tool_argument`,
    // without which the mapping cannot drive anything. Key order is the order
    // both bridges build the payload in.
    const predictFrame = sseFrameAt(sse, predictIdx);
    expect(
      predictFrame,
      `PredictState must map ${tool}'s ${argument} argument onto ${stateKey}`,
    ).toContain(
      `{"state_key":"${stateKey}","tool":"${tool}","tool_argument":"${argument}"}`,
    );

    const startRe = new RegExp(
      `"type":"TOOL_CALL_START"[^\\n]*"toolCallName":"${escapeForRegExp(tool)}"[^\\n]*`,
    );
    const startMatch = sse.match(startRe);
    expect(
      startMatch,
      `${tool} TOOL_CALL_START must reach the wire`,
    ).not.toBeNull();

    // The mapping is useless to the browser once the arguments have gone by, so
    // ordering is part of the contract, not an incidental detail.
    expect(
      predictIdx,
      "PredictState must precede the tool call it describes",
    ).toBeLessThan(startMatch!.index!);

    const callId = startMatch![0].match(/"toolCallId":"([^"]+)"/)?.[1];
    expect(callId, "TOOL_CALL_START must carry a toolCallId").toBeTruthy();
    const argFrames = sse.match(
      new RegExp(
        `"type":"TOOL_CALL_ARGS"[^\\n]*"toolCallId":"${escapeForRegExp(callId!)}"`,
        "g",
      ),
    );
    // One frame means the provider buffered the arguments, which leaves nothing
    // to predict from even with the mapping present.
    expect(
      argFrames?.length ?? 0,
      `${tool} arguments must stream as multiple incremental deltas`,
    ).toBeGreaterThanOrEqual(3);
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/crewAIPages/HumanInLoopPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import { sendAndAwaitResponse } from "../../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../../lib/constants";

export class HumanInLoopPage {
  readonly page: Page;
  readonly planTaskButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly plan: Locator;
  readonly performStepsButton: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.planTaskButton = page.getByRole("button", {
      name: "Human in the loop Plan a task",
    });
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.plan = page.getByTestId("select-steps");
    this.performStepsButton = page.getByRole("button", { name: "Confirm" });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendAndAwaitResponse(this.page, message);
  }

  async selectItemsInPlanner() {
    await expect(this.plan).toBeVisible();
    await this.plan.click();
  }

  async getPlannerOnClick(name: string | RegExp) {
    return this.page.getByRole("button", { name });
  }

  async uncheckItem(identifier: number | string): Promise<string> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof identifier === "number") {
      item = items.nth(identifier);
    } else {
      item = items
        .filter({
          has: this.page
            .getByTestId("step-text")
            .filter({ hasText: identifier }),
        })
        .first();
    }
    const stepTextElement = item.getByTestId("step-text");
    const text = await stepTextElement.innerText();
    await item.click();

    return text;
  }

  async isStepItemUnchecked(target: number | string): Promise<boolean> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof target === "number") {
      item = items.nth(target);
    } else {
      item = items
        .filter({
          has: this.page.getByTestId("step-text").filter({ hasText: target }),
        })
        .first();
    }
    const checkbox = item.locator('input[type="checkbox"]');
    return !(await checkbox.isChecked());
  }

  async performSteps() {
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
  }

  async performStepsAndAwait() {
    const countBefore = await this.page
      .locator('[data-testid="copilot-assistant-message"]')
      .count();
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
    await this.page.waitForFunction(
      (before) =>
        document.querySelectorAll('[data-testid="copilot-assistant-message"]')
          .length > before,
      countBefore,
      { timeout: 30000 },
    );
    await this.page.waitForFunction(
      () => document.querySelector('[data-copilot-running="false"]') !== null,
      null,
      { timeout: 60000 },
    );
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(
      this.agentMessage.last().getByText(expectedText),
    ).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/crewAIPages/PredictiveStateUpdatesPage.ts`
```
import { Page, Locator, expect } from '@playwright/test';
import { CopilotSelectors } from '../../utils/copilot-selectors';
import { sendChatMessage, awaitLLMResponseDone } from '../../utils/copilot-actions';
import { DEFAULT_WELCOME_MESSAGE } from '../../lib/constants';

export class PredictiveStateUpdatesPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly agentResponsePrompt: Locator;
  readonly userApprovalModal: Locator;
  readonly approveButton: Locator;
  readonly acceptedButton: Locator;
  readonly confirmedChangesResponse: Locator;
  readonly rejectedChangesResponse: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;
  readonly highlights: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.agentResponsePrompt = page.locator('div.tiptap.ProseMirror');
    this.userApprovalModal = page.locator('[data-testid="confirm-changes-modal"]').last();
    this.acceptedButton = page.getByText('✓ Accepted');
    this.confirmedChangesResponse = CopilotSelectors.assistantMessages(page).last();
    this.rejectedChangesResponse = CopilotSelectors.assistantMessages(page).last();
    this.highlights = page.locator('.tiptap em');
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendChatMessage(this.page, message);
  }

  async getPredictiveResponse() {
    await expect(this.agentResponsePrompt).toBeVisible();
    await this.agentResponsePrompt.click();
  }

  async getButton(page, buttonName) {
    return page.getByRole('button', { name: buttonName }).click();
  }

  async getStatusLabelOfButton(page, statusText) {
    return page.getByText(statusText, { exact: true });
  }

  async getUserApproval() {
    const confirmBtn = this.userApprovalModal.locator('[data-testid="confirm-button"]');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await awaitLLMResponseDone(this.page);
  }

  async getUserRejection() {
    const rejectBtn = this.userApprovalModal.locator('[data-testid="reject-button"]');
    await expect(rejectBtn).toBeEnabled();
    await rejectBtn.click();
    await awaitLLMResponseDone(this.page);
  }

  async verifyAgentResponse(dragonName) {
    const paragraphWithName = this.page.locator(`div.tiptap >> text=${dragonName}`).first();
    await expect(paragraphWithName).toBeVisible();

    const fullText = await paragraphWithName.textContent();
    if (!fullText) {
      return null;
    }

    const match = fullText.match(new RegExp(dragonName, 'i'));
    return match ? match[0] : null;
  }

  async verifyHighlightedText(){
    const highlightSelectors = [
      '.tiptap em',
      '.tiptap s',
      'div.tiptap em',
      'div.tiptap s'
    ];

    let count = 0;
    for (const selector of highlightSelectors) {
      count = await this.page.locator(selector).count();
      if (count > 0) {
        break;
      }
    }

    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      const modal = this.page.locator('[data-testid="confirm-changes-modal"]').last();
      await expect(modal).toBeVisible();
    }
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/langGraphFastAPIPages/HumanInLoopPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import { sendAndAwaitResponse } from "../../utils/copilot-actions";

export class HumanInLoopPage {
  readonly page: Page;
  readonly planTaskButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly plan: Locator;
  readonly performStepsButton: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.planTaskButton = page.getByRole("button", {
      name: "Human in the loop Plan a task",
    });
    this.agentGreeting = page.getByText(
      "This agent demonstrates human-in-the-loop",
    );
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.plan = page.getByTestId("select-steps");
    this.performStepsButton = page.getByRole("button", {
      name: "✨Perform Steps",
    });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await this.planTaskButton.click();
  }

  async sendMessage(message: string) {
    await sendAndAwaitResponse(this.page, message);
  }

  async selectItemsInPlanner() {
    await expect(this.plan).toBeVisible();
    await this.plan.click();
  }

  async getPlannerOnClick(name: string | RegExp) {
    return this.page.getByRole("button", { name });
  }

  async uncheckItem(identifier: number | string): Promise<string> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof identifier === "number") {
      item = items.nth(identifier);
    } else {
      item = items
        .filter({
          has: this.page
            .getByTestId("step-text")
            .filter({ hasText: identifier }),
        })
        .first();
    }
    const stepTextElement = item.getByTestId("step-text");
    const text = await stepTextElement.innerText();
    await item.click();
    return text;
  }

  async isStepItemUnchecked(target: number | string): Promise<boolean> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof target === "number") {
      item = items.nth(target);
    } else {
      item = items
        .filter({
          has: this.page.getByTestId("step-text").filter({ hasText: target }),
        })
        .first();
    }

    const checkbox = item.locator('input[type="checkbox"]');
    return !(await checkbox.isChecked());
  }

  async performSteps() {
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
  }

  async performStepsAndAwait() {
    const countBefore = await this.page
      .locator('[data-testid="copilot-assistant-message"]')
      .count();
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
    await this.page.waitForFunction(
      (before) =>
        document.querySelectorAll('[data-testid="copilot-assistant-message"]')
          .length > before,
      countBefore,
      { timeout: 30000 },
    );
    await this.page.waitForFunction(
      () => document.querySelector('[data-copilot-running="false"]') !== null,
      null,
      { timeout: 60000 },
    );
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(
      this.agentMessage.last().getByText(expectedText),
    ).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/langGraphFastAPIPages/PredictiveStateUpdatesPage.ts`
```
import { Page, Locator, expect } from '@playwright/test';
import { CopilotSelectors } from '../../utils/copilot-selectors';
import { sendChatMessage, awaitLLMResponseDone } from '../../utils/copilot-actions';
import { DEFAULT_WELCOME_MESSAGE } from '../../lib/constants';

export class PredictiveStateUpdatesPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly agentResponsePrompt: Locator;
  readonly userApprovalModal: Locator;
  readonly approveButton: Locator;
  readonly acceptedButton: Locator;
  readonly confirmedChangesResponse: Locator;
  readonly rejectedChangesResponse: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;
  readonly highlights: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    this.agentResponsePrompt = page.locator('div.tiptap.ProseMirror');
    this.userApprovalModal = page.locator('[data-testid="confirm-changes-modal"]').last();
    this.approveButton = page.getByText('✓ Accepted');
    this.acceptedButton = page.getByText('✓ Accepted');
    this.confirmedChangesResponse = CopilotSelectors.assistantMessages(page).last();
    this.rejectedChangesResponse = CopilotSelectors.assistantMessages(page).last();
    this.highlights = page.locator('.tiptap em');
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendChatMessage(this.page, message);
  }

  async getPredictiveResponse() {
    await expect(this.agentResponsePrompt).toBeVisible();
    await this.agentResponsePrompt.click();
  }

  async getButton(page, buttonName) {
    return page.getByRole('button', { name: buttonName }).click();
  }

  async getStatusLabelOfButton(page, statusText) {
    return page.getByText(statusText, { exact: true });
  }

  async getUserApproval() {
    const confirmBtn = this.userApprovalModal.locator('[data-testid="confirm-button"]');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await awaitLLMResponseDone(this.page);
  }

  async getUserRejection() {
    const rejectBtn = this.userApprovalModal.locator('[data-testid="reject-button"]');
    await expect(rejectBtn).toBeEnabled();
    await rejectBtn.click();
    await awaitLLMResponseDone(this.page);
  }

  async verifyAgentResponse(dragonName) {
    const paragraphWithName = this.page.locator(`div.tiptap >> text=${dragonName}`).first();
    await expect(paragraphWithName).toBeVisible();

    const fullText = await paragraphWithName.textContent();
    if (!fullText) {
      return null;
    }

    const match = fullText.match(new RegExp(dragonName, 'i'));
    return match ? match[0] : null;
  }

  async verifyHighlightedText(){
    const highlightSelectors = [
      '.tiptap em',
      '.tiptap s',
      'div.tiptap em',
      'div.tiptap s'
    ];

    let count = 0;
    for (const selector of highlightSelectors) {
      count = await this.page.locator(selector).count();
      if (count > 0) {
        break;
      }
    }

    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      const modal = this.page.locator('[data-testid="confirm-changes-modal"]').last();
      await expect(modal).toBeVisible();
    }
  }
}

```

### Core Architecture Module: `apps/dojo/e2e/pages/langGraphPages/HumanInLoopPage.ts`
```
import { Page, Locator, expect } from "@playwright/test";
import { CopilotSelectors } from "../../utils/copilot-selectors";
import { sendAndAwaitResponse } from "../../utils/copilot-actions";
import { DEFAULT_WELCOME_MESSAGE } from "../../lib/constants";

export class HumanInLoopPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentGreeting: Locator;
  readonly plan: Locator;
  readonly performStepsButton: Locator;
  readonly agentMessage: Locator;
  readonly userMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = CopilotSelectors.chatTextarea(page);
    this.sendButton = CopilotSelectors.sendButton(page);
    // V2 CopilotChat renders inline with this welcome text
    this.agentGreeting = page.getByText(DEFAULT_WELCOME_MESSAGE);
    this.plan = page.getByTestId("select-steps");
    this.performStepsButton = page.getByRole("button", {
      name: /Perform Steps/,
    });
    this.agentMessage = CopilotSelectors.assistantMessages(page);
    this.userMessage = CopilotSelectors.userMessages(page);
  }

  async openChat() {
    // V2 CopilotChat renders inline (no toggle button), just wait for it to be ready
    await expect(this.agentGreeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await sendAndAwaitResponse(this.page, message);
  }

  async selectItemsInPlanner() {
    await expect(this.plan).toBeVisible();
    await this.plan.click();
  }

  async getPlannerOnClick(name: string | RegExp) {
    return this.page.getByRole("button", { name });
  }

  async uncheckItem(identifier: number | string): Promise<string> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof identifier === "number") {
      item = items.nth(identifier);
    } else {
      item = items
        .filter({
          has: this.page
            .getByTestId("step-text")
            .filter({ hasText: identifier }),
        })
        .first();
    }
    const stepTextElement = item.getByTestId("step-text");
    const text = await stepTextElement.innerText();
    await item.click();
    return text;
  }

  async isStepItemUnchecked(target: number | string): Promise<boolean> {
    const plannerContainer = this.page.getByTestId("select-steps");
    const items = plannerContainer.getByTestId("step-item");

    let item;
    if (typeof target === "number") {
      item = items.nth(target);
    } else {
      item = items
        .filter({
          has: this.page.getByTestId("step-text").filter({ hasText: target }),
        })
        .first();
    }

    const checkbox = item.locator('input[type="checkbox"]');
    return !(await checkbox.isChecked());
  }

  async performSteps() {
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
  }

  async performStepsAndAwait() {
    const countBefore = await this.page
      .locator('[data-testid="copilot-assistant-message"]')
      .count();
    await this.performStepsButton.click();
    await this.performStepsButton.waitFor({ state: "hidden" });
    await this.page.waitForFunction(
      (before) =>
        document.querySelectorAll('[data-testid="copilot-assistant-message"]')
          .length > before,
      countBefore,
      { timeout: 30000 },
    );
    await this.page.waitForFunction(
      () => document.querySelector('[data-copilot-running="false"]') !== null,
      null,
      { timeout: 60000 },
    );
  }

  async assertAgentReplyVisible(expectedText: RegExp) {
    await expect(
      this.agentMessage.last().getByText(expectedText),
    ).toBeVisible();
  }

  async assertUserMessageVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2763** (2026-09-15): **[Bug]: @ag-ui/mastra: Make `@copilotkit/runtime` an optional peer dependency**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  ### Problem  `@ag-ui/mastra` currently declares `@copilotkit/runtime` as a required peer dependency:  ```json "peerDependencies": {   "@copilotkit/runtime": "^1.60.1" } ``` However, the base Mastra integration does not use CopilotKit:  ```ts import { MastraAgent } from "@ag-ui/mastra"; ```  The CopilotKit runtime is only imported by the optional `@ag-ui/mastra/copilotkit` entry point, which exposes `registerCopilotKit`.  Because peer dependencies are declared at package level, package managers such as pnpm install or require `@copilotkit/runtime` even when consumers only use the base Mastra integration. Disabling automatic peer installation isn't a good workaround because it also disables installation of the peers required by Mastra and AG-UI.  ### Expected behavior  Consumers using only `@ag-ui/mastra` or `@ag-ui/mastra/a2ui` should not need to install `@copilotkit/runtime`.  Consumers using `@ag-ui/mastra/copilotkit` should install `@copilotkit/runtime` explicitly.  ### Proposed solution  Mark `@copilotkit/runtime` as an optional peer dependency:  ```json "peerDependencies": {   "@ag-ui/core": ">=0.0.58",   "@ag-ui/client": ">=0.0.58",   "@copilotkit/runtime": "^1.60.1",   "@mastra/client-js": ">=1.0.0-0 <2.0.0-0",   "@mastra/core": ">=1.29.0 <2.0.0-0" }, "pe

- **Issue #2744** (2026-09-15): **[Bug]: ag-ui-watsonx __init__ eagerly imports fastapi, breaking FastAPI-free (non-web) installs**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  `fastapi` is declared as an **optional** dependency in the `ag-ui-watsonx` `pyproject.toml`:  ```toml [project.optional-dependencies] fastapi = ["fastapi>=0.115.12"] ```  …but the package's top-level `__init__.py` unconditionally imports the FastAPI endpoint module:  ```python # ag_ui_watsonx/__init__.py from .endpoint import add_watsonx_fastapi_endpoint ```  and `endpoint.py` imports FastAPI at module top:  ```python # ag_ui_watsonx/endpoint.py from fastapi import APIRouter, FastAPI, Request from fastapi.responses import StreamingResponse ```  Because Python evaluates a package's `__init__.py` before any submodule, **any** import from the package fails on a default install (`pip install ag-ui-watsonx`, i.e. without the `[fastapi]` extra). The "optional" dependency is effectively mandatory for every consumer.  Notably, the rest of the package already treats FastAPI as optional:  - `agent.py` only depends on `httpx` + `ag-ui-core` — the adapter itself (`WatsonxAgent.run`) is a FastAPI-free in-process async generator. - `utils.py` already uses `TYPE_CHECKING` + function-level imports for FastAPI.  So the eager import in `__init__.py` looks unintended, and in-process consumers that never touch the HTTP endpoint cannot import the adapter at all.  This is the same r

- **Issue #2656** (2026-09-09): **[Bug]: Java core lacks the reasoning role and message type needed for conversation history**
  *Symptoms*: ### Describe the bug  `com.ag-ui.community:java-core:0.1.0` defines reasoning events but cannot represent a reasoning message in conversation history. A standard AG-UI client stores streamed reasoning as a message with `role: "reasoning"` and includes it in subsequent `RunAgentInput.messages`. The Java core model has no corresponding role or message type, preventing a normal reasoning conversation from completing a client/server round trip.  The omissions are present in the published Maven Central JAR and on current `main` at `ce1bdef573dbab4ad15be62a788e6c8891aa9d48`:  - [`Role`](https://github.com/ag-ui-protocol/ag-ui/blob/ce1bdef573dbab4ad15be62a788e6c8891aa9d48/sdks/community/java/ag-ui/core/src/main/java/com/agui/community/core/message/Role.java#L9-L24) has no `REASONING("reasoning")` value. - The [sealed `Message` interface](https://github.com/ag-ui-protocol/ag-ui/blob/ce1bdef573dbab4ad15be62a788e6c8891aa9d48/sdks/community/java/ag-ui/core/src/main/java/com/agui/community/core/message/Message.java#L13-L14) permits only developer, system, assistant, user, and tool messages. There is no `ReasoningMessage`, and downstream integrations cannot add their own subtype to this sealed hierarchy. - The related [`ReasoningMessageStartEvent`](https://github.com/ag-ui-protocol/ag-ui/blob/ce1bdef573dbab4ad15be62a788e6c8891aa9d48/sdks/community/java/ag-ui/core/src/main/java/com/agui/community/core/event/ReasoningMessageStartEvent.java#L15) has only `messageId`, `timestamp`, and `rawEve

- **Issue #2577** (2026-09-26): **[Bug]: .NET AGUI.Client buffers tool-call updates until all TOOL_CALL_RESULT events arrive**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  ## Summary  `AGUI.Client`'s `IChatClient` adapter does not surface a `FunctionCallContent` update when the corresponding `TOOL_CALL_END` event is received. Instead, it buffers the call until a `TOOL_CALL_RESULT` arrives. With parallel tool calls, it waits until **all** pending results arrive before releasing any of the buffered call/result updates.  This makes long-running backend tools invisible to consumers while they are executing. A UI cannot show an in-progress state: the tool call and result appear together only after execution has completed.  The AG-UI wire stream contains the lifecycle events at the expected times; the observable delay is introduced while converting `BaseEvent` objects into `ChatResponseUpdate` objects.  ### Steps to Reproduce  1. Install `AGUI.Client` 0.0.6 and consume an AG-UI endpoint through `AGUIChatClient.GetStreamingResponseAsync(...)`. 2. Have the endpoint emit a backend tool lifecycle with a noticeable delay before the result:     ```text    RUN_STARTED    TOOL_CALL_START(call_1, slow_tool)    TOOL_CALL_ARGS(call_1, {...})    TOOL_CALL_END(call_1)    # wait several seconds while the tool executes    TOOL_CALL_RESULT(call_1, ...)    RUN_FINISHED    ```  3. Enumerate the returned `ChatResponseUpdate` stream and log the arrival ti
  **Post-Mortem & Fix Analysis**:
  > I opened a focused client fix in https://github.com/ag-ui-protocol/ag-ui/pull/2578.  `TOOL_CALL_END` now yields `FunctionCallContent` immediately, each `TOOL_CALL_RESULT` flushes that call only, and a tool-call interrupt still emits `ToolApprovalRequestContent` after the in-progress call update.

- **Issue #2561** (2026-08-31): **[Bug]: Strands metadata events aren't emitted in**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  In the ag_ui_strands Python package there was a really helpful addition added in https://github.com/ag-ui-protocol/ag-ui/pull/2355 to emit raw events for things that aren't handled.   However due to a conditional for [managing "contentBlockStop" events](https://github.com/ag-ui-protocol/ag-ui/blob/312533723fb550fa26dad4cf120829cf92228550/integrations/aws-strands/python/src/ag_ui_strands/agent.py#L4891-L4894), any events for that have a key of "event" are not included in this raw event output and can't be output.  While many of the things that have an "event" key  are things that are dealt with in other parts of the (e.g. "contentBlockDelta", ""contentBlockStart" and "messageStop") there are at least some that have data that is not output in any other place. For our team this one is metadata which, as we are users of AWS Bedrock Guardrails, seems to be the only place the outputs of these are emitted (as well as token information that could have UI usage).  Most significantly for us is that we're using AWS Bedrock Guardrails as part of our product and we want to change the user interface based on what guardrail triggers. The only event that Strands outputs that contains this data is a metadata event, and this is not information that the AG-UI Strands agent output

- **Issue #2537** (2026-08-26): **[Bug]: : [AWS-Strands] frontend-tool result delivered on a later turn (no immediate continuation) is never reconciled into the SessionManager store**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug   ## Title  `[Bug]: [AWS-Strands] frontend-tool result delivered on a later turn (no immediate continuation) is never reconciled into the SessionManager store`  ---  ## Body  ### Describe the Bug  With a session manager, a frontend (client-executed) tool's real result is only reconciled into the persisted store when it arrives as an **immediate / trailing** continuation. If the result instead arrives on a **later** turn — bundled in history, followed by a new user message — the reconcile skips it and the persisted `toolResult` stays the `"Forwarded to client"` placeholder forever.  Why the later-turn path happens in practice: the adapter finishes a frontend-tool turn with `RUN_FINISHED outcome=success` while the client tool is still unresolved. This causes frameworks like `@assistant-ui/react-ag-ui` to then marks the turn `complete` (not `requires-action`), so it never auto-fires the trailing continuation. The client-executed result therefore only reaches the server on the *next* user turn — the non-trailing case the reconcile ignores.  Net effect is the same store corruption as #2222, on a path #2222's fix doesn't cover. Distinct from #2376/#2511, which fix the *model prompt* on a trailing delta-only continuation: this is about the persisted **store**, and abou
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this. Verified against main at 374f7cd2 — the mechanism is as reported.  The chain: pending_tool_result_ids is built trailing-only at agent.py:2614-2622 (reversed(...) plus else: break). The frontend-result collection is gated on that set at agent.py:2950, so a tool result that is not last in the payload never enters frontend_results. has_nonvoid_frontend_result at agent.py:2985-2987 is therefore False, the reconcile_session_results gate at agent.py:3046-3057 evaluates False, and reconcile_frontend_tool_results at agent.py:3111 never runs for that call. The persisted toolResult keeps PROXY_RESULT_PLACEHOLDER. This is reachable on the default configuration: replay_history_into_strands is True at config.py:167.  On why the trailing scope can be widened safely. The comment at agent.py:2939-2943 gives its reason: historical results "can never be re-corrected and would force the legacy fallback every turn". That concern is already answered one layer down, in two independent
  > @TheSeydiCharyyev / @ranst91  Thanks for taking this up, do you know when this would be available on pypy?
  > @Avinm It's merged into main but not in a released version yet. The aws-strands Python package ships on its own cycle, through a separate PR titled "release: integration-aws-strands-py" — the most recent one was #2404 on Aug 14. I hope the next one will include this fix. 

- **Issue #2516** (2026-09-03): **[BUG]: aws-strands Python URL fetching lacks request-level resource budgets and blocks the event loop**
  *Symptoms*: ## Context  Follow-up to review point 3 on #2491.  #2491 adds a per-attachment response-size cap and socket timeout to the AWS Strands Python URL-content path. Those controls bound one response body, but they do not bound all work performed while converting one request.  ## Problem  The Python adapter currently has no request-level limit on:  - the number of URL-backed attachments; - cumulative downloaded or retained bytes across attachments; or - total wall-clock time spent resolving, connecting, following redirects, and reading responses.  The socket timeout is an inactivity timeout. A server that continues sending data before each timeout can keep the synchronous fetch alive indefinitely. URL fetching also runs synchronously during request preprocessing, so a slow remote source can block the async request loop.  This is an availability and resource-exhaustion risk (CWE-400), even with the per-attachment cap from #2491.  ## Expected behavior  One content-conversion/request operation should have a shared resource budget that is enforced across every URL-backed attachment and every fetch phase. Blocking network work must not run on the async request loop.  ## Acceptance criteria  - A safe default limits the number of URL-backed attachments processed per request. - A cumulative byte budget is shared across all URL-backed attachments; once exhausted, no additional URL fetch begins. - A monotonic total deadline covers DNS resolution, connection, redirects, and body reads across 

- **Issue #2425** (2026-08-26): **[Bug]: ag_ui_strands: every document block is named "document", so a second document permanently breaks a Bedrock conversation**
  *Symptoms*: ### Pre-flight Checklist  - [x] I have searched [existing issues](https://github.com/ag-ui-protocol/ag-ui/issues) and this hasn't been reported yet. - [x] I am using the **latest** version AG-UI.  ### Describe the Bug  `convert_agui_content_to_strands` hardcodes the Bedrock document name:  https://github.com/ag-ui-protocol/ag-ui/blob/main/integrations/aws-strands/python/src/ag_ui_strands/utils.py#L166  ```python blocks.append({     "document": {         "format": fmt,         "name": "document",      # <-- same literal for every document         "source": {"bytes": raw},     } }) ```  Bedrock's Converse API requires document names to be **unique within a request**. With two or more `DocumentInputContent` items, the adapter emits a payload that violates that contract, and Bedrock rejects the whole request:  ``` ValidationException: Messages can't contain duplicate document names. Rename the document and retry your request. ```  Two properties make this worse than a single failed turn:  1. **Converse is stateless** — the full conversation is replayed on every turn. So the second document does not have to be in the same message. A PDF attached in turn 1 and another in turn 8 collide, because both are in turn 8's `messages` array. 2. **The failure is permanent.** Once both documents are in persisted session history, every subsequent turn replays them and fails identically — including plain-text turns with no attachments. The conversation cannot recover; only starting a new thread
  **Post-Mortem & Fix Analysis**:
  > Hi @ag-ui-protocol/copilotkit — could you assign this issue to me?  I've confirmed there is no open PR for this bug and reviewed the current AWS Strands conversion path.  Proposed scope:  - Generate neutral, Bedrock-valid document names from stable AG-UI message/document identity plus a digest, rather than placing raw filenames or metadata in the model-visible name. - Thread the message ID and document ordinal through history conversion so names remain deterministic on replay and distinct across turns, including when two attachments have identical bytes. - Keep a deterministic fallback for direct converter callers that do not provide a message identity. - Add no-AWS regression coverage for multiple documents in one message, documents across different turns, identical content, unsafe/invalid metadata, and the no-metadata fallback.  This keeps the patch focused on #2425 while respecting Bedrock's character/length constraints and neutral-name guidance. If that direction aligns with the ma
  > Hey @green3sf,  Sorry for the slow reply. Taking you up on this one, it's yours.  The part of your scope that matters most is stable names per file across replayed turns rather than positional ones, since that's what actually breaks the thread. One heads up while you're testing: the silent-failure symptom you may run into is #1976, which is separate from this.  Ping me when the PR is up. 
  > Thanks for the fix.  Is there an ETA when a new version for ag-ui-strands will be released?

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `e0e6bff8` (2026-10-05)
**Commit Message**: Merge pull request #2945 from ag-ui-protocol/fix/pni-568-a2ui-recovery

fix(a2ui): recover unanswered calls before native continuation

**File**: `apps/dojo/e2e/tests/langgraphTypescriptTests/a2uiRecovery.event-trace.ts` (modified, +122/-177)
```diff
@@ -1,37 +1,23 @@
 import { defineEventTrace } from "../../event-trace-test";
 
 // Generated by the event trace updater.
-// Reason: CopilotKit 1.76.0 is an AG-UI 1.0 client: RunAgentInput now carries protocolVersion "1.0"
+// Reason: PNI-568: capture with the CI examples-backend lockfile and workspace middleware; preserve failed render results and lifecycle activities.
 // Before accepting changes, verify whether the implementation regressed.
 const shared1 =
-  'Available A2UI catalog:\n- https://a2ui.org/demos/dojo/dynamic_catalog.json\n  Custom catalog (does NOT include all basic components).\n  Custom components:\n  - HotelCard:\n    {\n      "type": "object",\n      "properties": {\n        "accessibility": {\n          "type": "object",\n          "properties": {\n            "label": {\n              "anyOf": [\n                {\n                  "type": "string"\n                },\n                {\n                  "type": "object",\n                  "properties": {\n                    "path": {\n                      "type": "string",\n                      "description": "A JSON Pointer path to a value in the data model."\n                    }\n                  },\n                  "required": [\n                    "path"\n                  ],\n                  "additionalProperties": false\n                },\n                {\n                  "type": "object",\n                  "properties": {\n                    "call": {\n                      "type": "string",\n                      "description": "The name of the function to call."\n                    },\n                    "args": {\n                      "type": "object",\n                      "additionalProperties": {},\n                      "description": "Arguments passed to the function."\n                    },\n                    "returnType": {\n                      "type": "string",\n                      "enum": [\n                        "string",\n                        "number",\n                        "boolean",\n                        "array",\n                        "object",\n                        "any",\n                        "void"\n                      ],\n                      "default": "boolean"\n                    }\n                  },\n                  "required": [\n                    "call",\n                    "args"\n                  ],\n                  "additionalProperties": false\n                }\n              ],\n              "description": "REF:common_types.json#/$defs/DynamicString|A short string used by assistive technologies to convey the purpose of an element."\n            },\n            "description": {\n              "$ref": "#/properties/accessibility/properties/label",\n              "description": "REF:common_types.json#/$defs/DynamicString|Additional information provided by assistive technologies about an element."\n            }\n          },\n          "additionalProperties": false,\n          "description": "REF:common_types.json#/$defs/AccessibilityAttributes|Attributes to enhance accessibility."\n        },\n        "weight": {\n          "type": "number"\n        },\n        "name": {\n          "$ref": "#/properties/accessibility/properties/label"\n        },\n        "location": {\n          "$ref": "#/properties/accessibility/properties/label"\n        },\n        "rating": {\n          "anyOf": [\n            {\n              "type": "number"\n            },\n            {\n              "$ref": "#/properties/accessibility/properties/label/anyOf/1"\n            },\n            {\n              "$ref": "#/properties/accessibility/properties/label/anyOf/2"\n            }\n          ]\n        },\n        "pricePerNight": {\n          "$ref": "#/properties/accessibility/properties/label"\n        },\n        "amenities": {\n          "$ref": "#/properties/accessibility/properties/label"\n        },\n        "action": {\n          "anyOf": [\n            {\n              "type": "object",\n              "properties": {\n                "event": {\n                  "type": "object",\n                  "properties": {\n                    "name": {\n                      "type": "string"\n                    },\n                    "context": {\n                      "type": "object",\n                      "additionalProperties": {\n                        "anyOf": [\n                          {\n                            "type": "string"\n                          },\n                          {\n                            "type": "number"\n                          },\n                          {\n                            "type": "boolean"\n                          },\n                          {\n                            "type": "array"\n                          },\n                          {\n                            "$ref": "#/properties/accessibility/properties/label/anyOf/1"\n                          },\n               
```

**File**: `apps/dojo/src/agents.ts` (modified, +7/-2)
```diff
@@ -390,11 +390,16 @@ export const agentsIntegrations = {
       graphId: "a2ui_dynamic_schema",
     }),
     // OSS-162: A2UI error-recovery showcase (sub-agent emits a structural error,
-    // then recovers). Rides the runtime a2ui middleware like the others.
+    // then recovers). Use the workspace middleware so browser tests cover it.
     a2ui_recovery: new LangGraphAgent({
       deploymentUrl: envVars.langgraphTypescriptUrl,
       graphId: "a2ui_recovery",
-    }),
+    }).use(
+      new A2UIMiddleware({
+        injectA2UITool: true,
+        defaultCatalogId: "https://a2ui.org/demos/dojo/dynamic_catalog.json",
+      }),
+    ),
   }),
 
   // TODO: fix this — CopilotKit 1.60.x bump flips @langchain/openai onto
```

**File**: `apps/dojo/src/app/api/copilotkit/[integrationId]/[[...slug]]/route.ts` (modified, +4/-1)
```diff
@@ -79,7 +79,10 @@ async function getHandler(integrationId: string) {
           ? CREWAI_A2UI_INJECT_AGENTS
           : [];
   const a2uiAgents = allA2UIAgents.filter(
-    (id) => !perAgentInjectIds.includes(id),
+    (id) =>
+      !perAgentInjectIds.includes(id) &&
+      // This journey explicitly exercises the workspace A2UI middleware.
+      !(integrationId === "langgraph-typescript" && id === "a2ui_recovery"),
   );
 
   const runtime = new CopilotRuntime({
```

**File**: `integrations/langgraph/typescript/src/__tests__/a2ui-checkpoint-recovery.test.ts` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+import { describe, it, expect, vi } from "vitest";
+import { LangGraphAgent } from "../agent";
+import { langchainMessagesToAgui } from "../utils";
+import fixture from "../../../../../middlewares/a2ui-middleware/__tests__/fixtures/pni-568-orphan.json";
+function buildAgent(checkpointMessages: any[], history: any[]) {
+  const agent = new LangGraphAgent({
+    graphId: "test-graph",
+    deploymentUrl: "http://localhost:8000",
+  });
+
+  (agent as any).activeRun = {
+    id: "run-1",
+    threadId: "thread-1",
+    hasFunctionStreaming: false,
+    modelMadeToolCall: false,
+  };
+  // Pre-set assistant so prepareStream doesn't need a live search.
+  (agent as any).assistant = {
+    assistant_id: "asst-1",
+    graph_id: "test-graph",
+    config: { configurable: {} },
+  };
+
+  const streamCalls: any[] = [];
+  (agent as any).client = {
+    threads: {
+      get: vi.fn().mockResolvedValue({ thread_id: "thread-1" }),
+      create: vi.fn().mockResolvedValue({ thread_id: "thread-1" }),
+      getState: vi
+        .fn()
+        .mockResolvedValue({
+          values: { messages: checkpointMessages },
+          tasks: [],
+        }),
+      getHistory: vi.fn().mockResolvedValue(history),
+      updateState: vi
+        .fn()
+        .mockResolvedValue({ checkpoint: { checkpoint_id: "ck-fork" } }),
+    },
+    assistants: {
+      search: vi
+        .fn()
+        .mockResolvedValue([
+          {
+            assistant_id: "asst-1",
+            graph_id: "test-graph",
+            config: { configurable: {} },
+          },
+        ]),
+      getGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
+      getSchemas: vi.fn().mockResolvedValue({
+        input_schema: { properties: { messages: {}, tools: {} } },
+        output_schema: { properties: { messages: {}, tools: {} } },
+      }),
+    },
+    runs: {
+      stream: vi
+        .fn()
+        .mockImplementation((_t: string, _a: string, payload: any) => {
+          streamCalls.push(payload);
+          return {
+            [Symbol.asyncIterator]() {
+              return { next: async () => ({ done: true, value: undefined }) };
+            },
+          };
+        }),
+    },
+  };
+
+  const events: any[] = [];
+  (agent as any).subscriber = {
+    next: (e: any) => events.push(e),
+    error: vi.fn(),
+    complete: vi.fn(),
+    closed: false,
+  };
+
+  return { agent, events, streamCalls };
+}
+
+const STREAM_MODE = ["events", "values", "updates", "messages-tuple"] as const;
+
+const result = {
+  id: "recovery",
+  role: "tool",
+  toolCallId: "call_25dQx1aDND8JEi4wmPYlEQ6z",
+  content: '{"status":"cancelled","code":"a2ui_unanswered_call"}',
+};
+describe("PNI-568 native continuation boundary", () => {
+  it("sends an atomic history repair to the original thread before the next model request", async () => {
+    const { agent, streamCalls } = buildAgent(fixture, []);
+    const messages = langchainMessagesToAgui(fixture as any);
+    await (agent as any).prepareStream(
+      {
+        threadId: "thread-1",
+        runId: "r",
+        messages: [
+          ...messages,
+          result,
+          { id: "new-user", role: "user", content: "Continue" },
+        ],
+        state: {},
+        tools: [],
+        context: [],
+        forwardedProps: {},
+      },
+      [...STREAM_MODE],
+    );
+    const repaired = streamCalls[0].input.messages.__overwrite__;
+    expect(
+      repaired.filter((m: any) => m.id !== "recovery" && m.id !== "new-user"),
+    ).toEqual(fixture);
+    expect(repaired.at(-3)).toMatchObject({
+      type: "tool",
+      tool_call_id: result.toolCallId,
+      id: "recovery",
+    });
+    expect(repaired.at(-2)).toEqual(fixture.at(-1));
+    expect((agent as any).client.threads.updateState).not.toHaveBeenCalled();
+  });
+  it("does not rewrite a checkpoint with a pending native interrupt", async () => {
+    const { agent, streamCalls } = buildAgent(fixture, []);
+    (agent as any).client.threads.getState.mockResolvedValue({
+      values: { messages: fixture },
+      tasks: [{ interrupts: [{ id: "approval", value: "Approve?" }] }],
+    });
+    await (agent as any).prepareStream(
+      {
+        threadId: "thread-1",
+        runId: "r",
+        messages: [...langchainMessagesToAgui(fixture as any), result],
+        state: {},
+        tools: [],
+        context: [],
+        forwardedProps: {},
+      },
+      [...STREAM_MODE],
+    );
+    expect(streamCalls).toHaveLength(0);
+    expect((agent as any).client.threads.updateState).not.toHaveBeenCalled();
+  });
+});
```

**File**: `integrations/langgraph/typescript/src/a2ui-history.test.ts` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+import { describe, it, expect } from "vitest";
+import type { Message } from "@langchain/langgraph-sdk";
+import {
+  recoverA2UIHistory,
+  preserveCompletedA2UIResults,
+} from "./a2ui-history";
+import fixture from "../../../../middlewares/a2ui-middleware/__tests__/fixtures/pni-568-orphan.json";
+
+const saved = fixture as Message[];
+const result: Message = {
+  type: "tool",
+  id: "recovery-result",
+  tool_call_id: "call_25dQx1aDND8JEi4wmPYlEQ6z",
+  content: '{"status":"cancelled","code":"a2ui_unanswered_call"}',
+};
+describe("PNI-568 native saved history", () => {
+  it("places the supplied outcome before the saved follow-up, preserving all original history", () => {
+    const repaired = recoverA2UIHistory(saved, [result])!;
+    expect(repaired.filter((message) => message !== result)).toEqual(saved);
+    const index = repaired.findIndex((message) => message === result);
+    expect(repaired[index - 1]).toMatchObject({
+      type: "ai",
+      tool_calls: [expect.objectContaining({ id: result.tool_call_id })],
+    });
+    expect(repaired[index + 1]).toMatchObject({ type: "human" });
+    expect(recoverA2UIHistory(repaired, [result])).toBeUndefined();
+  });
+  it("never invents an outcome or completes another pending tool", () => {
+    expect(recoverA2UIHistory(saved, [])).toBeUndefined();
+    expect(
+      recoverA2UIHistory(
+        [
+          {
+            type: "ai",
+            id: "approval",
+            content: "",
+            tool_calls: [{ id: "pending", name: "scheduleTime", args: {} }],
+          },
+        ],
+        [{ ...result, tool_call_id: "pending" }],
+      ),
+    ).toBeUndefined();
+  });
+  it("retains original completed IDs and contents on duplicate input", () => {
+    const completed = [...saved.slice(0, -1), result, saved.at(-1)!];
+    const duplicate = {
+      ...result,
+      id: "different-client-id",
+      content: "changed",
+    };
+    expect(recoverA2UIHistory(completed, [duplicate])).toBeUndefined();
+    expect(preserveCompletedA2UIResults(completed, [duplicate])).toEqual([]);
+  });
+});
```

**File**: `integrations/langgraph/typescript/src/a2ui-history.ts` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+import type { Message } from "@langchain/langgraph-sdk";
+
+/**
+ * Insert a supplied A2UI outcome next to its saved call. LangGraph's message
+ * reducer only appends new IDs, so an outcome arriving after a persisted user
+ * turn needs an atomic channel overwrite. Every saved message is retained.
+ * This never invents results or completes an approval: the middleware/caller
+ * must supply the actual outcome first.
+ */
+export function recoverA2UIHistory(
+  saved: Message[],
+  incoming: Message[],
+  toolName = "render_a2ui",
+): Message[] | undefined {
+  const answered = new Set(
+    saved.flatMap((message) =>
+      message.type === "tool" ? [message.tool_call_id] : [],
+    ),
+  );
+  const results = new Map(
+    incoming.flatMap((message) =>
+      message.type === "tool" && !answered.has(message.tool_call_id)
+        ? [[message.tool_call_id, message] as const]
+        : [],
+    ),
+  );
+  const recovered = new Set<string>();
+  const history: Message[] = [];
+  for (let index = 0; index < saved.length; index++) {
+    const message = saved[index];
+    history.push(message);
+    if (message.type !== "ai") continue;
+    const insert = (message.tool_calls ?? []).flatMap((call) => {
+      if (!call.id) return [];
+      const result = results.get(call.id);
+      if (call.name !== toolName || !result || recovered.has(call.id))
+        return [];
+      recovered.add(call.id);
+      return [result];
+    });
+    // Keep existing parallel tool results in their original order, then add
+    // the missing result before the next user/assistant message.
+    while (insert.length && saved[index + 1]?.type === "tool")
+      history.push(saved[++index]);
+    history.push(...insert);
+  }
+  if (!recovered.size) return undefined;
+  const ids = new Set(saved.map((message) => message.id));
+  history.push(
+    ...incoming.filter(
+      (message) =>
+        !ids.has(message.id) &&
+        !(message.type === "tool" && recovered.has(message.tool_call_id)),
+    ),
+  );
+  return history;
+}
+
+/** A saved outcome is authoritative even when an imported client assigns a new ID. */
+export function preserveCompletedA2UIResults(
+  saved: Message[],
+  incoming: Message[],
+  toolName = "render_a2ui",
+): Message[] {
+  const renderIds = new Set(
+    saved.flatMap((message) =>
+      message.type === "ai"
+        ? (message.tool_calls ?? [])
+            .filter((call) => call.name === toolName)
+            .map((call) => call.id)
+        : [],
+    ),
+  );
+  const completed = new Set(
+    saved.flatMap((message) =>
+      message.type === "tool" && renderIds.has(message.tool_call_id)
+        ? [message.tool_call_id]
+        : [],
+    ),
+  );
+  return incoming.filter(
+    (message) =>
+      message.type !== "tool" || !completed.has(message.tool_call_id),
+  );
+}
```

**File**: `integrations/langgraph/typescript/src/agent.ts` (modified, +17/-1)
```diff
@@ -1,3 +1,4 @@
+import { recoverA2UIHistory, preserveCompletedA2UIResults } from "./a2ui-history";
 import { Observable, Subscriber } from "rxjs";
 import {
   Client as LangGraphClient,
@@ -719,7 +720,10 @@ export class LangGraphAgent extends AbstractAgent {
       (await this.client.threads.getState(thread.thread_id)) ??
       ({ values: {} } as ThreadState<State>);
     const agentStateMessages = agentState.values.messages ?? [];
-    const inputMessagesToLangchain = aguiMessagesToLangChain(messages);
+    const a2uiToolName = typeof forwardedProps?.injectA2UITool === "string" ? forwardedProps.injectA2UITool : "render_a2ui";
+    const inputMessagesToLangchain = preserveCompletedA2UIResults(
+      agentStateMessages, aguiMessagesToLangChain(messages), a2uiToolName,
+    );
     const stateValuesDiff = this.langGraphDefaultMergeState(
       { ...inputState, messages: agentStateMessages },
       inputMessagesToLangchain,
@@ -839,6 +843,18 @@ export class LangGraphAgent extends AbstractAgent {
       schemaKeys: this.activeRun!.schemaKeys,
     });
 
+    // A late A2UI result must precede already-persisted user turns. Appending
+    // it through the messages reducer leaves the checkpoint invalid forever.
+    // Overwrite is atomic and retains every saved message, ID and result.
+    if (payloadInput && !hasResume && !(agentState.tasks ?? []).some((task) => task.interrupts?.length)) {
+      const repaired = recoverA2UIHistory(
+        agentStateMessages,
+        inputMessagesToLangchain,
+        a2uiToolName,
+      );
+      if (repaired) payloadInput.messages = { __overwrite__: repaired };
+    }
+
     let payloadConfig: LangGraphConfig | undefined;
     const configsToMerge = [
       this.assistantConfig,
```

**File**: `middlewares/a2ui-middleware/__tests__/fixtures/pni-568-orphan.json` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+[
+  {
+    "id": "70fd1550-23e4-42fb-9578-67063a4e70f1",
+    "type": "human",
+    "content": "Please render the sales dashboard again using generate_a2ui. The catalog component is Metric, not MetricCard. Use the actual supported catalog, include total revenue, customers and conversion metrics plus both charts."
+  },
+  {
+    "id": "chatcmpl-EUS9QeDbdqfk86oIHRgEuDnKzNXKM",
+    "type": "ai",
+    "content": "",
+    "tool_calls": [
+      {
+        "name": "render_a2ui",
+        "args": {
+          "surfaceId": "sales-dashboard-v2",
+          "components": [
+            {
+              "id": "root",
+              "component": "Row",
+              "children": {
+                "componentId": "metric",
+                "path": "/metrics"
+              },
+              "gap": 16
+            },
+            {
+              "id": "metric",
+              "component": "Metric",
+              "title": {
+                "path": "title"
+              },
+              "value": {
+                "path": "value"
+              }
+            },
+            {
+              "id": "chartsRow",
+              "component": "Row",
+              "children": [
+                {
+                  "componentId": "pieChart",
+                  "path": "/pieData"
+                },
+                {
+                  "componentId": "barChart",
+                  "path": "/barData"
+                }
+              ],
+              "gap": 24
+            },
+            {
+              "id": "pieChart",
+              "component": "PieChart",
+              "title": "Revenue by Category",
+              "data": {
+                "path": "/pieData"
+              }
+            },
+            {
+              "id": "barChart",
+              "component": "BarChart",
+              "title": "Monthly Sales",
+              "data": {
+                "path": "/barData"
+              }
+            }
+          ],
+          "data": {
+            "metrics": [
+              {
+                "id": "totalRevenue",
+                "title": "Total Revenue",
+                "value": "$327,700"
+              },
+              {
+                "id": "customers",
+                "title": "New Customers",
+                "value": "5"
+              },
+              {
+                "id": "conversionRate",
+                "title": "Conversion Rate",
+                "value": "20.3%"
+              }
+            ],
+            "pieData": [
+              {
+                "label": "Enterprise Subscriptions",
+                "value": 94000
+              },
+              {
+                "label": "Pro Tier Upgrades",
+                "value": 66500
+              },
+              {
+                "label": "Consulting Services",
+                "value": 54000
+              },
+              {
+                "label": "Marketplace Sales",
+                "value": 42800
+              },
+              {
+                "label": "API Usage Overages",
+                "value": 34500
+              },
+              {
+                "label": "Partnership Revenue",
+                "value": 25700
+              },
+              {
+                "label": "Training & Workshops",
+                "value": 10200
+              }
+            ],
+            "barData": [
+              {
+                "label": "Jan 2026",
+                "value": 82800
+              },
+              {
+                "label": "Feb 2026",
+                "value": 109000
+              },
+              {
+                "label": "Mar 2026",
+                "value": 135900
+              }
+            ]
+          }
+        },
+        "id": "call_25dQx1aDND8JEi4wmPYlEQ6z",
+        "type": "tool_call"
+      }
+    ]
+  },
+  {
+    "id": "a0b64fc1-b518-468b-8abe-f22fb5c2446f",
+    "type": "human",
+    "content": "Native source provenance check: reply Cedar ready. Do not call any tools or modify todos."
+  }
+]
```

---

### Incident Patch 2: `3092a4be` (2026-10-05)
**Commit Message**: Merge pull request #2961 from ag-ui-protocol/fix/tool-call-start-existing-owner

fix(langgraph): name the owning assistant message as a non-streamed tool call's parent

**File**: `apps/dojo/e2e/tests/langgraphFastAPITests/deepagentsSubagentsPage.event-trace.ts` (modified, +1/-3)
```diff
@@ -1,7 +1,7 @@
 import { defineEventTrace } from "../../event-trace-test";
 
 // Generated by the event trace updater.
-// Reason: CopilotKit 1.76.0 is an AG-UI 1.0 client: RunAgentInput now carries protocolVersion "1.0"
+// Reason: a tool call replayed from OnToolEnd after a HITL resume names no parent; it named its own call id, which the result also used as its message id
 // Before accepting changes, verify whether the implementation regressed.
 const shared1 =
   '{"type": "approval", "summary": "The sky appears blue because of Rayleigh scattering.", "question": "The research assistant wants to finalize this answer. Approve?"}' as const;
@@ -227,7 +227,6 @@ const shared17 = {
   subagentRunId: "tools:id-6",
   toolCallId: "id-7",
   toolCallName: "request_human_approval",
-  parentMessageId: "id-7",
 } as const;
 const shared18 = {
   type: "TOOL_CALL_START",
@@ -293,7 +292,6 @@ const shared28 = {
   type: "TOOL_CALL_START",
   toolCallId: "id-4",
   toolCallName: "task",
-  parentMessageId: "id-4",
 } as const;
 const shared29 = {
   type: "TOOL_CALL_START",
```

**File**: `integrations/langgraph/python/ag_ui_langgraph/agent.py` (modified, +49/-6)
```diff
@@ -1616,6 +1616,7 @@ async def _handle_stream_events(self, input: RunAgentInput) -> AsyncGenerator[Pr
             "node_name": None,
             "has_function_streaming": False,
             "streamed_tool_call_ids": set(),
+            "tool_call_owners": {},
             "model_made_tool_call": False,
             "state_reliable": True,
             "active_subagents": {},
@@ -3554,6 +3555,7 @@ def _chunk_get(c: Any, key: str, default: Any = None) -> Any:
                 ),
                 streamed=False,
             )
+            self._record_tool_call_owners(output_message)
 
             if self.get_message_in_progress(self.active_run["id"]) and self.get_message_in_progress(self.active_run["id"]).get("tool_call_id"):
                 resolved = self._dispatch_event(
@@ -3689,9 +3691,7 @@ def _chunk_get(c: Any, key: str, default: Any = None) -> Any:
                                 type=EventType.TOOL_CALL_START,
                                 tool_call_id=public_call_id,
                                 tool_call_name=tool_msg.name or event.get("name", ""),
-                                parent_message_id=self._resolve_public_message_id(
-                                    str(tool_msg.id or tool_msg.tool_call_id)
-                                ),
+                                parent_message_id=self._tool_call_owner(tool_msg.tool_call_id),
                                 raw_event=event,
                             )
                         )
@@ -3752,9 +3752,7 @@ def _chunk_get(c: Any, key: str, default: Any = None) -> Any:
                         type=EventType.TOOL_CALL_START,
                         tool_call_id=public_call_id,
                         tool_call_name=tool_call_output.name or event.get("name", ""),
-                        parent_message_id=self._resolve_public_message_id(
-                            str(tool_call_output.id or tool_call_output.tool_call_id)
-                        ),
+                        parent_message_id=self._tool_call_owner(tool_call_output.tool_call_id),
                         raw_event=event,
                     )
                 )
@@ -4190,6 +4188,51 @@ def lane_raw_form(public_id: str) -> str:
     def _resolve_public_message_id(self, upstream_id: str, lane: Optional[str] = None) -> str:
         return self._resolve_public_id(upstream_id, "message", lane)
 
+    def _record_tool_call_owners(self, message: Any) -> None:
+        """Remember which assistant message made each of ``message``'s tool calls.
+
+        Called at OnChatModelEnd, the one point every model call passes through
+        whether or not it streamed. OnToolEnd reads it back through
+        ``_tool_call_owner`` to name the parent of a call it has to announce
+        itself. The message id is resolved to its public form here, in the
+        model's lane, so it is the same id the streaming path would have named.
+
+        Should one call id come back from a later model call in the same run
+        (a retried model call, say), the later message wins: it is the most
+        recent model output to carry that call.
+        """
+        if isinstance(message, dict):
+            message_id = message.get("id")
+            tool_calls = message.get("tool_calls") or []
+        else:
+            message_id = getattr(message, "id", None)
+            tool_calls = getattr(message, "tool_calls", None) or []
+        if not message_id or not tool_calls:
+            return
+        public_message_id = self._resolve_public_message_id(str(message_id))
+        owners = self.active_run.setdefault("tool_call_owners", {}).setdefault(
+            self._current_lane(), {}
+        )
+        for call in tool_calls:
+            call_id = call.get("id") if isinstance(call, dict) else getattr(call, "id", None)
+            if call_id:
+                owners[call_id] = public_message_id
+
+    def _tool_call_owner(self, tool_call_id: str) -> Optional[str]:
+        """The public id of the assistant message that made ``tool_call_id``.
+
+        ``None`` when this run never saw that message — a call streamed by the
+        run before an interrupt, say. No parent is the honest answer then: a
+        client finds a call it already holds, and otherwise hangs it on a new
+        message keyed by the call id. Any guessed id, including the tool
+        result's, is worse — the result message reuses it as its own id.
+        """
+        return (
+            self.active_run.get("tool_call_owners", {})
+            .get(self._current_lane(), {})
+            .get(tool_call_id)
+        )
+
     def _resolve_public_tool_call_id(self, upstream_id: str, lane: Optional[str] = None) -> str:
         return self._resolve_public_id(upstream_id, "tool_call", lane)
 
```

**File**: `integrations/langgraph/python/ag_ui_langgraph/types.py` (modified, +5/-0)
```diff
@@ -112,6 +112,11 @@ class CustomEventNames(str, Enum):
     # flag, and the outer tool's OnToolEnd would then re-emit its Args,
     # producing duplicate / concatenated payloads in persisted history.
     "streamed_tool_call_ids": NotRequired[Set[str]],
+    # The assistant message that made each tool call, recorded at
+    # OnChatModelEnd and keyed lane -> raw tool_call_id -> public message id.
+    # OnToolEnd names it as the parent when it announces a call that never
+    # streamed. Without it that announcement had no owner to name.
+    "tool_call_owners": NotRequired[Dict[str, Dict[str, str]]],
     "model_made_tool_call": NotRequired[bool],
     "state_reliable": NotRequired[bool],
     # Message / state data
```

**File**: `integrations/langgraph/python/tests/test_nested_tool_end_dedup.py` (modified, +2/-2)
```diff
@@ -152,10 +152,10 @@ def _tool_end(tool_name, tool_call_id, *, content="ok", input_args=None):
     )
 
 
-async def _run_stream(events):
+async def _run_stream(events, agent=None):
     from ag_ui.core import RunAgentInput
 
-    agent = _make_agent()
+    agent = agent or _make_agent()
     dispatched = []
 
     original_dispatch = agent._dispatch_event
```

**File**: `integrations/langgraph/python/tests/test_tool_call_parent_message_id.py` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+"""
+Which message a non-streamed tool call is attached to.
+
+A tool call that never streamed through ``OnChatModelStream`` — a model that
+does not stream, or a call the previous run streamed before an interrupt — is
+announced from ``OnToolEnd`` instead. That announcement used to name the tool
+*result's* id as the call's parent, and then reuse the same id for the result
+message itself. A client therefore received an assistant message and a tool
+message sharing one id: the call was hung on a stand-in that no snapshot would
+ever recognise, and any consumer that merges messages by id (CopilotKit does)
+let the tool message overwrite the assistant message that carried the call.
+
+The parent of a tool call is the assistant message whose ``tool_calls`` hold
+it. These tests pin that contract on the ``OnToolEnd`` path.
+"""
+
+import asyncio
+import unittest
+
+from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage
+
+from ag_ui.core import EventType
+from ag_ui_langgraph.agent import LangGraphAgent
+from tests.test_nested_tool_end_dedup import _event, _make_agent, _run_stream, _tool_end
+
+
+def _model_end(output):
+    return _event("on_chat_model_end", node="model", data={"output": output})
+
+
+def _ai_message_with_call(*, message_id, tool_call_id, name="search"):
+    return AIMessage(
+        content="",
+        id=message_id,
+        tool_calls=[{"id": tool_call_id, "name": name, "args": {"query": "x"}}],
+    )
+
+
+def _first(dispatched, event_type, tool_call_id):
+    return next(
+        ev
+        for ev in dispatched
+        if ev.type == event_type and getattr(ev, "tool_call_id", None) == tool_call_id
+    )
+
+
+class TestNonStreamedToolCallParent(unittest.TestCase):
+    def test_parent_is_the_assistant_message_that_made_the_call(self):
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    # A model that did not stream: its message arrives whole.
+                    _model_end(_ai_message_with_call(message_id="ai-1", tool_call_id="tc-1")),
+                    _tool_end("search", "tc-1", content="found"),
+                ]
+            )
+        )
+
+        start = _first(dispatched, EventType.TOOL_CALL_START, "tc-1")
+        self.assertEqual(start.parent_message_id, "ai-1")
+
+    def test_result_id_never_doubles_as_the_parent(self):
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    _model_end(_ai_message_with_call(message_id="ai-1", tool_call_id="tc-1")),
+                    _tool_end("search", "tc-1", content="found"),
+                ]
+            )
+        )
+
+        start = _first(dispatched, EventType.TOOL_CALL_START, "tc-1")
+        result = _first(dispatched, EventType.TOOL_CALL_RESULT, "tc-1")
+        self.assertNotEqual(start.parent_message_id, result.message_id)
+
+    def test_each_parallel_call_keeps_its_own_owner(self):
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    _model_end(_ai_message_with_call(message_id="ai-1", tool_call_id="tc-1")),
+                    _model_end(_ai_message_with_call(message_id="ai-2", tool_call_id="tc-2")),
+                    _tool_end("search", "tc-2", content="second"),
+                    _tool_end("search", "tc-1", content="first"),
+                ]
+            )
+        )
+
+        self.assertEqual(_first(dispatched, EventType.TOOL_CALL_START, "tc-1").parent_message_id, "ai-1")
+        self.assertEqual(_first(dispatched, EventType.TOOL_CALL_START, "tc-2").parent_message_id, "ai-2")
+
+    def test_owner_unknown_sends_no_parent_rather_than_a_wrong_one(self):
+        # The call streamed in the run before an interrupt, so this run never
+        # saw the model message that made it. Naming no parent lets the client
+        # find the call where it already is; naming the result id did not.
+        dispatched = asyncio.run(_run_stream([_tool_end("search", "tc-1", content="found")]))
+
+        start = _first(dispatched, EventType.TOOL_CALL_START, "tc-1")
+        self.assertIsNone(start.parent_message_id)
+
+    def test_last_model_message_to_carry_a_call_owns_it(self):
+        # One call id from two model calls in a run (a retried model call):
+        # the later message is the owner.
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    _model_end(_ai_message_with_call(message_id="ai-1", tool_call_id="tc-1")),
+                    _model_end(_ai_message_with_call(message_id="ai-2", tool_call_id="tc-1")),
+                    _tool_end("search", "tc-1", content="found"),
+                ]
+            )
+        )
+
+        start = _first(dispatched, EventType.TOOL_CALL_START, "tc-1")
+        self.assertEqual(start.parent_message_id, "ai-2")
+
+    def test_streamed_calls_keep_the_chunk_id_as_parent(self):
+        # Regression guard: the streaming path already names the right pa
```

**File**: `integrations/langgraph/typescript/src/agent.ts` (modified, +41/-2)
```diff
@@ -210,6 +210,10 @@ export class LangGraphAgent extends AbstractAgent {
   assistant?: Assistant;
   messagesInProcess: MessagesInProgressRecord;
   emittedToolCallStartIds: Set<string> = new Set();
+  // The assistant message that made each tool call, recorded at OnChatModelEnd
+  // and keyed tool_call_id -> message id. OnToolEnd names it as the parent when
+  // it announces a call that never streamed. Reset per run, like the Set above.
+  toolCallOwners: Map<string, string> = new Map();
   reasoningProcess: null | ReasoningInProgress;
   // Canonical reasoning id (e.g. OpenAI `rs_…`) stashed from a text-less id
   // carrier chunk, consumed when the first text delta opens the reasoning
@@ -936,6 +940,7 @@ export class LangGraphAgent extends AbstractAgent {
     if (!stream) return;
     // Reset per-run tracking of emitted tool call IDs
     this.emittedToolCallStartIds = new Set<string>();
+    this.toolCallOwners = new Map<string, string>();
 
     let { streamResponse, state } = stream;
 
@@ -1456,6 +1461,35 @@ export class LangGraphAgent extends AbstractAgent {
     );
   }
 
+  /**
+   * Remember which assistant message made each of `output`'s tool calls.
+   *
+   * OnChatModelEnd is the one point every model call passes through, whether or
+   * not it streamed. OnToolEnd reads the owner back to name the parent of a
+   * call it has to announce itself; before this it named the tool result's id,
+   * which a ToolMessage usually lacks, so clients hung the call on a stand-in
+   * message no snapshot recognises. The output arrives either as a plain
+   * message dict or LangChain-serialized (`{ lc, kwargs }`). A call id seen
+   * twice in a run belongs to the later message.
+   */
+  private recordToolCallOwners(output: any): void {
+    const message = output?.lc && output?.kwargs ? output.kwargs : output;
+    const messageId = message?.id;
+    const toolCalls = message?.tool_calls;
+    if (
+      typeof messageId !== "string" ||
+      !messageId ||
+      !Array.isArray(toolCalls)
+    ) {
+      return;
+    }
+    for (const toolCall of toolCalls) {
+      if (toolCall?.id) {
+        this.toolCallOwners.set(toolCall.id, messageId);
+      }
+    }
+  }
+
   handleSingleEvent(event: any): void {
     // messages-tuple data arrives as [AIMessageChunk, metadata] arrays,
     // not objects with an .event property like events-mode data.
@@ -1685,6 +1719,7 @@ export class LangGraphAgent extends AbstractAgent {
 
         break;
       case LangGraphEventTypes.OnChatModelEnd:
+        this.recordToolCallOwners(event.data?.output);
         if (this.getMessageInProgress(this.activeRun!.id)?.toolCallId) {
           const resolved = this.dispatchEvent({
             type: EventType.TOOL_CALL_END,
@@ -1804,7 +1839,9 @@ export class LangGraphAgent extends AbstractAgent {
                   type: EventType.TOOL_CALL_START,
                   toolCallId: message.tool_call_id,
                   toolCallName: message.name ?? "",
-                  parentMessageId: message.id,
+                  parentMessageId: this.toolCallOwners.get(
+                    message.tool_call_id,
+                  ),
                   rawEvent: event,
                 });
                 this.dispatchEvent({
@@ -1847,7 +1884,9 @@ export class LangGraphAgent extends AbstractAgent {
             type: EventType.TOOL_CALL_START,
             toolCallId: toolCallOutput.tool_call_id,
             toolCallName: toolCallOutput.name,
-            parentMessageId: toolCallOutput.id,
+            parentMessageId: this.toolCallOwners.get(
+              toolCallOutput.tool_call_id,
+            ),
             rawEvent: event,
           });
           this.dispatchEvent({
```

**File**: `integrations/langgraph/typescript/src/tool-call-parent-message-id.test.ts` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+/**
+ * Which message a non-streamed tool call is attached to.
+ *
+ * A tool call that never streamed through `OnChatModelStream` is announced
+ * from `OnToolEnd` instead. That announcement used to name the tool *result's*
+ * id as the call's parent. A ToolMessage usually has no id at that point, so
+ * clients hung the call on a stand-in message keyed by the call id, which no
+ * MESSAGES_SNAPSHOT would ever recognise.
+ *
+ * The parent of a tool call is the assistant message whose `tool_calls` hold
+ * it. These tests pin that contract on the `OnToolEnd` path. Mirrors the
+ * Python integration's test_tool_call_parent_message_id.py.
+ */
+
+import { describe, it, expect } from "vitest";
+import { EventType } from "@ag-ui/core";
+import { LangGraphAgent } from "./agent";
+
+function createAgent() {
+  const agent = new LangGraphAgent({
+    deploymentUrl: "http://localhost:2024",
+    graphId: "test-graph",
+  });
+  const dispatched: any[] = [];
+  agent.dispatchEvent = (event: any) => {
+    dispatched.push(event);
+    return event as any;
+  };
+  (agent as any).activeRun = {
+    id: "run-1",
+    threadId: "thread-1",
+    hasFunctionStreaming: false,
+    modelMadeToolCall: false,
+  };
+  agent.messages = [];
+  return { agent, dispatched };
+}
+
+function aiMessageWithCall(
+  messageId: string,
+  toolCallId: string,
+  name = "search",
+) {
+  return {
+    type: "ai",
+    id: messageId,
+    content: "",
+    tool_calls: [{ id: toolCallId, name, args: { query: "x" } }],
+  };
+}
+
+function modelEnd(output: any) {
+  return {
+    event: "on_chat_model_end",
+    metadata: { langgraph_node: "model" },
+    data: { output },
+  };
+}
+
+function toolEnd(toolCallId: string, name = "search") {
+  return {
+    event: "on_tool_end",
+    metadata: { langgraph_node: "tools" },
+    data: {
+      input: { query: "x" },
+      output: { tool_call_id: toolCallId, name, content: "found" },
+    },
+  };
+}
+
+function commandToolEnd(toolCallId: string, name = "search") {
+  return {
+    event: "on_tool_end",
+    metadata: { langgraph_node: "tools" },
+    data: {
+      input: { query: "x" },
+      output: {
+        update: {
+          messages: [
+            {
+              type: "tool",
+              tool_call_id: toolCallId,
+              name,
+              content: "found",
+              id: "tm-1",
+            },
+          ],
+        },
+      },
+    },
+  };
+}
+
+const startFor = (dispatched: any[], toolCallId: string) =>
+  dispatched.filter(
+    (e) => e.type === EventType.TOOL_CALL_START && e.toolCallId === toolCallId,
+  );
+
+describe("OnToolEnd names the assistant message that made a non-streamed call", () => {
+  it("names the owning message as parent", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+  });
+
+  it("reads the owner from a LangChain-serialized model output", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(
+      modelEnd({
+        lc: 1,
+        type: "constructor",
+        id: ["langchain_core", "messages", "AIMessage"],
+        kwargs: aiMessageWithCall("ai-1", "tc-1"),
+      }),
+    );
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+  });
+
+  it("names the owning message on the Command path, not the tool message", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(commandToolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+  });
+
+  it("keeps each parallel call with its own owner", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-2", "tc-2")));
+    agent.handleSingleEvent(toolEnd("tc-2"));
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+    expect(startFor(dispatched, "tc-2")[0].parentMessageId).toBe("ai-2");
+  });
+
+  it("gives a call id seen twice in a run to the later message", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-2", "tc-1")));
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-2");
+  });
+
+  it("sends no parent when this run never saw the owner", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0
```

---

### Incident Patch 3: `f2612b72` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/tool-call-start-existing-owner

**File**: `integrations/antigravity/python/CHANGELOG.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Changelog
+
+## 0.2.0 — 2026-10-05
+
+- Added `max_tool_calls_per_turn` to bound the number of tool calls (custom, frontend, and built-in) within a single turn, enforced via a pre-tool-call decide hook.
+- Prevents turns from running tool cycles indefinitely after a client disconnects.
+- Off by default; existing behavior is unchanged unless the limit is set.
+
+### Breaking changes
+
+None.
```

**File**: `integrations/antigravity/python/README.md` (modified, +23/-0)
```diff
@@ -257,6 +257,29 @@ a plain statement of what already ran, so the model reports the result instead
 of retrying. Set `deduplicate_tool_calls=False` if a tool is genuinely meant to
 run repeatedly within one turn.
 
+### Bounding runaway turns
+
+A turn keeps running in the harness after its client disconnects, so the client
+can come back to it. Nothing stops a model (or a mock) that calls tools forever.
+`max_tool_calls_per_turn` puts a bound on it:
+
+```python
+agent = AntigravityAgent(tools=[...], max_tool_calls_per_turn=50)
+```
+
+The adapter counts tool calls — custom, frontend and built-in — in a
+pre-tool-call hook, which the harness calls whether or not a client is
+reading. The call past the limit is denied and the turn is halted:
+
+* A run reading the turn ends with `RUN_ERROR`, code `MAX_TOOL_CALLS_EXCEEDED`.
+* The harness closes a halted conversation, so the next run on the thread
+  rebuilds the session via cold resume. The history is kept, including the
+  calls that ran.
+* A disconnect alone never halts a turn; only the budget does.
+
+The count starts over when the harness begins a new turn. It is off (`None`)
+by default.
+
 ### Server-side tools
 
 Pass your own Python callables as `tools=[...]` and they run in this process,
```

**File**: `integrations/antigravity/python/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "ag_ui_antigravity"
 description = "Google Antigravity integration for the AG-UI Protocol"
-version = "0.1.0"
+version = "0.2.0"
 license-files = ["LICENSE"]
 readme = "README.md"
 requires-python = ">=3.10, <3.15"
```

**File**: `integrations/antigravity/python/src/ag_ui_antigravity/agent.py` (modified, +125/-19)
```diff
@@ -173,6 +173,7 @@ def __init__(
         deduplicate_tool_calls: bool = True,
         experimental_app_context: bool = False,
         experimental_app_state: bool = False,
+        max_tool_calls_per_turn: Optional[int] = None,
         # Session policy
         session_timeout_seconds: int = 1800,
         parked_timeout_seconds: int = 7200,
@@ -229,6 +230,16 @@ def __init__(
             backgrounds slow custom tools and the model then re-issues them,
             which would run a side-effecting action twice. Turn off if a tool is
             genuinely meant to run more than once within one turn.
+          max_tool_calls_per_turn: Upper bound on the tool calls one
+            Antigravity turn may make -- custom, frontend and built-in tools
+            alike. The call past the limit is denied and the turn is halted;
+            a run reading the turn ends with RUN_ERROR, code
+            ``MAX_TOOL_CALLS_EXCEEDED``, and the next run on the thread starts
+            from a rebuilt session that keeps the history. Enforced in a
+            pre-tool-call hook, so it holds while no client is connected: a
+            turn keeps running after a disconnect, for a later resume, and
+            this is what bounds one that never stops calling tools. Off
+            (``None``) by default.
         """
         if endpoint is not None and base_url is not None:
             raise ValueError(
@@ -260,6 +271,16 @@ def __init__(
                 f"{structured_output_as!r}"
             )
         self._structured_output_as = structured_output_as
+        if max_tool_calls_per_turn is not None and (
+            isinstance(max_tool_calls_per_turn, bool)
+            or not isinstance(max_tool_calls_per_turn, int)
+            or max_tool_calls_per_turn < 1
+        ):
+            raise ValueError(
+                "max_tool_calls_per_turn must be a positive integer or None, "
+                f"got {max_tool_calls_per_turn!r}"
+            )
+        self._max_tool_calls_per_turn = max_tool_calls_per_turn
         self._emit_builtin_tool_calls = emit_builtin_tool_calls
         self._deduplicate_tool_calls = deduplicate_tool_calls
 
@@ -365,6 +386,13 @@ def _build_agent(
         )
 
         hooks: List[Any] = []
+        if self._max_tool_calls_per_turn is not None:
+            # First: the first denial wins, so an over-budget call is refused
+            # without the approval hook prompting the user for it.
+            hooks.append(
+                bridge.build_tool_budget_hook(self._max_tool_calls_per_turn)
+            )
+            hooks.append(bridge.build_turn_start_hook())
         if self._enable_ask_question:
             hooks.append(bridge.build_interaction_hook())
         if self._tool_approval:
@@ -469,24 +497,41 @@ async def run(
         try:
             self._sessions.start()
             signature = tool_signature(list(input_data.tools or []))
-            session = await self._sessions.get_or_create(
-                thread_id,
-                signature=signature,
-                factory=lambda bridge, prev: self._build_agent(
-                    bridge, input_data, prev
-                ),
-                bridge_factory=lambda: UIBridge(
-                    deduplicate_tool_calls=self._deduplicate_tool_calls
-                ),
-            )
+            # A run queued on the lock behind one that halted or lost the
+            # session would otherwise reuse the dead conversation; fetching the
+            # session again after acquiring the lock gets the rebuilt one.
+            for _ in range(3):
+                session = await self._sessions.get_or_create(
+                    thread_id,
+                    signature=signature,
+                    factory=lambda bridge, prev: self._build_agent(
+                        bridge, input_data, prev
+                    ),
+                    bridge_factory=lambda: UIBridge(
+                        deduplicate_tool_calls=self._deduplicate_tool_calls
+                    ),
+                )
+                await session.lock.acquire()
+                if not (session.halted or session.harness_lost):
+                    break
+                session.lock.release()
+            else:
+                raise RuntimeError(
+                    f"No usable Antigravity session for thread {thread_id}."
+                )
 
-            async with session.lock:
+            try:
                 session.touch()
+                session.bridge.on_tool_budget_exhausted(
+                    lambda: _halt_for_tool_budget(session, thread_id)
+                )
                 async for event in self._run_locked(session, input_data):
                     if event.type in ("RUN_FINISHED", "RUN_ERROR"):
                         terminal_sent = True
                     yield event
                 session.touch()
+            finally:
+                session.lock.release()
 
         except SessionLimitExceeded as exc:
         
```

**File**: `integrations/antigravity/python/src/ag_ui_antigravity/session_manager.py` (modified, +22/-0)
```diff
@@ -82,6 +82,11 @@ class AntigravitySession:
     # holding `lock` and making the session unsweepable too. The next run
     # rebuilds it via cold resume instead.
     harness_lost: bool = False
+    # Set when the adapter halted the turn itself (max_tool_calls_per_turn). The
+    # harness closes a halted conversation's connection, so the session is
+    # rebuilt like a lost one -- but its process is alive and the history
+    # survives the cold resume (measured), unlike after a crash.
+    halted: bool = False
     # Serializes runs on the same thread; AG-UI clients can retry or
     # double-submit, and the SDK rejects concurrent receive_steps().
     lock: asyncio.Lock = field(default_factory=asyncio.Lock)
@@ -331,6 +336,23 @@ async def get_or_create(
                     "lost.",
                     thread_id,
                 )
+            elif existing is not None and existing.halted and existing.lock.locked():
+                # The run that hit the budget still holds the session and has
+                # yet to report MAX_TOOL_CALLS_EXCEEDED; tearing it down now
+                # would clear that. The halt ends its stream, so it finishes
+                # soon: hand the session back, and the caller -- which re-checks
+                # after taking the lock -- asks again and gets the rebuild.
+                existing.touch()
+                return existing
+            elif existing is not None and existing.halted:
+                # The process is alive, so the trajectory is intact and the cold
+                # resume picks it up.
+                logger.info(
+                    "Rebuilding the session for thread %s after its last turn "
+                    "hit max_tool_calls_per_turn; history is kept.",
+                    thread_id,
+                )
+            if existing is not None and (existing.harness_lost or existing.halted):
                 recycled, carried = await self._close_locked(
                     thread_id, keep_conversation_id=True, force=True
                 )
```

**File**: `integrations/antigravity/python/src/ag_ui_antigravity/ui_bridge.py` (modified, +67/-2)
```diff
@@ -48,7 +48,7 @@
 import uuid
 from contextvars import ContextVar
 from dataclasses import dataclass, field
-from typing import Any, Callable, Dict, List, Optional, Sequence
+from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence
 
 from ag_ui.core import (
     BaseEvent,
@@ -241,16 +241,81 @@ def __init__(self, *, deduplicate_tool_calls: bool = True) -> None:
         # The context the current run arrived with. Unlike state it is not
         # shared back: the client sends it afresh with every run.
         self._context: List[Dict[str, str]] = []
+        # max_tool_calls_per_turn bookkeeping, counted in the pre-tool-call
+        # hook so it holds whether or not any run is reading the turn.
+        self._tool_calls_this_turn = 0
+        self.tool_budget_exhausted = False
+        self._on_tool_budget_exhausted: Optional[
+            Callable[[], Awaitable[None]]
+        ] = None
+        self._background: set = set()
 
     def reset_turn(self) -> None:
         """Retires the per-turn frontend-tool claims.
 
         Safe to simply drop: each dispatcher holds its own claim future in a
         local and settles that object, so clearing the dict cannot strand a
-        waiter.
+        waiter. The tool-call count is NOT reset here: this runs when the
+        adapter retires its stream, which can be before the SDK has drained a
+        previous turn that is still calling tools (see build_turn_start_hook).
         """
         self._turn_results.clear()
 
+    def on_tool_budget_exhausted(self, halt: Callable[[], Awaitable[None]]) -> None:
+        """Sets what the budget hook calls once a turn runs out of tool calls."""
+        self._on_tool_budget_exhausted = halt
+
+    def build_turn_start_hook(self) -> ag_hooks.PreTurnHook:
+        """Builds the pre-turn hook that starts a fresh tool-call count.
+
+        The harness calls it when it actually begins a turn -- after
+        ``Conversation.send()`` has drained any previous turn -- so a turn's
+        calls are charged to that turn and no other.
+        """
+        bridge = self
+
+        @ag_hooks.pre_turn
+        async def _start(prompt: Any) -> ag_types.HookResult:
+            bridge._tool_calls_this_turn = 0
+            bridge.tool_budget_exhausted = False
+            return ag_types.HookResult(allow=True)
+
+        return _start
+
+    def build_tool_budget_hook(self, limit: int) -> ag_hooks.PreToolCallDecideHook:
+        """Builds the decide-hook that enforces max_tool_calls_per_turn.
+
+        The SDK calls it before every tool call -- custom, frontend and
+        built-in -- from its own connection reader, so the budget holds while
+        no client is connected and the turn keeps running for a later resume.
+        Register it before any other decide hook: the first denial wins, so an
+        over-budget call is refused without asking the user to approve it.
+        """
+        bridge = self
+
+        @ag_hooks.pre_tool_call_decide
+        async def _decide(call: ag_types.ToolCall) -> ag_types.HookResult:
+            bridge._tool_calls_this_turn += 1
+            if bridge._tool_calls_this_turn <= limit:
+                return ag_types.HookResult(allow=True)
+            if not bridge.tool_budget_exhausted:
+                bridge.tool_budget_exhausted = True
+                if bridge._on_tool_budget_exhausted is not None:
+                    # Not awaited here: the harness is waiting on this hook's
+                    # answer, and the halt is a separate message to it.
+                    task = asyncio.ensure_future(bridge._on_tool_budget_exhausted())
+                    bridge._background.add(task)
+                    task.add_done_callback(bridge._background.discard)
+            return ag_types.HookResult(
+                allow=False,
+                message=(
+                    f"Tool call limit reached ({limit} per turn); the turn is "
+                    "being stopped."
+                ),
+            )
+
+        return _decide
+
     # ------------------------------------------------------------------
     # Queue plumbing
     # ------------------------------------------------------------------
```

**File**: `integrations/antigravity/python/tests/test_agent_config.py` (modified, +17/-0)
```diff
@@ -316,3 +316,20 @@ async def test_close_stops_the_session_manager(self):
         agent._sessions.start()
         await agent.close()
         assert agent._sessions._cleanup_task is None
+
+
+class TestToolBudgetHookRegistration:
+    async def test_no_budget_hook_by_default(self):
+        config, _ = build(AntigravityAgent())
+        assert len(config.hooks or []) == 1  # just the ask-question hook
+
+    async def test_budget_hook_is_registered_before_approval(self):
+        # The first denial wins: the budget must refuse an over-limit call
+        # before the approval hook asks the user about it.
+        agent = AntigravityAgent(max_tool_calls_per_turn=3, tool_approval=True)
+        config, bridge = build(agent)
+        budget = config.hooks[0]
+        for _ in range(3):
+            assert (await budget.run(None, ag_types.ToolCall(name="x", args={}))).allow
+        assert not (await budget.run(None, ag_types.ToolCall(name="x", args={}))).allow
+        assert bridge.tool_budget_exhausted
```

**File**: `integrations/antigravity/python/tests/test_agent_run_loop.py` (modified, +220/-0)
```diff
@@ -34,10 +34,14 @@ def __init__(self, scripts, on_send=None):
         self._scripts = list(scripts)
         self._on_send = on_send
         self.sent = []
+        self.cancel_calls = 0
         # Released to let a BLOCKed stream carry on delivering its script,
         # which is how a turn that parked eventually finishes.
         self.gate = asyncio.Event()
 
+    async def cancel(self):
+        self.cancel_calls += 1
+
     async def send(self, prompt):
         self.sent.append(prompt)
         if self._on_send:
@@ -2033,3 +2037,219 @@ async def test_a_string_result_passes_through_unchanged(self):
             )
         )
         assert await asyncio.wait_for(parked, 1) == "  spaced  "
+
+
+
+def _tool_call(name="get_weather"):
+    return ag_types.ToolCall(name=name, args={"location": "Tokyo"})
+
+
+def _numbered_steps(count):
+    for index in range(1, count + 1):
+        yield text_step(f"step {index} ", index=index, done=True)
+
+
+class TestToolBudgetHook:
+    """The hook itself: the SDK awaits it before every tool call."""
+
+    async def test_allows_up_to_the_limit_then_denies(self):
+        bridge = UIBridge()
+        halts = []
+
+        async def halt():
+            halts.append(True)
+
+        bridge.on_tool_budget_exhausted(halt)
+        hook = bridge.build_tool_budget_hook(3)
+
+        results = [(await hook.run(None, _tool_call())).allow for _ in range(5)]
+        await asyncio.sleep(0)
+
+        assert results == [True, True, True, False, False]
+        assert bridge.tool_budget_exhausted is True
+        # Halted once, not once per denied call.
+        assert halts == [True]
+
+    async def test_the_count_starts_over_when_the_harness_starts_a_turn(self):
+        bridge = UIBridge()
+        hook = bridge.build_tool_budget_hook(2)
+        turn_start = bridge.build_turn_start_hook()
+        for _ in range(2):
+            assert (await hook.run(None, _tool_call())).allow
+
+        assert (await turn_start.run(None, "next prompt")).allow
+
+        assert (await hook.run(None, _tool_call())).allow
+        assert bridge.tool_budget_exhausted is False
+
+    async def test_retiring_the_stream_does_not_reset_the_count(self):
+        # A new prompt retires the stream before Conversation.send() drains
+        # the still-running previous turn. That turn's remaining calls must
+        # stay on its own budget, not get a fresh one.
+        bridge = UIBridge()
+        hook = bridge.build_tool_budget_hook(1)
+        assert (await hook.run(None, _tool_call())).allow
+
+        bridge.reset_turn()
+
+        assert not (await hook.run(None, _tool_call())).allow
+
+    async def test_denial_tells_the_model_why(self):
+        bridge = UIBridge()
+        hook = bridge.build_tool_budget_hook(1)
+        await hook.run(None, _tool_call())
+
+        result = await hook.run(None, _tool_call())
+
+        assert result.allow is False
+        assert "Tool call limit reached" in result.message
+
+
+class TestMaxToolCallsPerTurn:
+    @pytest.mark.parametrize("bad", [0, -1, True, 2.5, "5"])
+    def test_rejects_invalid_limits(self, bad):
+        with pytest.raises(ValueError, match="max_tool_calls_per_turn"):
+            AntigravityAgent(max_tool_calls_per_turn=bad)
+
+    async def test_a_halt_from_the_budget_reports_its_own_error_code(self):
+        # The hook halts the turn; the harness then ends the stream as
+        # cancelled. A reading run reports why, not a generic CANCELLED.
+        agent = AntigravityAgent(max_tool_calls_per_turn=2)
+        bridge = UIBridge()
+        session = make_session(None, bridge=bridge)
+
+        def script():
+            yield text_step("working ", index=1, done=True)
+            bridge.tool_budget_exhausted = True
+            yield ag_types.AntigravityCancelledError("halted")
+
+        session.agent.conversation = FakeConversation([script()])
+
+        events = await drain(agent._run_locked(session, run_input()))
+
+        assert events[-1].type == "RUN_ERROR"
+        assert events[-1].code == "MAX_TOOL_CALLS_EXCEEDED"
+        assert "2 tool calls" in events[-1].message
+
+    async def test_an_ordinary_cancellation_is_still_cancelled(self):
+        agent = AntigravityAgent(max_tool_calls_per_turn=2)
+        session = make_session(
+            FakeConversation([[ag_types.AntigravityCancelledError("closed")]])
+        )
+
+        events = await drain(agent._run_locked(session, run_input()))
+
+        assert events[-1].code == "CANCELLED"
+
+    async def test_the_halt_marks_the_session_for_a_rebuild_and_cancels(self):
+        from ag_ui_antigravity.agent import _halt_for_tool_budget
+
+        conversation = FakeConversation([])
+        session = make_session(conversation)
+
+        await _halt_for_tool_budget(session, "t1")
+
+        assert session.halted is True
+        assert conversation.cancel_calls == 1
+
+    async def test_a_failing_cancel_still_marks_the_session(self):
+        from ag_ui_antigravity.a
```

---

### Incident Patch 4: `cff38661` (2026-10-05)
**Commit Message**: test(dojo): drop the stale tool-call parents from the deepagents trace

On the HITL resume run, OnToolEnd replays TOOL_CALL_START for
request_human_approval and the outer `task` call. The baseline pinned their
parentMessageId as the call's own id, which the TOOL_CALL_RESULT also used
as its messageId: the collision this PR fixes. The owners were made in the
previous run, so the replayed starts now name no parent.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/dojo/e2e/tests/langgraphFastAPITests/deepagentsSubagentsPage.event-trace.ts` (modified, +1/-3)
```diff
@@ -1,7 +1,7 @@
 import { defineEventTrace } from "../../event-trace-test";
 
 // Generated by the event trace updater.
-// Reason: CopilotKit 1.76.0 is an AG-UI 1.0 client: RunAgentInput now carries protocolVersion "1.0"
+// Reason: a tool call replayed from OnToolEnd after a HITL resume names no parent; it named its own call id, which the result also used as its message id
 // Before accepting changes, verify whether the implementation regressed.
 const shared1 =
   '{"type": "approval", "summary": "The sky appears blue because of Rayleigh scattering.", "question": "The research assistant wants to finalize this answer. Approve?"}' as const;
@@ -227,7 +227,6 @@ const shared17 = {
   subagentRunId: "tools:id-6",
   toolCallId: "id-7",
   toolCallName: "request_human_approval",
-  parentMessageId: "id-7",
 } as const;
 const shared18 = {
   type: "TOOL_CALL_START",
@@ -293,7 +292,6 @@ const shared28 = {
   type: "TOOL_CALL_START",
   toolCallId: "id-4",
   toolCallName: "task",
-  parentMessageId: "id-4",
 } as const;
 const shared29 = {
   type: "TOOL_CALL_START",
```

---

### Incident Patch 5: `42e4f6e8` (2026-10-05)
**Commit Message**: Merge pull request #2962 from ag-ui-protocol/release/next

release: integration-antigravity-py

**File**: `integrations/antigravity/python/CHANGELOG.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Changelog
+
+## 0.2.0 — 2026-10-05
+
+- Added `max_tool_calls_per_turn` to bound the number of tool calls (custom, frontend, and built-in) within a single turn, enforced via a pre-tool-call decide hook.
+- Prevents turns from running tool cycles indefinitely after a client disconnects.
+- Off by default; existing behavior is unchanged unless the limit is set.
+
+### Breaking changes
+
+None.
```

**File**: `integrations/antigravity/python/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "ag_ui_antigravity"
 description = "Google Antigravity integration for the AG-UI Protocol"
-version = "0.1.0"
+version = "0.2.0"
 license-files = ["LICENSE"]
 readme = "README.md"
 requires-python = ">=3.10, <3.15"
```

**File**: `integrations/antigravity/python/uv.lock` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ wheels = [
 
 [[package]]
 name = "ag-ui-antigravity"
-version = "0.1.0"
+version = "0.2.0"
 source = { editable = "." }
 dependencies = [
     { name = "ag-ui-protocol" },
```

---

### Incident Patch 6: `0d40bd5b` (2026-10-05)
**Commit Message**: chore(release): bump integration-antigravity-py (ag_ui_antigravity@0.2.0)

**File**: `integrations/antigravity/python/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "ag_ui_antigravity"
 description = "Google Antigravity integration for the AG-UI Protocol"
-version = "0.1.0"
+version = "0.2.0"
 license-files = ["LICENSE"]
 readme = "README.md"
 requires-python = ">=3.10, <3.15"
```

**File**: `integrations/antigravity/python/uv.lock` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ wheels = [
 
 [[package]]
 name = "ag-ui-antigravity"
-version = "0.1.0"
+version = "0.2.0"
 source = { editable = "." }
 dependencies = [
     { name = "ag-ui-protocol" },
```

---

### Incident Patch 7: `fe85082f` (2026-10-05)
**Commit Message**: Merge pull request #2960 from ag-ui-protocol/mme/antigravity-max-steps

feat(antigravity): bound runaway turns with max_tool_calls_per_turn

**File**: `integrations/antigravity/python/README.md` (modified, +23/-0)
```diff
@@ -257,6 +257,29 @@ a plain statement of what already ran, so the model reports the result instead
 of retrying. Set `deduplicate_tool_calls=False` if a tool is genuinely meant to
 run repeatedly within one turn.
 
+### Bounding runaway turns
+
+A turn keeps running in the harness after its client disconnects, so the client
+can come back to it. Nothing stops a model (or a mock) that calls tools forever.
+`max_tool_calls_per_turn` puts a bound on it:
+
+```python
+agent = AntigravityAgent(tools=[...], max_tool_calls_per_turn=50)
+```
+
+The adapter counts tool calls — custom, frontend and built-in — in a
+pre-tool-call hook, which the harness calls whether or not a client is
+reading. The call past the limit is denied and the turn is halted:
+
+* A run reading the turn ends with `RUN_ERROR`, code `MAX_TOOL_CALLS_EXCEEDED`.
+* The harness closes a halted conversation, so the next run on the thread
+  rebuilds the session via cold resume. The history is kept, including the
+  calls that ran.
+* A disconnect alone never halts a turn; only the budget does.
+
+The count starts over when the harness begins a new turn. It is off (`None`)
+by default.
+
 ### Server-side tools
 
 Pass your own Python callables as `tools=[...]` and they run in this process,
```

**File**: `integrations/antigravity/python/src/ag_ui_antigravity/agent.py` (modified, +125/-19)
```diff
@@ -173,6 +173,7 @@ def __init__(
         deduplicate_tool_calls: bool = True,
         experimental_app_context: bool = False,
         experimental_app_state: bool = False,
+        max_tool_calls_per_turn: Optional[int] = None,
         # Session policy
         session_timeout_seconds: int = 1800,
         parked_timeout_seconds: int = 7200,
@@ -229,6 +230,16 @@ def __init__(
             backgrounds slow custom tools and the model then re-issues them,
             which would run a side-effecting action twice. Turn off if a tool is
             genuinely meant to run more than once within one turn.
+          max_tool_calls_per_turn: Upper bound on the tool calls one
+            Antigravity turn may make -- custom, frontend and built-in tools
+            alike. The call past the limit is denied and the turn is halted;
+            a run reading the turn ends with RUN_ERROR, code
+            ``MAX_TOOL_CALLS_EXCEEDED``, and the next run on the thread starts
+            from a rebuilt session that keeps the history. Enforced in a
+            pre-tool-call hook, so it holds while no client is connected: a
+            turn keeps running after a disconnect, for a later resume, and
+            this is what bounds one that never stops calling tools. Off
+            (``None``) by default.
         """
         if endpoint is not None and base_url is not None:
             raise ValueError(
@@ -260,6 +271,16 @@ def __init__(
                 f"{structured_output_as!r}"
             )
         self._structured_output_as = structured_output_as
+        if max_tool_calls_per_turn is not None and (
+            isinstance(max_tool_calls_per_turn, bool)
+            or not isinstance(max_tool_calls_per_turn, int)
+            or max_tool_calls_per_turn < 1
+        ):
+            raise ValueError(
+                "max_tool_calls_per_turn must be a positive integer or None, "
+                f"got {max_tool_calls_per_turn!r}"
+            )
+        self._max_tool_calls_per_turn = max_tool_calls_per_turn
         self._emit_builtin_tool_calls = emit_builtin_tool_calls
         self._deduplicate_tool_calls = deduplicate_tool_calls
 
@@ -365,6 +386,13 @@ def _build_agent(
         )
 
         hooks: List[Any] = []
+        if self._max_tool_calls_per_turn is not None:
+            # First: the first denial wins, so an over-budget call is refused
+            # without the approval hook prompting the user for it.
+            hooks.append(
+                bridge.build_tool_budget_hook(self._max_tool_calls_per_turn)
+            )
+            hooks.append(bridge.build_turn_start_hook())
         if self._enable_ask_question:
             hooks.append(bridge.build_interaction_hook())
         if self._tool_approval:
@@ -469,24 +497,41 @@ async def run(
         try:
             self._sessions.start()
             signature = tool_signature(list(input_data.tools or []))
-            session = await self._sessions.get_or_create(
-                thread_id,
-                signature=signature,
-                factory=lambda bridge, prev: self._build_agent(
-                    bridge, input_data, prev
-                ),
-                bridge_factory=lambda: UIBridge(
-                    deduplicate_tool_calls=self._deduplicate_tool_calls
-                ),
-            )
+            # A run queued on the lock behind one that halted or lost the
+            # session would otherwise reuse the dead conversation; fetching the
+            # session again after acquiring the lock gets the rebuilt one.
+            for _ in range(3):
+                session = await self._sessions.get_or_create(
+                    thread_id,
+                    signature=signature,
+                    factory=lambda bridge, prev: self._build_agent(
+                        bridge, input_data, prev
+                    ),
+                    bridge_factory=lambda: UIBridge(
+                        deduplicate_tool_calls=self._deduplicate_tool_calls
+                    ),
+                )
+                await session.lock.acquire()
+                if not (session.halted or session.harness_lost):
+                    break
+                session.lock.release()
+            else:
+                raise RuntimeError(
+                    f"No usable Antigravity session for thread {thread_id}."
+                )
 
-            async with session.lock:
+            try:
                 session.touch()
+                session.bridge.on_tool_budget_exhausted(
+                    lambda: _halt_for_tool_budget(session, thread_id)
+                )
                 async for event in self._run_locked(session, input_data):
                     if event.type in ("RUN_FINISHED", "RUN_ERROR"):
                         terminal_sent = True
                     yield event
                 session.touch()
+            finally:
+                session.lock.release()
 
         except SessionLimitExceeded as exc:
         
```

**File**: `integrations/antigravity/python/src/ag_ui_antigravity/session_manager.py` (modified, +22/-0)
```diff
@@ -82,6 +82,11 @@ class AntigravitySession:
     # holding `lock` and making the session unsweepable too. The next run
     # rebuilds it via cold resume instead.
     harness_lost: bool = False
+    # Set when the adapter halted the turn itself (max_tool_calls_per_turn). The
+    # harness closes a halted conversation's connection, so the session is
+    # rebuilt like a lost one -- but its process is alive and the history
+    # survives the cold resume (measured), unlike after a crash.
+    halted: bool = False
     # Serializes runs on the same thread; AG-UI clients can retry or
     # double-submit, and the SDK rejects concurrent receive_steps().
     lock: asyncio.Lock = field(default_factory=asyncio.Lock)
@@ -331,6 +336,23 @@ async def get_or_create(
                     "lost.",
                     thread_id,
                 )
+            elif existing is not None and existing.halted and existing.lock.locked():
+                # The run that hit the budget still holds the session and has
+                # yet to report MAX_TOOL_CALLS_EXCEEDED; tearing it down now
+                # would clear that. The halt ends its stream, so it finishes
+                # soon: hand the session back, and the caller -- which re-checks
+                # after taking the lock -- asks again and gets the rebuild.
+                existing.touch()
+                return existing
+            elif existing is not None and existing.halted:
+                # The process is alive, so the trajectory is intact and the cold
+                # resume picks it up.
+                logger.info(
+                    "Rebuilding the session for thread %s after its last turn "
+                    "hit max_tool_calls_per_turn; history is kept.",
+                    thread_id,
+                )
+            if existing is not None and (existing.harness_lost or existing.halted):
                 recycled, carried = await self._close_locked(
                     thread_id, keep_conversation_id=True, force=True
                 )
```

**File**: `integrations/antigravity/python/src/ag_ui_antigravity/ui_bridge.py` (modified, +67/-2)
```diff
@@ -48,7 +48,7 @@
 import uuid
 from contextvars import ContextVar
 from dataclasses import dataclass, field
-from typing import Any, Callable, Dict, List, Optional, Sequence
+from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence
 
 from ag_ui.core import (
     BaseEvent,
@@ -241,16 +241,81 @@ def __init__(self, *, deduplicate_tool_calls: bool = True) -> None:
         # The context the current run arrived with. Unlike state it is not
         # shared back: the client sends it afresh with every run.
         self._context: List[Dict[str, str]] = []
+        # max_tool_calls_per_turn bookkeeping, counted in the pre-tool-call
+        # hook so it holds whether or not any run is reading the turn.
+        self._tool_calls_this_turn = 0
+        self.tool_budget_exhausted = False
+        self._on_tool_budget_exhausted: Optional[
+            Callable[[], Awaitable[None]]
+        ] = None
+        self._background: set = set()
 
     def reset_turn(self) -> None:
         """Retires the per-turn frontend-tool claims.
 
         Safe to simply drop: each dispatcher holds its own claim future in a
         local and settles that object, so clearing the dict cannot strand a
-        waiter.
+        waiter. The tool-call count is NOT reset here: this runs when the
+        adapter retires its stream, which can be before the SDK has drained a
+        previous turn that is still calling tools (see build_turn_start_hook).
         """
         self._turn_results.clear()
 
+    def on_tool_budget_exhausted(self, halt: Callable[[], Awaitable[None]]) -> None:
+        """Sets what the budget hook calls once a turn runs out of tool calls."""
+        self._on_tool_budget_exhausted = halt
+
+    def build_turn_start_hook(self) -> ag_hooks.PreTurnHook:
+        """Builds the pre-turn hook that starts a fresh tool-call count.
+
+        The harness calls it when it actually begins a turn -- after
+        ``Conversation.send()`` has drained any previous turn -- so a turn's
+        calls are charged to that turn and no other.
+        """
+        bridge = self
+
+        @ag_hooks.pre_turn
+        async def _start(prompt: Any) -> ag_types.HookResult:
+            bridge._tool_calls_this_turn = 0
+            bridge.tool_budget_exhausted = False
+            return ag_types.HookResult(allow=True)
+
+        return _start
+
+    def build_tool_budget_hook(self, limit: int) -> ag_hooks.PreToolCallDecideHook:
+        """Builds the decide-hook that enforces max_tool_calls_per_turn.
+
+        The SDK calls it before every tool call -- custom, frontend and
+        built-in -- from its own connection reader, so the budget holds while
+        no client is connected and the turn keeps running for a later resume.
+        Register it before any other decide hook: the first denial wins, so an
+        over-budget call is refused without asking the user to approve it.
+        """
+        bridge = self
+
+        @ag_hooks.pre_tool_call_decide
+        async def _decide(call: ag_types.ToolCall) -> ag_types.HookResult:
+            bridge._tool_calls_this_turn += 1
+            if bridge._tool_calls_this_turn <= limit:
+                return ag_types.HookResult(allow=True)
+            if not bridge.tool_budget_exhausted:
+                bridge.tool_budget_exhausted = True
+                if bridge._on_tool_budget_exhausted is not None:
+                    # Not awaited here: the harness is waiting on this hook's
+                    # answer, and the halt is a separate message to it.
+                    task = asyncio.ensure_future(bridge._on_tool_budget_exhausted())
+                    bridge._background.add(task)
+                    task.add_done_callback(bridge._background.discard)
+            return ag_types.HookResult(
+                allow=False,
+                message=(
+                    f"Tool call limit reached ({limit} per turn); the turn is "
+                    "being stopped."
+                ),
+            )
+
+        return _decide
+
     # ------------------------------------------------------------------
     # Queue plumbing
     # ------------------------------------------------------------------
```

**File**: `integrations/antigravity/python/tests/test_agent_config.py` (modified, +17/-0)
```diff
@@ -316,3 +316,20 @@ async def test_close_stops_the_session_manager(self):
         agent._sessions.start()
         await agent.close()
         assert agent._sessions._cleanup_task is None
+
+
+class TestToolBudgetHookRegistration:
+    async def test_no_budget_hook_by_default(self):
+        config, _ = build(AntigravityAgent())
+        assert len(config.hooks or []) == 1  # just the ask-question hook
+
+    async def test_budget_hook_is_registered_before_approval(self):
+        # The first denial wins: the budget must refuse an over-limit call
+        # before the approval hook asks the user about it.
+        agent = AntigravityAgent(max_tool_calls_per_turn=3, tool_approval=True)
+        config, bridge = build(agent)
+        budget = config.hooks[0]
+        for _ in range(3):
+            assert (await budget.run(None, ag_types.ToolCall(name="x", args={}))).allow
+        assert not (await budget.run(None, ag_types.ToolCall(name="x", args={}))).allow
+        assert bridge.tool_budget_exhausted
```

**File**: `integrations/antigravity/python/tests/test_agent_run_loop.py` (modified, +220/-0)
```diff
@@ -34,10 +34,14 @@ def __init__(self, scripts, on_send=None):
         self._scripts = list(scripts)
         self._on_send = on_send
         self.sent = []
+        self.cancel_calls = 0
         # Released to let a BLOCKed stream carry on delivering its script,
         # which is how a turn that parked eventually finishes.
         self.gate = asyncio.Event()
 
+    async def cancel(self):
+        self.cancel_calls += 1
+
     async def send(self, prompt):
         self.sent.append(prompt)
         if self._on_send:
@@ -2033,3 +2037,219 @@ async def test_a_string_result_passes_through_unchanged(self):
             )
         )
         assert await asyncio.wait_for(parked, 1) == "  spaced  "
+
+
+
+def _tool_call(name="get_weather"):
+    return ag_types.ToolCall(name=name, args={"location": "Tokyo"})
+
+
+def _numbered_steps(count):
+    for index in range(1, count + 1):
+        yield text_step(f"step {index} ", index=index, done=True)
+
+
+class TestToolBudgetHook:
+    """The hook itself: the SDK awaits it before every tool call."""
+
+    async def test_allows_up_to_the_limit_then_denies(self):
+        bridge = UIBridge()
+        halts = []
+
+        async def halt():
+            halts.append(True)
+
+        bridge.on_tool_budget_exhausted(halt)
+        hook = bridge.build_tool_budget_hook(3)
+
+        results = [(await hook.run(None, _tool_call())).allow for _ in range(5)]
+        await asyncio.sleep(0)
+
+        assert results == [True, True, True, False, False]
+        assert bridge.tool_budget_exhausted is True
+        # Halted once, not once per denied call.
+        assert halts == [True]
+
+    async def test_the_count_starts_over_when_the_harness_starts_a_turn(self):
+        bridge = UIBridge()
+        hook = bridge.build_tool_budget_hook(2)
+        turn_start = bridge.build_turn_start_hook()
+        for _ in range(2):
+            assert (await hook.run(None, _tool_call())).allow
+
+        assert (await turn_start.run(None, "next prompt")).allow
+
+        assert (await hook.run(None, _tool_call())).allow
+        assert bridge.tool_budget_exhausted is False
+
+    async def test_retiring_the_stream_does_not_reset_the_count(self):
+        # A new prompt retires the stream before Conversation.send() drains
+        # the still-running previous turn. That turn's remaining calls must
+        # stay on its own budget, not get a fresh one.
+        bridge = UIBridge()
+        hook = bridge.build_tool_budget_hook(1)
+        assert (await hook.run(None, _tool_call())).allow
+
+        bridge.reset_turn()
+
+        assert not (await hook.run(None, _tool_call())).allow
+
+    async def test_denial_tells_the_model_why(self):
+        bridge = UIBridge()
+        hook = bridge.build_tool_budget_hook(1)
+        await hook.run(None, _tool_call())
+
+        result = await hook.run(None, _tool_call())
+
+        assert result.allow is False
+        assert "Tool call limit reached" in result.message
+
+
+class TestMaxToolCallsPerTurn:
+    @pytest.mark.parametrize("bad", [0, -1, True, 2.5, "5"])
+    def test_rejects_invalid_limits(self, bad):
+        with pytest.raises(ValueError, match="max_tool_calls_per_turn"):
+            AntigravityAgent(max_tool_calls_per_turn=bad)
+
+    async def test_a_halt_from_the_budget_reports_its_own_error_code(self):
+        # The hook halts the turn; the harness then ends the stream as
+        # cancelled. A reading run reports why, not a generic CANCELLED.
+        agent = AntigravityAgent(max_tool_calls_per_turn=2)
+        bridge = UIBridge()
+        session = make_session(None, bridge=bridge)
+
+        def script():
+            yield text_step("working ", index=1, done=True)
+            bridge.tool_budget_exhausted = True
+            yield ag_types.AntigravityCancelledError("halted")
+
+        session.agent.conversation = FakeConversation([script()])
+
+        events = await drain(agent._run_locked(session, run_input()))
+
+        assert events[-1].type == "RUN_ERROR"
+        assert events[-1].code == "MAX_TOOL_CALLS_EXCEEDED"
+        assert "2 tool calls" in events[-1].message
+
+    async def test_an_ordinary_cancellation_is_still_cancelled(self):
+        agent = AntigravityAgent(max_tool_calls_per_turn=2)
+        session = make_session(
+            FakeConversation([[ag_types.AntigravityCancelledError("closed")]])
+        )
+
+        events = await drain(agent._run_locked(session, run_input()))
+
+        assert events[-1].code == "CANCELLED"
+
+    async def test_the_halt_marks_the_session_for_a_rebuild_and_cancels(self):
+        from ag_ui_antigravity.agent import _halt_for_tool_budget
+
+        conversation = FakeConversation([])
+        session = make_session(conversation)
+
+        await _halt_for_tool_budget(session, "t1")
+
+        assert session.halted is True
+        assert conversation.cancel_calls == 1
+
+    async def test_a_failing_cancel_still_marks_the_session(self):
+        from ag_ui_antigravity.a
```

**File**: `integrations/antigravity/python/tests/test_session_manager.py` (modified, +55/-0)
```diff
@@ -600,3 +600,58 @@ async def test_an_unknown_thread_starts_fresh(self):
         )
         assert session.agent.resumed_from is None
         assert session.forwarded_prompts == set()
+
+
+class TestRebuildAfterHalt:
+    """A session halted by max_tool_calls_per_turn is rebuilt with its history."""
+
+    async def test_halted_session_is_rebuilt_from_the_same_conversation(self, caplog):
+        manager = SessionManager()
+        sig = tool_signature([])
+        first = await manager.get_or_create("t1", signature=sig, factory=factory)
+        first.halted = True
+
+        with caplog.at_level("INFO", logger="ag_ui_antigravity.session_manager"):
+            second = await manager.get_or_create("t1", signature=sig, factory=factory)
+
+        assert second is not first
+        assert second.agent.resumed_from == first.agent.conversation_id
+        assert second.halted is False
+        assert first.agent.exited
+        messages = [r.getMessage() for r in caplog.records]
+        assert any("max_tool_calls_per_turn; history is kept" in m for m in messages)
+        assert not any("likely lost" in m for m in messages)
+        await manager.stop()
+
+    async def test_lost_harness_still_warns_that_history_is_lost(self, caplog):
+        manager = SessionManager()
+        sig = tool_signature([])
+        first = await manager.get_or_create("t1", signature=sig, factory=factory)
+        first.harness_lost = True
+
+        with caplog.at_level("INFO", logger="ag_ui_antigravity.session_manager"):
+            await manager.get_or_create("t1", signature=sig, factory=factory)
+
+        assert any("likely lost" in r.getMessage() for r in caplog.records)
+        await manager.stop()
+
+
+    async def test_a_halted_session_still_held_by_a_run_is_not_torn_down(self):
+        # The run holding the lock has yet to report MAX_TOOL_CALLS_EXCEEDED;
+        # tearing the session down under it would clear the budget flag.
+        manager = SessionManager()
+        sig = tool_signature([])
+        first = await manager.get_or_create("t1", signature=sig, factory=factory)
+        first.halted = True
+        first.bridge.tool_budget_exhausted = True
+
+        async with first.lock:
+            again = await manager.get_or_create("t1", signature=sig, factory=factory)
+            assert again is first
+            assert not first.agent.exited
+            assert first.bridge.tool_budget_exhausted is True
+
+        rebuilt = await manager.get_or_create("t1", signature=sig, factory=factory)
+        assert rebuilt is not first
+        assert rebuilt.agent.resumed_from == first.agent.conversation_id
+        await manager.stop()
```

---

### Incident Patch 8: `d52cc7f6` (2026-10-05)
**Commit Message**: fix(langgraph-ts): name the owning assistant message as a non-streamed tool call's parent

OnToolEnd announces a tool call that never streamed, and named the tool
result's id as its parent. A ToolMessage usually has no id at that point, so
clients hung the call on a stand-in message keyed by the call id that no
MESSAGES_SNAPSHOT recognises; on the Command path the tool message's own id
was named instead.

Record each call's owner at OnChatModelEnd (plain or LangChain-serialized
output), name it at both OnToolEnd announcement sites, and send no parent when
this run never saw the owner. Mirrors the Python fix in this PR.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `integrations/langgraph/typescript/src/agent.ts` (modified, +41/-2)
```diff
@@ -210,6 +210,10 @@ export class LangGraphAgent extends AbstractAgent {
   assistant?: Assistant;
   messagesInProcess: MessagesInProgressRecord;
   emittedToolCallStartIds: Set<string> = new Set();
+  // The assistant message that made each tool call, recorded at OnChatModelEnd
+  // and keyed tool_call_id -> message id. OnToolEnd names it as the parent when
+  // it announces a call that never streamed. Reset per run, like the Set above.
+  toolCallOwners: Map<string, string> = new Map();
   reasoningProcess: null | ReasoningInProgress;
   // Canonical reasoning id (e.g. OpenAI `rs_…`) stashed from a text-less id
   // carrier chunk, consumed when the first text delta opens the reasoning
@@ -936,6 +940,7 @@ export class LangGraphAgent extends AbstractAgent {
     if (!stream) return;
     // Reset per-run tracking of emitted tool call IDs
     this.emittedToolCallStartIds = new Set<string>();
+    this.toolCallOwners = new Map<string, string>();
 
     let { streamResponse, state } = stream;
 
@@ -1456,6 +1461,35 @@ export class LangGraphAgent extends AbstractAgent {
     );
   }
 
+  /**
+   * Remember which assistant message made each of `output`'s tool calls.
+   *
+   * OnChatModelEnd is the one point every model call passes through, whether or
+   * not it streamed. OnToolEnd reads the owner back to name the parent of a
+   * call it has to announce itself; before this it named the tool result's id,
+   * which a ToolMessage usually lacks, so clients hung the call on a stand-in
+   * message no snapshot recognises. The output arrives either as a plain
+   * message dict or LangChain-serialized (`{ lc, kwargs }`). A call id seen
+   * twice in a run belongs to the later message.
+   */
+  private recordToolCallOwners(output: any): void {
+    const message = output?.lc && output?.kwargs ? output.kwargs : output;
+    const messageId = message?.id;
+    const toolCalls = message?.tool_calls;
+    if (
+      typeof messageId !== "string" ||
+      !messageId ||
+      !Array.isArray(toolCalls)
+    ) {
+      return;
+    }
+    for (const toolCall of toolCalls) {
+      if (toolCall?.id) {
+        this.toolCallOwners.set(toolCall.id, messageId);
+      }
+    }
+  }
+
   handleSingleEvent(event: any): void {
     // messages-tuple data arrives as [AIMessageChunk, metadata] arrays,
     // not objects with an .event property like events-mode data.
@@ -1685,6 +1719,7 @@ export class LangGraphAgent extends AbstractAgent {
 
         break;
       case LangGraphEventTypes.OnChatModelEnd:
+        this.recordToolCallOwners(event.data?.output);
         if (this.getMessageInProgress(this.activeRun!.id)?.toolCallId) {
           const resolved = this.dispatchEvent({
             type: EventType.TOOL_CALL_END,
@@ -1804,7 +1839,9 @@ export class LangGraphAgent extends AbstractAgent {
                   type: EventType.TOOL_CALL_START,
                   toolCallId: message.tool_call_id,
                   toolCallName: message.name ?? "",
-                  parentMessageId: message.id,
+                  parentMessageId: this.toolCallOwners.get(
+                    message.tool_call_id,
+                  ),
                   rawEvent: event,
                 });
                 this.dispatchEvent({
@@ -1847,7 +1884,9 @@ export class LangGraphAgent extends AbstractAgent {
             type: EventType.TOOL_CALL_START,
             toolCallId: toolCallOutput.tool_call_id,
             toolCallName: toolCallOutput.name,
-            parentMessageId: toolCallOutput.id,
+            parentMessageId: this.toolCallOwners.get(
+              toolCallOutput.tool_call_id,
+            ),
             rawEvent: event,
           });
           this.dispatchEvent({
```

**File**: `integrations/langgraph/typescript/src/tool-call-parent-message-id.test.ts` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+/**
+ * Which message a non-streamed tool call is attached to.
+ *
+ * A tool call that never streamed through `OnChatModelStream` is announced
+ * from `OnToolEnd` instead. That announcement used to name the tool *result's*
+ * id as the call's parent. A ToolMessage usually has no id at that point, so
+ * clients hung the call on a stand-in message keyed by the call id, which no
+ * MESSAGES_SNAPSHOT would ever recognise.
+ *
+ * The parent of a tool call is the assistant message whose `tool_calls` hold
+ * it. These tests pin that contract on the `OnToolEnd` path. Mirrors the
+ * Python integration's test_tool_call_parent_message_id.py.
+ */
+
+import { describe, it, expect } from "vitest";
+import { EventType } from "@ag-ui/core";
+import { LangGraphAgent } from "./agent";
+
+function createAgent() {
+  const agent = new LangGraphAgent({
+    deploymentUrl: "http://localhost:2024",
+    graphId: "test-graph",
+  });
+  const dispatched: any[] = [];
+  agent.dispatchEvent = (event: any) => {
+    dispatched.push(event);
+    return event as any;
+  };
+  (agent as any).activeRun = {
+    id: "run-1",
+    threadId: "thread-1",
+    hasFunctionStreaming: false,
+    modelMadeToolCall: false,
+  };
+  agent.messages = [];
+  return { agent, dispatched };
+}
+
+function aiMessageWithCall(
+  messageId: string,
+  toolCallId: string,
+  name = "search",
+) {
+  return {
+    type: "ai",
+    id: messageId,
+    content: "",
+    tool_calls: [{ id: toolCallId, name, args: { query: "x" } }],
+  };
+}
+
+function modelEnd(output: any) {
+  return {
+    event: "on_chat_model_end",
+    metadata: { langgraph_node: "model" },
+    data: { output },
+  };
+}
+
+function toolEnd(toolCallId: string, name = "search") {
+  return {
+    event: "on_tool_end",
+    metadata: { langgraph_node: "tools" },
+    data: {
+      input: { query: "x" },
+      output: { tool_call_id: toolCallId, name, content: "found" },
+    },
+  };
+}
+
+function commandToolEnd(toolCallId: string, name = "search") {
+  return {
+    event: "on_tool_end",
+    metadata: { langgraph_node: "tools" },
+    data: {
+      input: { query: "x" },
+      output: {
+        update: {
+          messages: [
+            {
+              type: "tool",
+              tool_call_id: toolCallId,
+              name,
+              content: "found",
+              id: "tm-1",
+            },
+          ],
+        },
+      },
+    },
+  };
+}
+
+const startFor = (dispatched: any[], toolCallId: string) =>
+  dispatched.filter(
+    (e) => e.type === EventType.TOOL_CALL_START && e.toolCallId === toolCallId,
+  );
+
+describe("OnToolEnd names the assistant message that made a non-streamed call", () => {
+  it("names the owning message as parent", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+  });
+
+  it("reads the owner from a LangChain-serialized model output", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(
+      modelEnd({
+        lc: 1,
+        type: "constructor",
+        id: ["langchain_core", "messages", "AIMessage"],
+        kwargs: aiMessageWithCall("ai-1", "tc-1"),
+      }),
+    );
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+  });
+
+  it("names the owning message on the Command path, not the tool message", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(commandToolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+  });
+
+  it("keeps each parallel call with its own owner", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-2", "tc-2")));
+    agent.handleSingleEvent(toolEnd("tc-2"));
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-1");
+    expect(startFor(dispatched, "tc-2")[0].parentMessageId).toBe("ai-2");
+  });
+
+  it("gives a call id seen twice in a run to the later message", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-1", "tc-1")));
+    agent.handleSingleEvent(modelEnd(aiMessageWithCall("ai-2", "tc-1")));
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0].parentMessageId).toBe("ai-2");
+  });
+
+  it("sends no parent when this run never saw the owner", () => {
+    const { agent, dispatched } = createAgent();
+
+    agent.handleSingleEvent(toolEnd("tc-1"));
+
+    expect(startFor(dispatched, "tc-1")[0
```

---

### Incident Patch 9: `39b70816` (2026-10-05)
**Commit Message**: fix(langgraph): name the owning assistant message as a non-streamed tool call's parent

A tool call that never streamed through OnChatModelStream (a model that
does not stream, or a call streamed by the run before an interrupt) is
announced from OnToolEnd. That announcement named the tool result's id
(or the call id) as the call's parent, and the TOOL_CALL_RESULT that
follows reuses the same id as the result message's own. Clients got an
assistant message and a tool message sharing one id: the call hung on a
stand-in no snapshot recognises, and consumers that merge messages by
id let the tool message overwrite the message carrying the call.

Record each call's owner at OnChatModelEnd, which every model call
passes through, and name it on the OnToolEnd path. When this run never
saw the owner, send no parent rather than a wrong one, so a client can
find a call it already holds.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `integrations/langgraph/python/ag_ui_langgraph/agent.py` (modified, +45/-6)
```diff
@@ -1616,6 +1616,7 @@ async def _handle_stream_events(self, input: RunAgentInput) -> AsyncGenerator[Pr
             "node_name": None,
             "has_function_streaming": False,
             "streamed_tool_call_ids": set(),
+            "tool_call_owners": {},
             "model_made_tool_call": False,
             "state_reliable": True,
             "active_subagents": {},
@@ -3554,6 +3555,7 @@ def _chunk_get(c: Any, key: str, default: Any = None) -> Any:
                 ),
                 streamed=False,
             )
+            self._record_tool_call_owners(output_message)
 
             if self.get_message_in_progress(self.active_run["id"]) and self.get_message_in_progress(self.active_run["id"]).get("tool_call_id"):
                 resolved = self._dispatch_event(
@@ -3689,9 +3691,7 @@ def _chunk_get(c: Any, key: str, default: Any = None) -> Any:
                                 type=EventType.TOOL_CALL_START,
                                 tool_call_id=public_call_id,
                                 tool_call_name=tool_msg.name or event.get("name", ""),
-                                parent_message_id=self._resolve_public_message_id(
-                                    str(tool_msg.id or tool_msg.tool_call_id)
-                                ),
+                                parent_message_id=self._tool_call_owner(tool_msg.tool_call_id),
                                 raw_event=event,
                             )
                         )
@@ -3752,9 +3752,7 @@ def _chunk_get(c: Any, key: str, default: Any = None) -> Any:
                         type=EventType.TOOL_CALL_START,
                         tool_call_id=public_call_id,
                         tool_call_name=tool_call_output.name or event.get("name", ""),
-                        parent_message_id=self._resolve_public_message_id(
-                            str(tool_call_output.id or tool_call_output.tool_call_id)
-                        ),
+                        parent_message_id=self._tool_call_owner(tool_call_output.tool_call_id),
                         raw_event=event,
                     )
                 )
@@ -4190,6 +4188,47 @@ def lane_raw_form(public_id: str) -> str:
     def _resolve_public_message_id(self, upstream_id: str, lane: Optional[str] = None) -> str:
         return self._resolve_public_id(upstream_id, "message", lane)
 
+    def _record_tool_call_owners(self, message: Any) -> None:
+        """Remember which assistant message made each of ``message``'s tool calls.
+
+        Called at OnChatModelEnd, the one point every model call passes through
+        whether or not it streamed. OnToolEnd reads it back through
+        ``_tool_call_owner`` to name the parent of a call it has to announce
+        itself. The message id is resolved to its public form here, in the
+        model's lane, so it is the same id the streaming path would have named.
+        """
+        if isinstance(message, dict):
+            message_id = message.get("id")
+            tool_calls = message.get("tool_calls") or []
+        else:
+            message_id = getattr(message, "id", None)
+            tool_calls = getattr(message, "tool_calls", None) or []
+        if not message_id or not tool_calls:
+            return
+        public_message_id = self._resolve_public_message_id(str(message_id))
+        owners = self.active_run.setdefault("tool_call_owners", {}).setdefault(
+            self._current_lane(), {}
+        )
+        for call in tool_calls:
+            call_id = call.get("id") if isinstance(call, dict) else getattr(call, "id", None)
+            if call_id:
+                owners[call_id] = public_message_id
+
+    def _tool_call_owner(self, tool_call_id: str) -> Optional[str]:
+        """The public id of the assistant message that made ``tool_call_id``.
+
+        ``None`` when this run never saw that message — a call streamed by the
+        run before an interrupt, say. No parent is the honest answer then: a
+        client finds a call it already holds, and otherwise hangs it on a new
+        message keyed by the call id. Any guessed id, including the tool
+        result's, is worse — the result message reuses it as its own id.
+        """
+        return (
+            self.active_run.get("tool_call_owners", {})
+            .get(self._current_lane(), {})
+            .get(tool_call_id)
+        )
+
     def _resolve_public_tool_call_id(self, upstream_id: str, lane: Optional[str] = None) -> str:
         return self._resolve_public_id(upstream_id, "tool_call", lane)
 
```

**File**: `integrations/langgraph/python/ag_ui_langgraph/types.py` (modified, +5/-0)
```diff
@@ -112,6 +112,11 @@ class CustomEventNames(str, Enum):
     # flag, and the outer tool's OnToolEnd would then re-emit its Args,
     # producing duplicate / concatenated payloads in persisted history.
     "streamed_tool_call_ids": NotRequired[Set[str]],
+    # The assistant message that made each tool call, recorded at
+    # OnChatModelEnd and keyed lane -> raw tool_call_id -> public message id.
+    # OnToolEnd names it as the parent when it announces a call that never
+    # streamed. Without it that announcement had no owner to name.
+    "tool_call_owners": NotRequired[Dict[str, Dict[str, str]]],
     "model_made_tool_call": NotRequired[bool],
     "state_reliable": NotRequired[bool],
     # Message / state data
```

**File**: `integrations/langgraph/python/tests/test_tool_call_parent_message_id.py` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+"""
+Which message a non-streamed tool call is attached to.
+
+A tool call that never streamed through ``OnChatModelStream`` — a model that
+does not stream, or a call the previous run streamed before an interrupt — is
+announced from ``OnToolEnd`` instead. That announcement used to name the tool
+*result's* id as the call's parent, and then reuse the same id for the result
+message itself. A client therefore received an assistant message and a tool
+message sharing one id: the call was hung on a stand-in that no snapshot would
+ever recognise, and any consumer that merges messages by id (CopilotKit does)
+let the tool message overwrite the assistant message that carried the call.
+
+The parent of a tool call is the assistant message whose ``tool_calls`` hold
+it. These tests pin that contract on the ``OnToolEnd`` path.
+"""
+
+import asyncio
+import unittest
+
+from langchain_core.messages import AIMessage, AIMessageChunk
+
+from ag_ui.core import EventType
+from tests.test_nested_tool_end_dedup import _event, _run_stream, _tool_end
+
+
+def _model_end(output):
+    return _event("on_chat_model_end", node="model", data={"output": output})
+
+
+def _ai_message_with_call(*, message_id, tool_call_id, name="search"):
+    return AIMessage(
+        content="",
+        id=message_id,
+        tool_calls=[{"id": tool_call_id, "name": name, "args": {"query": "x"}}],
+    )
+
+
+def _first(dispatched, event_type, tool_call_id):
+    return next(
+        ev
+        for ev in dispatched
+        if ev.type == event_type and getattr(ev, "tool_call_id", None) == tool_call_id
+    )
+
+
+class TestNonStreamedToolCallParent(unittest.TestCase):
+    def test_parent_is_the_assistant_message_that_made_the_call(self):
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    # A model that did not stream: its message arrives whole.
+                    _model_end(_ai_message_with_call(message_id="ai-1", tool_call_id="tc-1")),
+                    _tool_end("search", "tc-1", content="found"),
+                ]
+            )
+        )
+
+        start = _first(dispatched, EventType.TOOL_CALL_START, "tc-1")
+        self.assertEqual(start.parent_message_id, "ai-1")
+
+    def test_result_id_never_doubles_as_the_parent(self):
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    _model_end(_ai_message_with_call(message_id="ai-1", tool_call_id="tc-1")),
+                    _tool_end("search", "tc-1", content="found"),
+                ]
+            )
+        )
+
+        start = _first(dispatched, EventType.TOOL_CALL_START, "tc-1")
+        result = _first(dispatched, EventType.TOOL_CALL_RESULT, "tc-1")
+        self.assertNotEqual(start.parent_message_id, result.message_id)
+
+    def test_each_parallel_call_keeps_its_own_owner(self):
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    _model_end(_ai_message_with_call(message_id="ai-1", tool_call_id="tc-1")),
+                    _model_end(_ai_message_with_call(message_id="ai-2", tool_call_id="tc-2")),
+                    _tool_end("search", "tc-2", content="second"),
+                    _tool_end("search", "tc-1", content="first"),
+                ]
+            )
+        )
+
+        self.assertEqual(_first(dispatched, EventType.TOOL_CALL_START, "tc-1").parent_message_id, "ai-1")
+        self.assertEqual(_first(dispatched, EventType.TOOL_CALL_START, "tc-2").parent_message_id, "ai-2")
+
+    def test_owner_unknown_sends_no_parent_rather_than_a_wrong_one(self):
+        # The call streamed in the run before an interrupt, so this run never
+        # saw the model message that made it. Naming no parent lets the client
+        # find the call where it already is; naming the result id did not.
+        dispatched = asyncio.run(_run_stream([_tool_end("search", "tc-1", content="found")]))
+
+        start = _first(dispatched, EventType.TOOL_CALL_START, "tc-1")
+        self.assertIsNone(start.parent_message_id)
+
+    def test_streamed_calls_keep_the_chunk_id_as_parent(self):
+        # Regression guard: the streaming path already names the right parent,
+        # and recording owners at model end must not disturb it.
+        chunk = AIMessageChunk(content="", id="ai-stream-1")
+        chunk.response_metadata = {}
+        chunk.tool_call_chunks = [{"name": "search", "args": "", "id": "tc-1", "index": 0}]
+        end_chunk = AIMessageChunk(content="", id="ai-stream-1")
+        end_chunk.response_metadata = {}
+        end_chunk.tool_call_chunks = []
+
+        dispatched = asyncio.run(
+            _run_stream(
+                [
+                    _event("on_chat_model_stream", data={"chunk": chunk}),
+                    _event("on_chat_model_stream", data={"chunk": end_chunk}),
+                    _model_end(_ai_message_with_call(message_id="ai-stream-1", tool_call_id="tc-1")),
+                    _t
```

---

### Incident Patch 10: `e776b210` (2026-10-05)
**Commit Message**: Merge pull request #2959 from ag-ui-protocol/release/next

release: sdk-ts

**File**: `sdks/typescript/packages/client/CHANGELOG.md` (modified, +10/-0)
```diff
@@ -1,5 +1,15 @@
 # Changelog
 
+## 1.0.2 — 2026-10-05
+
+- The client now accepts more optional fields sent as `null` and treats them as absent, with one warning per field per run. Previously these failed the run.
+- Events received before an agent's error (including `RUN_ERROR`) now reach `onEvent` and `onRunErrorEvent` instead of being dropped.
+- HTTP stream cleanup failures no longer mask the original stream error.
+
+### Breaking changes
+
+None.
+
 ## 1.0.1 — 2026-09-29
 
 - Fixed `connectAgent()` failing when reconnecting to a thread with pending interrupts; connects now read thread history without requiring resume answers.
```

**File**: `sdks/typescript/packages/client/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/client",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

**File**: `sdks/typescript/packages/core/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 # Changelog
 
+## 1.0.2 — 2026-10-05
+
+- Maintenance release; no consumer-facing changes identified.
+
+### Breaking changes
+
+None.
+
 ## 1.0.1 — 2026-09-29
 
 - Maintenance release; no consumer-facing changes identified.
```

**File**: `sdks/typescript/packages/core/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/core",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

**File**: `sdks/typescript/packages/encoder/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 # Changelog
 
+## 1.0.2 — 2026-10-05
+
+- Maintenance release; no consumer-facing changes identified.
+
+### Breaking changes
+
+None.
+
 ## 1.0.1 — 2026-09-29
 
 - Maintenance release; no consumer-facing changes identified.
```

**File**: `sdks/typescript/packages/encoder/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/encoder",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

**File**: `sdks/typescript/packages/proto/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 # Changelog
 
+## 1.0.2 — 2026-10-05
+
+- Maintenance release; no consumer-facing changes identified.
+
+### Breaking changes
+
+None.
+
 ## 1.0.1 — 2026-09-29
 
 - Maintenance release; no consumer-facing changes identified.
```

**File**: `sdks/typescript/packages/proto/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/proto",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

---

### Incident Patch 11: `feb2a7c7` (2026-10-05)
**Commit Message**: docs(release): shorten the @ag-ui/client 1.0.2 changelog

**File**: `sdks/typescript/packages/client/CHANGELOG.md` (modified, +4/-7)
```diff
@@ -2,16 +2,13 @@
 
 ## 1.0.2 — 2026-10-05
 
-- Compatibility boundary now accepts optional fields sent as null by Microsoft Agent Framework .NET 1.23 with AGUI.Abstractions 1.0.0, previously rejected at first RUN_STARTED.
-- Tolerated optional nulls converted to absent via a single OPTIONAL_NULLS table; covers subagentRunId, RUN_STARTED.parentRunId/input, TOOL_CALL_RESULT.role, RUN_FINISHED.outcome.pendingToolCalls.
-- Warning emitted once per field and location per run, reset on each RUN_STARTED and each run() call.
-- Fixed dropped events when an agent emitted RUN_ERROR then errored its Observable; all received events now applied before the source error propagates.
-- HTTP stream cleanup failures contained, preserving original stream failure and handling early cancellation without detached promise rejections.
+- The client now accepts more optional fields sent as `null` and treats them as absent, with one warning per field per run. Previously these failed the run.
+- Events received before an agent's error (including `RUN_ERROR`) now reach `onEvent` and `onRunErrorEvent` instead of being dropped.
+- HTTP stream cleanup failures no longer mask the original stream error.
 
 ### Breaking changes
 
-- Optional fields sent as null are now coerced to absent at the compatibility boundary; consumers relying on prior rejection or on null values should re-verify.
-- RUN_ERROR followed by an errored Observable now delivers queued events (including RUN_ERROR) to onEvent/onRunErrorEvent; verify handler ordering assumptions.
+None.
 
 ## 1.0.1 — 2026-09-29
 
```

---

### Incident Patch 12: `3642011b` (2026-10-05)
**Commit Message**: chore(release): bump sdk-ts (@ag-ui/core@1.0.2, @ag-ui/client@1.0.2, @ag-ui/encoder@1.0.2, @ag-ui/proto@1.0.2)

**File**: `sdks/typescript/packages/client/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/client",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

**File**: `sdks/typescript/packages/core/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/core",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

**File**: `sdks/typescript/packages/encoder/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/encoder",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

**File**: `sdks/typescript/packages/proto/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@ag-ui/proto",
   "author": "Markus Ecker <markus.ecker@gmail.com>",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "agui": {
     "protocolVersion": "1.0"
   },
```

---

### Incident Patch 13: `fe3429eb` (2026-10-05)
**Commit Message**: Merge pull request #2957 from ag-ui-protocol/mme/pni-573

PNI-573 (TS client: tolerate more optional nulls in the compatibility boundary)

**File**: `DEPRECATIONS.md` (modified, +20/-7)
```diff
@@ -48,6 +48,16 @@ conversions.
 | `metadata: null` on a `document` content part                                               | omit the field                                                                                                            | inbound boundary (events)                                             | 2027-09-17 |
 | `parameters: null` on a tool                                                                | omit the field                                                                                                            | inbound boundary (events)                                             | 2027-09-17 |
 | `forwardedProps: null` on `RunAgentInput`                                                   | omit the field                                                                                                            | inbound boundary (events)                                             | 2027-09-17 |
+| `subagentRunId: null` on an event                                                           | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `parentRunId: null` on `RUN_STARTED`                                                        | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `input: null` on `RUN_STARTED`                                                              | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `role: null` on `TOOL_CALL_RESULT`                                                          | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `pendingToolCallIds: null` on a `RUN_FINISHED` outcome                                      | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `provider: null` on a `RUN_FINISHED` usage entry                                            | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `reasoningTokens: null` on a `RUN_FINISHED` usage entry                                     | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `cachedInputTokens: null` on a `RUN_FINISHED` usage entry                                   | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `cacheWriteInputTokens: null` on a `RUN_FINISHED` usage entry                               | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `usage: null` on `RUN_ERROR`                                                                | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
 | `InputContent` and the `...InputContent` / `InputContent...Source` type and validator names | `ContentPart`, `TextPart`, `ImagePart`, `AudioPart`, `VideoPart`, `DocumentPart`, `PartSource`, `DataSource`, `UrlSource` | exported aliases of the same types in `@ag-ui/core` and `ag_ui.core`  | 2027-09-17 |
 | `BinaryInputContent` (Python `ag_ui.core`) | the media parts (`ImagePart`, `AudioPart`, `VideoPart`, `DocumentPart`) with a `DataSource` or `UrlSource` | exported as a standalone class so an adapter written against 0.x still imports; no message shape carries it, and a `binary` part is rejected at `RunAgentInput` validation | 2027-09-17 |
 | `SubAgentInfo` (Python `ag_ui.core`) | `SubagentInfo` | exported alias of the same class; the wire key is `subagents` only | 2027-09-17 |
@@ -61,20 +71,23 @@ mirror with matching media type, source kind, MIME type and payload or URL;
 any legacy filename must also be retained by the modern part. Repeated modern
 attachments and legacy-o
```

**File**: `docs/migrating-to-1-0.mdx` (modified, +14/-6)
```diff
@@ -51,14 +51,20 @@ Optional protocol fields must be absent instead of `null`, including `rawEvent`,
 inputs omit these fields before transmission. Emit the canonical shape from
 in-memory agents too.
 
-Older producers remain compatible where the previous SDK accepted a whole
-optional `null`. Before validation, the client translates it to an absent field
-and warns for `rawEvent`, `RUN_FINISHED.result`, `SUBAGENT_FINISHED.result`,
+Older producers remain compatible for a fixed set of whole optional `null`
+fields. Before validation, the client translates each to an absent field and
+warns once per field per run for `rawEvent` and `subagentRunId` on any event,
+`RUN_STARTED.parentRunId`, `RUN_STARTED.input`, `RUN_FINISHED.result`,
+`RUN_FINISHED.outcome.pendingToolCallIds`, `provider`, `reasoningTokens`,
+`cachedInputTokens` and `cacheWriteInputTokens` in `RUN_FINISHED.usage[]`,
+`RUN_ERROR.usage`, `SUBAGENT_FINISHED.result`, `TOOL_CALL_RESULT.role`,
 resume-entry `payload`, media-part `metadata` (`image`, `audio`, `video`,
 `document`), tool `parameters`, and `RunAgentInput.forwardedProps`. This applies
 to in-memory runs, reconnects, SSE, and protobuf, including messages and input
 echoes embedded in events. Subscribers receive the normalized event: for
-example, an old `RUN_FINISHED.result: null` becomes an absent result.
+example, an old `RUN_FINISHED.result: null` becomes an absent result. This is
+client tolerance, not a protocol change: producers must still omit these
+fields.
 
 Direct schema validation remains strict and does not invoke the client's event
 compatibility boundary. Request handlers accepting older `RunAgentInput` values
@@ -71,8 +77,10 @@ run/connect request parser handles this as a local compatibility exception;
 AG-UI does not expose a public request-normalization helper. The existing
 `RunAgentInput.state: null` parser tolerance still yields `undefined`.
 
-This compatibility is limited to historically accepted fields. Event or message
-`metadata: null` and `parentRunId: null` remain invalid. Required JSON payloads
+This compatibility is limited to the fields listed above. Event or message
+`metadata: null` remains invalid, as do other optional nulls such as
+`TEXT_MESSAGE_START.name`, `RUN_ERROR.code`, `usage[].model`,
+`RunAgentInput.parentRunId`, and a `subagentRunId: null` nested in a message. Required JSON payloads
 such as `CUSTOM.value`, and null values inside state, metadata, or other
 application data, remain valid and are preserved.
 
```

**File**: `sdks/typescript/packages/client/src/enforce/__tests__/enforce.test.ts` (modified, +17/-7)
```diff
@@ -359,13 +359,23 @@ describe("expansion does not repair, whichever stage reaches it first", () => {
     await expect(without.runAgent()).rejects.toThrow();
   });
 
-  it("keeps a null subagentRunId fatal with a middleware installed", async () => {
-    const withMiddleware = new MemoryAgent([START, chunk({ subagentRunId: null }), FINISH]);
-    withMiddleware.use(new ObservingMiddleware());
-    const without = new MemoryAgent([START, chunk({ subagentRunId: null }), FINISH]);
-
-    await expect(withMiddleware.runAgent()).rejects.toThrow();
-    await expect(without.runAgent()).rejects.toThrow();
+  // A null subagentRunId is the one null that is NOT fatal here: it is one of
+  // the tolerated optional nulls (PNI-573). The inbound
+  // compatibility boundary reads it as absent before expansion on both paths,
+  // so the outcome still does not depend on whether a middleware is installed.
+  it("reads a null subagentRunId as absent, with or without a middleware", async () => {
+    for (const withMiddleware of [true, false]) {
+      const agent = new MemoryAgent([START, chunk({ subagentRunId: null }), FINISH]);
+      if (withMiddleware) agent.use(new ObservingMiddleware());
+      const seen: BaseEvent[] = [];
+      await agent.runAgent(undefined, {
+        onEvent: ({ event }) => {
+          seen.push(event);
+        },
+      });
+      expect(seen.map((event) => event.type)).toContain(EventType.TEXT_MESSAGE_CONTENT);
+      for (const event of seen) expect(event).not.toHaveProperty("subagentRunId");
+    }
   });
 
   // The other half: an ABSENT role still becomes assistant, which is the
```

**File**: `sdks/typescript/packages/client/src/middleware/__tests__/compatibility-boundary-null.test.ts` (modified, +59/-1)
```diff
@@ -139,6 +139,65 @@ const cases = [
     events: [start, snapshot({ metadata: null }, type), finish],
     expected: [start, snapshot({}, type), finish],
   })),
+  {
+    name: "subagentRunId on an event",
+    events: [start, { type: EventType.CUSTOM, name: "x", value: 1, subagentRunId: null }, finish],
+    expected: [start, { type: EventType.CUSTOM, name: "x", value: 1 }, finish],
+  },
+  {
+    name: "RUN_STARTED.parentRunId and RUN_STARTED.input",
+    events: [{ ...start, parentRunId: null, input: null }, finish],
+    expected: [start, finish],
+  },
+  {
+    name: "TOOL_CALL_RESULT.role",
+    events: [
+      start,
+      {
+        type: EventType.TOOL_CALL_RESULT,
+        messageId: "m",
+        toolCallId: "c",
+        content: "x",
+        role: null,
+      },
+      finish,
+    ],
+    expected: [
+      start,
+      { type: EventType.TOOL_CALL_RESULT, messageId: "m", toolCallId: "c", content: "x" },
+      finish,
+    ],
+  },
+  {
+    name: "RUN_FINISHED.outcome.pendingToolCallIds and RUN_FINISHED.usage[] fields",
+    events: [
+      start,
+      {
+        ...finish,
+        outcome: { type: "success", pendingToolCallIds: null },
+        usage: [
+          {
+            model: "m",
+            inputTokens: 1,
+            outputTokens: 1,
+            totalTokens: 2,
+            provider: null,
+            reasoningTokens: null,
+            cachedInputTokens: null,
+            cacheWriteInputTokens: null,
+          },
+        ],
+      },
+    ],
+    expected: [
+      start,
+      {
+        ...finish,
+        outcome: { type: "success" },
+        usage: [{ model: "m", inputTokens: 1, outputTokens: 1, totalTokens: 2 }],
+      },
+    ],
+  },
   {
     name: "media metadata inside RUN_STARTED.input",
     events: [inputEvent({ messages: snapshot({ metadata: null }, "image").messages }), finish],
@@ -240,7 +299,6 @@ describe("the internal request compatibility helper", () => {
 describe("existing null restrictions", () => {
   it.each([
     { field: "metadata", event: { ...finish, metadata: null } },
-    { field: "parentRunId", event: { ...start, parentRunId: null } },
     { field: "timestamp", event: { ...finish, timestamp: null } },
     { field: "parentRunId", event: inputEvent({ parentRunId: null }) },
     {
```

**File**: `sdks/typescript/packages/client/src/middleware/__tests__/compatibility-boundary-optional-nulls.test.ts` (added, +393/-0)
```diff
@@ -0,0 +1,393 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { from, type Observable } from "rxjs";
+import { EventType, type BaseEvent, type Message } from "@ag-ui/core";
+import { EventSchema } from "@ag-ui/core/schemas";
+import { AbstractAgent, HttpAgent } from "@/agent";
+
+// The tolerated optional nulls (PNI-573), end to end. The fixtures below are
+// recorded producer streams: real SSE from a producer that writes every unset
+// optional field as an explicit null. Each rawEvent is the recorded one cut
+// down to a few top-level keys; its nulls are opaque provider data and must
+// survive.
+
+// Recorded agentic chat: "Hi, I am duaa".
+const AGENTIC_CHAT = [
+  `{"type":"RUN_STARTED","threadId":"t1","runId":"r1","parentRunId":null,"input":null}`,
+  `{"type":"TEXT_MESSAGE_START","subagentRunId":null,"messageId":"chatcmpl-sZwVO-ktzIGDEfy3","role":"assistant","name":"AgenticChat","rawEvent":{"authorName":"AgenticChat","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TEXT_MESSAGE_CONTENT","subagentRunId":null,"messageId":"chatcmpl-sZwVO-ktzIGDEfy3","delta":"Hello duaa! How can ","rawEvent":{"authorName":"AgenticChat","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TEXT_MESSAGE_CONTENT","subagentRunId":null,"messageId":"chatcmpl-sZwVO-ktzIGDEfy3","delta":"I assist you today?","rawEvent":{"authorName":"AgenticChat","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TEXT_MESSAGE_END","subagentRunId":null,"messageId":"chatcmpl-sZwVO-ktzIGDEfy3"}`,
+  `{"type":"RUN_FINISHED","threadId":"t1","runId":"r1","result":null,"outcome":{"type":"success","pendingToolCallIds":null},"usage":[{"provider":null,"model":"gpt-4o","inputTokens":4,"outputTokens":10,"totalTokens":14,"reasoningTokens":null,"cachedInputTokens":null,"cacheWriteInputTokens":null}]}`,
+];
+
+// Recorded backend tool call, "Weather in San Francisco": adds TOOL_CALL_RESULT.role.
+const BACKEND_TOOL = [
+  `{"type":"RUN_STARTED","threadId":"t1","runId":"r1","parentRunId":null,"input":null}`,
+  `{"type":"TOOL_CALL_START","subagentRunId":null,"toolCallId":"call_get_weather_1","toolCallName":"get_weather","parentMessageId":"chatcmpl-0-gVLlBKHQ9dkxwa","rawEvent":{"authorName":"BackendToolRenderer","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TOOL_CALL_ARGS","subagentRunId":null,"toolCallId":"call_get_weather_1","delta":"{\\"location\\":\\"San Francisco\\"}","rawEvent":{"authorName":"BackendToolRenderer","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TOOL_CALL_END","subagentRunId":null,"toolCallId":"call_get_weather_1","rawEvent":{"authorName":"BackendToolRenderer","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TOOL_CALL_RESULT","subagentRunId":null,"messageId":"call_get_weather_1","toolCallId":"call_get_weather_1","content":"{\\"temperature\\":20,\\"conditions\\":\\"sunny\\",\\"humidity\\":50,\\"wind_speed\\":10,\\"feelsLike\\":25}","role":null,"rawEvent":{"authorName":"BackendToolRenderer","role":"tool","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TEXT_MESSAGE_START","subagentRunId":null,"messageId":"chatcmpl-NG0L5yQS-D_biey7","role":"assistant","name":"BackendToolRenderer","rawEvent":{"authorName":"BackendToolRenderer","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TEXT_MESSAGE_CONTENT","subagentRunId":null,"messageId":"chatcmpl-NG0L5yQS-D_biey7","delta":"Done! I've completed","rawEvent":{"authorName":"BackendToolRenderer","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TEXT_MESSAGE_CONTENT","subagentRunId":null,"messageId":"chatcmpl-NG0L5yQS-D_biey7","delta":" that for you.","rawEvent":{"authorName":"BackendToolRenderer","role":"assistant","conversationId":null,"additionalProperties":null}}`,
+  `{"type":"TEXT_MESSAGE_END","subagentRunId":null,"messageId":"chatcmpl-NG0L5yQS-D_biey7"}`,
+  `{"type":"RUN_FINISHED","threadId":"t1","runId":"r1","result":null,"outcome":{"type":"success","pendingToolCallIds":null},"usage":[{"provider":null,"model":"gpt-4o","inputTokens":39,"outputTokens":19,"totalTokens":58,"reasoningTokens":null,"cachedInputTokens":null,"cacheWriteInputTokens":null}]}`,
+];
+
+// Recorded run with the model provider unreachable: RUN_ERROR.usage.
+const RUN_ERROR = [
+  `{"type":"RUN_ERROR","message":"An error occurred while streaming the agent response.","code":"StreamingError","usage":null}`,
+];
+
+const RECORDED_RAW_EVENT = { conversationId: null, additionalProperties: null };
+
+const sse = (lines: string[]) =>
+  new Response(lines.map((line) => `data: ${line}\n\n`).join(""), {
+    headers: { "Content-Type": "text/event-stream" },
+  });
+
+function sseAgent(lines: string[]) {
+  return new HttpAgent({
+    threadId: "t1",
+    url: "https://producer.example.test/agent",
```

**File**: `sdks/typescript/packages/client/src/middleware/compat-warning.ts` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+/**
+ * The compatibility boundary's conversion notice, in its own module so the
+ * verifier can announce the same conversion without importing the middleware
+ * (which would close an import cycle through the agent).
+ * @internal
+ */
+export function warnCompatibility(what: string, replacement: string) {
+  if (
+    typeof process !== "undefined" &&
+    typeof process.env !== "undefined" &&
+    process.env.SUPPRESS_TRANSFORMATION_WARNINGS
+  )
+    return;
+  console.warn(
+    `[ag-ui][compat] Converting deprecated ${what} to ${replacement}. The old shape leaves the protocol after its shim window — see the repo-root DEPRECATIONS.md. Set SUPPRESS_TRANSFORMATION_WARNINGS=true to silence.`,
+  );
+}
```

**File**: `sdks/typescript/packages/client/src/middleware/compatibility-boundary.ts` (modified, +132/-65)
```diff
@@ -6,6 +6,7 @@ import { defer, type Observable } from "rxjs";
 import { map } from "rxjs/operators";
 import { randomUUID } from "@/utils";
 import { upgradeMessageContent } from "./legacy-content";
+import { warnCompatibility } from "./compat-warning";
 
 // Deprecated inbound shapes, retired from the 1.0 contract. Each entry here
 // has a row in the repo-root DEPRECATIONS.md — not this package's own
@@ -17,27 +18,79 @@ const THINKING_TEXT_MESSAGE_START = "THINKING_TEXT_MESSAGE_START";
 const THINKING_TEXT_MESSAGE_CONTENT = "THINKING_TEXT_MESSAGE_CONTENT";
 const THINKING_TEXT_MESSAGE_END = "THINKING_TEXT_MESSAGE_END";
 
-function warnCompatibility(what: string, replacement: string) {
-  if (
-    typeof process !== "undefined" &&
-    typeof process.env !== "undefined" &&
-    process.env.SUPPRESS_TRANSFORMATION_WARNINGS
-  )
-    return;
-  console.warn(
-    `[ag-ui][compat] Converting deprecated ${what} to ${replacement}. The old shape leaves the protocol after its shim window — see the repo-root DEPRECATIONS.md. Set SUPPRESS_TRANSFORMATION_WARNINGS=true to silence.`,
-  );
-}
-
 function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === "object" && value !== null && !Array.isArray(value);
 }
 
-function omitLegacyNull(value: unknown, field: string, context: string): unknown {
-  if (!isRecord(value) || value[field] !== null) return value;
-  warnCompatibility(`${context}.${field}: null`, "an absent field");
-  const { [field]: _null, ...rest } = value;
-  return rest;
+/**
+ * Every whole optional field the client reads as absent when a producer sends
+ * it as `null`, by where the field sits. This table is the complete list and
+ * drives every optional-null conversion below: a null in any other optional
+ * field stays for validation to reject, and nulls inside application data
+ * (state, metadata values, `rawEvent` and `result` contents, tool arguments)
+ * are never touched. Each entry has a row in the repo-root DEPRECATIONS.md.
+ *
+ * Only the named fields are read, so the per-event cost is a few property
+ * lookups; nothing walks the payload.
+ */
+const OPTIONAL_NULLS = {
+  /** On any event. */
+  event: ["rawEvent", "subagentRunId"],
+  /** On the event type of the same name. */
+  [EventType.RUN_STARTED]: ["parentRunId", "input"],
+  [EventType.RUN_FINISHED]: ["result", "outcome"],
+  [EventType.RUN_ERROR]: ["usage"],
+  [EventType.SUBAGENT_FINISHED]: ["result"],
+  [EventType.TOOL_CALL_START]: ["parentMessageId"],
+  [EventType.TOOL_CALL_CHUNK]: ["parentMessageId"],
+  [EventType.TOOL_CALL_RESULT]: ["role"],
+  "RUN_FINISHED.outcome": ["pendingToolCallIds"],
+  "RUN_FINISHED.usage[]": [
+    "provider",
+    "reasoningTokens",
+    "cachedInputTokens",
+    "cacheWriteInputTokens",
+  ],
+  /** Inside a RunAgentInput (here: RUN_STARTED.input). */
+  RunAgentInput: ["forwardedProps"],
+  Tool: ["parameters"],
+  ResumeEntry: ["payload"],
+  /** On an image, audio, video or document content part. */
+  "input content": ["metadata"],
+} as const satisfies Record<string, ReadonlyArray<string>>;
+
+/** The table's event-type rows, for the one lookup each event costs. */
+const EVENT_TYPE_OPTIONAL_NULLS: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
+  Object.entries(OPTIONAL_NULLS).filter(([location]) =>
+    (Object.values(EventType) as string[]).includes(location),
+  ),
+);
+
+/** Announces one converted null; `what` names the field and where it sat. */
+type NullNotice = (what: string) => void;
+
+const noticeEveryNull: NullNotice = (what) => warnCompatibility(what, "an absent field");
+
+/**
+ * `value` without those of `fields` that are `null`, announcing each one.
+ * `label` names the location (none for the fields allowed on any event).
+ * Returns `value` itself when nothing was null and never mutates it.
+ */
+function omitOptionalNulls<T>(
+  value: T,
+  fields: ReadonlyArray<string>,
+  label: string | undefined,
+  notice: NullNotice,
+): T {
+  if (!isRecord(value)) return value;
+  let rest: Record<string, unknown> | undefined;
+  for (const field of fields) {
+    if (value[field] !== null) continue;
+    notice(label === undefined ? `${field}: null` : `${label}.${field}: null`);
+    rest ??= { ...value };
+    delete rest[field];
+  }
+  return (rest ?? value) as T;
 }
 
 function mapProtocolArray(
@@ -53,15 +106,20 @@ function mapProtocolArray(
     : value;
 }
 
-function normalizeLegacyMessageNulls(message: unknown): unknown {
+function normalizeLegacyMessageNulls(message: unknown, notice: NullNotice): unknown {
   return mapProtocolArray(message, "content", (part) => {
     if (!isRecord(part)) return part;
     switch (part.type) {
       case "image":
       case "audio":
       case "video":
       case "document":
-        return omitLegacyNull(part, "metadata", `${part.type} input content`);
+        return omitOptionalNulls(
+          part,
+          OPTIONAL_NULLS["input content"],
+          `${part.type} input c
```

**File**: `sdks/typescript/packages/client/src/verify/__tests__/subagent-verify.test.ts` (modified, +56/-10)
```diff
@@ -1,3 +1,4 @@
+import { vi } from "vitest";
 import { from, firstValueFrom } from "rxjs";
 import { tap, toArray } from "rxjs/operators";
 import { verifyEvents } from "../verify";
@@ -1339,23 +1340,68 @@ describe("verifyEvents rejects null anywhere on the subagent surface", () => {
 
   const started = { type: EventType.RUN_STARTED, threadId: "t", runId: "r" } as RunStartedEvent;
 
-  // The zod schemas reject these on the wire; in-process producers bypass zod,
-  // and a null tag that slipped through persisted into message state and was
-  // re-serialized onto the next run's input. Same precedent as the lifecycle
-  // required-field checks.
-  it("rejects a null attribution tag on any event", async () => {
-    await expectRejectedWith(
-      [
+  // The one exception (PNI-573): an EVENT-level null tag is one of the
+  // tolerated optional nulls, so it reads as absent. It is removed rather than passed through, because a null tag that slipped
+  // through used to persist into message state and be re-serialized onto the
+  // next run's input. Nested tags (below) and lifecycle optionals stay fatal.
+  it("reads an event-level null attribution tag as absent and removes it", async () => {
+    vi.stubEnv("SUPPRESS_TRANSFORMATION_WARNINGS", "");
+    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
+    try {
+      const events = await run([
         started,
         {
           type: EventType.TEXT_MESSAGE_START,
           messageId: "m",
           role: "assistant",
           subagentRunId: null,
         } as unknown as BaseEvent,
-      ],
-      /'subagentRunId: null'.*omit it entirely/i,
-    );
+        {
+          type: EventType.TEXT_MESSAGE_END,
+          messageId: "m",
+          subagentRunId: null,
+        } as unknown as BaseEvent,
+      ]);
+      expect(events[1]).toEqual({
+        type: EventType.TEXT_MESSAGE_START,
+        messageId: "m",
+        role: "assistant",
+      });
+      expect(events[2]).toEqual({ type: EventType.TEXT_MESSAGE_END, messageId: "m" });
+      // Two events carry the null; the notice is given once per run.
+      expect(
+        warn.mock.calls.filter(([line]) => String(line).includes("subagentRunId: null")),
+      ).toHaveLength(1);
+    } finally {
+      warn.mockRestore();
+      vi.unstubAllEnvs();
+    }
+  });
+
+  it("treats a null tag on a continuation exactly like an absent one", async () => {
+    // An absent tag on a continuation claims no owner and is always allowed;
+    // the null now reads the same way, so the subagent's message closes.
+    vi.spyOn(console, "warn").mockImplementation(() => {});
+    try {
+      const events = await run([
+        started,
+        { type: EventType.SUBAGENT_STARTED, subagentRunId: "s1", name: "r" } as BaseEvent,
+        {
+          type: EventType.TEXT_MESSAGE_START,
+          messageId: "m",
+          role: "assistant",
+          subagentRunId: "s1",
+        } as BaseEvent,
+        {
+          type: EventType.TEXT_MESSAGE_END,
+          messageId: "m",
+          subagentRunId: null,
+        } as unknown as BaseEvent,
+      ]);
+      expect(events.at(-1)).toEqual({ type: EventType.TEXT_MESSAGE_END, messageId: "m" });
+    } finally {
+      vi.restoreAllMocks();
+    }
   });
 
   it("rejects a null tag nested in MESSAGES_SNAPSHOT and the RUN_STARTED input echo", async () => {
```

---

### Incident Patch 14: `b90fe60b` (2026-10-05)
**Commit Message**: refactor(client): fold the new optional nulls into the compatibility table (PNI-573)

The fields added in the previous commit were handled by a separate block.
They are now ordinary entries in one OPTIONAL_NULLS table (per location)
that drives every whole-optional-null conversion in the compatibility
boundary, old and new, through a single helper.

One warning policy for every tolerated optional null: once per field and
location per run, reset on each RUN_STARTED and each run() call. The
verifier's subagentRunId: null tolerance follows the same policy.

No framework-specific wording remains in code, tests or docs; the recorded
streams stay as neutral fixtures in
compatibility-boundary-optional-nulls.test.ts.

**File**: `DEPRECATIONS.md` (modified, +17/-19)
```diff
@@ -48,13 +48,16 @@ conversions.
 | `metadata: null` on a `document` content part                                               | omit the field                                                                                                            | inbound boundary (events)                                             | 2027-09-17 |
 | `parameters: null` on a tool                                                                | omit the field                                                                                                            | inbound boundary (events)                                             | 2027-09-17 |
 | `forwardedProps: null` on `RunAgentInput`                                                   | omit the field                                                                                                            | inbound boundary (events)                                             | 2027-09-17 |
-| `subagentRunId: null` on an event (MAF .NET 1.23)                                           | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
-| `parentRunId: null` on `RUN_STARTED` (MAF .NET 1.23)                                        | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
-| `input: null` on `RUN_STARTED` (MAF .NET 1.23)                                              | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
-| `role: null` on `TOOL_CALL_RESULT` (MAF .NET 1.23)                                          | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
-| `pendingToolCallIds: null` on `RUN_FINISHED.outcome` (MAF .NET 1.23)                        | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
-| `provider` / `reasoningTokens` / `cachedInputTokens` / `cacheWriteInputTokens: null` in `RUN_FINISHED.usage[]` (MAF .NET 1.23) | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
-| `usage: null` on `RUN_ERROR` (MAF .NET 1.23)                                                | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `subagentRunId: null` on an event                                                           | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `parentRunId: null` on `RUN_STARTED`                                                        | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `input: null` on `RUN_STARTED`                                                              | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `role: null` on `TOOL_CALL_RESULT`                                                          | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `pendingToolCallIds: null` on a `RUN_FINISHED` outcome                                      | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `provider: null` on a `RUN_FINISHED` usage entry                                            | omit the field                                                                                                            | inbound boundary                                                      | 2027-09-17 |
+| `reasoningTokens: null` on a `RUN
```

**File**: `docs/migrating-to-1-0.mdx` (modified, +12/-14)
```diff
@@ -51,22 +51,20 @@ Optional protocol fields must be absent instead of `null`, including `rawEvent`,
 inputs omit these fields before transmission. Emit the canonical shape from
 in-memory agents too.
 
-Older producers remain compatible where the previous SDK accepted a whole
-optional `null`. Before validation, the client translates it to an absent field
-and warns for `rawEvent`, `RUN_FINISHED.result`, `SUBAGENT_FINISHED.result`,
+Older producers remain compatible for a fixed set of whole optional `null`
+fields. Before validation, the client translates each to an absent field and
+warns once per field per run for `rawEvent` and `subagentRunId` on any event,
+`RUN_STARTED.parentRunId`, `RUN_STARTED.input`, `RUN_FINISHED.result`,
+`RUN_FINISHED.outcome.pendingToolCallIds`, `provider`, `reasoningTokens`,
+`cachedInputTokens` and `cacheWriteInputTokens` in `RUN_FINISHED.usage[]`,
+`RUN_ERROR.usage`, `SUBAGENT_FINISHED.result`, `TOOL_CALL_RESULT.role`,
 resume-entry `payload`, media-part `metadata` (`image`, `audio`, `video`,
 `document`), tool `parameters`, and `RunAgentInput.forwardedProps`. This applies
 to in-memory runs, reconnects, SSE, and protobuf, including messages and input
 echoes embedded in events. Subscribers receive the normalized event: for
-example, an old `RUN_FINISHED.result: null` becomes an absent result.
-
-The client also accepts these optional nulls: `subagentRunId` on any event,
-`RUN_STARTED.parentRunId` and `RUN_STARTED.input`, `TOOL_CALL_RESULT.role`,
-`RUN_FINISHED.outcome.pendingToolCallIds`, `provider`, `reasoningTokens`,
-`cachedInputTokens` and `cacheWriteInputTokens` in `RUN_FINISHED.usage[]`, and
-`RUN_ERROR.usage`. Each becomes an absent field, with one warning per field per
-run. This is client tolerance, not a protocol change: producers must still omit
-these fields, and direct schema validation still rejects them.
+example, an old `RUN_FINISHED.result: null` becomes an absent result. This is
+client tolerance, not a protocol change: producers must still omit these
+fields.
 
 Direct schema validation remains strict and does not invoke the client's event
 compatibility boundary. Request handlers accepting older `RunAgentInput` values
@@ -81,8 +79,8 @@ AG-UI does not expose a public request-normalization helper. The existing
 
 This compatibility is limited to the fields listed above. Event or message
 `metadata: null` remains invalid, as do other optional nulls such as
-`TEXT_MESSAGE_START.name`, `RUN_ERROR.code`, `usage[].model`, and a
-`subagentRunId: null` nested in a message. Required JSON payloads
+`TEXT_MESSAGE_START.name`, `RUN_ERROR.code`, `usage[].model`,
+`RunAgentInput.parentRunId`, and a `subagentRunId: null` nested in a message. Required JSON payloads
 such as `CUSTOM.value`, and null values inside state, metadata, or other
 application data, remain valid and are preserved.
 
```

**File**: `sdks/typescript/packages/client/src/enforce/__tests__/enforce.test.ts` (modified, +2/-2)
```diff
@@ -359,8 +359,8 @@ describe("expansion does not repair, whichever stage reaches it first", () => {
     await expect(without.runAgent()).rejects.toThrow();
   });
 
-  // A null subagentRunId is the one null that is NOT fatal here (PNI-573:
-  // Microsoft Agent Framework .NET writes it on every event). The inbound
+  // A null subagentRunId is the one null that is NOT fatal here: it is one of
+  // the tolerated optional nulls (PNI-573). The inbound
   // compatibility boundary reads it as absent before expansion on both paths,
   // so the outcome still does not depend on whether a middleware is installed.
   it("reads a null subagentRunId as absent, with or without a middleware", async () => {
```

**File**: `sdks/typescript/packages/client/src/middleware/__tests__/compatibility-boundary-null.test.ts` (modified, +59/-0)
```diff
@@ -139,6 +139,65 @@ const cases = [
     events: [start, snapshot({ metadata: null }, type), finish],
     expected: [start, snapshot({}, type), finish],
   })),
+  {
+    name: "subagentRunId on an event",
+    events: [start, { type: EventType.CUSTOM, name: "x", value: 1, subagentRunId: null }, finish],
+    expected: [start, { type: EventType.CUSTOM, name: "x", value: 1 }, finish],
+  },
+  {
+    name: "RUN_STARTED.parentRunId and RUN_STARTED.input",
+    events: [{ ...start, parentRunId: null, input: null }, finish],
+    expected: [start, finish],
+  },
+  {
+    name: "TOOL_CALL_RESULT.role",
+    events: [
+      start,
+      {
+        type: EventType.TOOL_CALL_RESULT,
+        messageId: "m",
+        toolCallId: "c",
+        content: "x",
+        role: null,
+      },
+      finish,
+    ],
+    expected: [
+      start,
+      { type: EventType.TOOL_CALL_RESULT, messageId: "m", toolCallId: "c", content: "x" },
+      finish,
+    ],
+  },
+  {
+    name: "RUN_FINISHED.outcome.pendingToolCallIds and RUN_FINISHED.usage[] fields",
+    events: [
+      start,
+      {
+        ...finish,
+        outcome: { type: "success", pendingToolCallIds: null },
+        usage: [
+          {
+            model: "m",
+            inputTokens: 1,
+            outputTokens: 1,
+            totalTokens: 2,
+            provider: null,
+            reasoningTokens: null,
+            cachedInputTokens: null,
+            cacheWriteInputTokens: null,
+          },
+        ],
+      },
+    ],
+    expected: [
+      start,
+      {
+        ...finish,
+        outcome: { type: "success" },
+        usage: [{ model: "m", inputTokens: 1, outputTokens: 1, totalTokens: 2 }],
+      },
+    ],
+  },
   {
     name: "media metadata inside RUN_STARTED.input",
     events: [inputEvent({ messages: snapshot({ metadata: null }, "image").messages }), finish],
```

**File**: `sdks/typescript/packages/client/src/middleware/__tests__/compatibility-boundary-optional-nulls.test.ts` (renamed, +105/-46)
```diff
@@ -4,15 +4,13 @@ import { EventType, type BaseEvent, type Message } from "@ag-ui/core";
 import { EventSchema } from "@ag-ui/core/schemas";
 import { AbstractAgent, HttpAgent } from "@/agent";
 
-// PNI-573. Microsoft Agent Framework .NET 1.23 with the published
-// AGUI.Abstractions 1.0.0 serializes AG-UI events through host-owned JSON
-// options, so every unset optional field goes out as an explicit null. These
-// are its real SSE streams, captured from the Dojo server on #2913 (MAF 1.23,
-// net10.0, Program.cs workaround removed) against aimock. Each rawEvent is the
-// real one cut down to a few top-level keys; its nulls are opaque provider data
-// and must survive.
+// The tolerated optional nulls (PNI-573), end to end. The fixtures below are
+// recorded producer streams: real SSE from a producer that writes every unset
+// optional field as an explicit null. Each rawEvent is the recorded one cut
+// down to a few top-level keys; its nulls are opaque provider data and must
+// survive.
 
-// POST /agentic_chat "Hi, I am duaa" (the BEFORE output of #2955).
+// Recorded agentic chat: "Hi, I am duaa".
 const AGENTIC_CHAT = [
   `{"type":"RUN_STARTED","threadId":"t1","runId":"r1","parentRunId":null,"input":null}`,
   `{"type":"TEXT_MESSAGE_START","subagentRunId":null,"messageId":"chatcmpl-sZwVO-ktzIGDEfy3","role":"assistant","name":"AgenticChat","rawEvent":{"authorName":"AgenticChat","role":"assistant","conversationId":null,"additionalProperties":null}}`,
@@ -22,7 +20,7 @@ const AGENTIC_CHAT = [
   `{"type":"RUN_FINISHED","threadId":"t1","runId":"r1","result":null,"outcome":{"type":"success","pendingToolCallIds":null},"usage":[{"provider":null,"model":"gpt-4o","inputTokens":4,"outputTokens":10,"totalTokens":14,"reasoningTokens":null,"cachedInputTokens":null,"cacheWriteInputTokens":null}]}`,
 ];
 
-// POST /backend_tool_rendering "Weather in San Francisco": adds TOOL_CALL_RESULT.role.
+// Recorded backend tool call, "Weather in San Francisco": adds TOOL_CALL_RESULT.role.
 const BACKEND_TOOL = [
   `{"type":"RUN_STARTED","threadId":"t1","runId":"r1","parentRunId":null,"input":null}`,
   `{"type":"TOOL_CALL_START","subagentRunId":null,"toolCallId":"call_get_weather_1","toolCallName":"get_weather","parentMessageId":"chatcmpl-0-gVLlBKHQ9dkxwa","rawEvent":{"authorName":"BackendToolRenderer","role":"assistant","conversationId":null,"additionalProperties":null}}`,
@@ -36,22 +34,22 @@ const BACKEND_TOOL = [
   `{"type":"RUN_FINISHED","threadId":"t1","runId":"r1","result":null,"outcome":{"type":"success","pendingToolCallIds":null},"usage":[{"provider":null,"model":"gpt-4o","inputTokens":39,"outputTokens":19,"totalTokens":58,"reasoningTokens":null,"cachedInputTokens":null,"cacheWriteInputTokens":null}]}`,
 ];
 
-// Any endpoint with the model provider unreachable: RUN_ERROR.usage.
+// Recorded run with the model provider unreachable: RUN_ERROR.usage.
 const RUN_ERROR = [
   `{"type":"RUN_ERROR","message":"An error occurred while streaming the agent response.","code":"StreamingError","usage":null}`,
 ];
 
-const MAF_RAW_EVENT = { conversationId: null, additionalProperties: null };
+const RECORDED_RAW_EVENT = { conversationId: null, additionalProperties: null };
 
 const sse = (lines: string[]) =>
   new Response(lines.map((line) => `data: ${line}\n\n`).join(""), {
     headers: { "Content-Type": "text/event-stream" },
   });
 
-function mafAgent(lines: string[]) {
+function sseAgent(lines: string[]) {
   return new HttpAgent({
     threadId: "t1",
-    url: "https://maf.example.test/agentic_chat",
+    url: "https://producer.example.test/agent",
     fetch: async () => sse(lines),
   });
 }
@@ -82,8 +80,8 @@ async function runCollecting(agent: AbstractAgent, path: "run" | "connect" = "ru
   return { seen, result };
 }
 
-/** Every forgiven field must be absent (not null, not undefined-valued). */
-function expectNoForgivenNulls(events: BaseEvent[]) {
+/** Every tolerated field must be absent (not null, not undefined-valued). */
+function expectNoToleratedNulls(events: BaseEvent[]) {
   for (const event of events) {
     const record = event as Record<string, unknown>;
     expect(record).not.toHaveProperty("subagentRunId");
@@ -108,6 +106,13 @@ function expectNoForgivenNulls(events: BaseEvent[]) {
 
 const warnings = () => vi.mocked(console.warn).mock.calls.map((call) => String(call[0]));
 
+/** The `what` of every optional-null notice logged so far, in order. */
+const convertedNulls = () =>
+  warnings().flatMap((line) => {
+    const match = /deprecated (.*: null) to an absent field/.exec(line);
+    return match ? [match[1]] : [];
+  });
+
 beforeEach(() => {
   vi.stubEnv("SUPPRESS_TRANSFORMATION_WARNINGS", "");
   vi.spyOn(console, "warn").mockImplementation(() => {});
@@ -118,9 +123,9 @@ afterEach(() => {
   vi.unstubAllEnvs();
 });
 
-describe("Microsoft Agent Framework .NET 1.23 streams through HttpAgent", () => {
+describe("recorded producer streams through HttpAgent", () => {
   it("completes agentic 
```

**File**: `sdks/typescript/packages/client/src/middleware/compatibility-boundary.ts` (modified, +130/-143)
```diff
@@ -22,11 +22,75 @@ function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === "object" && value !== null && !Array.isArray(value);
 }
 
-function omitLegacyNull(value: unknown, field: string, context: string): unknown {
-  if (!isRecord(value) || value[field] !== null) return value;
-  warnCompatibility(`${context}.${field}: null`, "an absent field");
-  const { [field]: _null, ...rest } = value;
-  return rest;
+/**
+ * Every whole optional field the client reads as absent when a producer sends
+ * it as `null`, by where the field sits. This table is the complete list and
+ * drives every optional-null conversion below: a null in any other optional
+ * field stays for validation to reject, and nulls inside application data
+ * (state, metadata values, `rawEvent` and `result` contents, tool arguments)
+ * are never touched. Each entry has a row in the repo-root DEPRECATIONS.md.
+ *
+ * Only the named fields are read, so the per-event cost is a few property
+ * lookups; nothing walks the payload.
+ */
+const OPTIONAL_NULLS = {
+  /** On any event. */
+  event: ["rawEvent", "subagentRunId"],
+  /** On the event type of the same name. */
+  [EventType.RUN_STARTED]: ["parentRunId", "input"],
+  [EventType.RUN_FINISHED]: ["result", "outcome"],
+  [EventType.RUN_ERROR]: ["usage"],
+  [EventType.SUBAGENT_FINISHED]: ["result"],
+  [EventType.TOOL_CALL_START]: ["parentMessageId"],
+  [EventType.TOOL_CALL_CHUNK]: ["parentMessageId"],
+  [EventType.TOOL_CALL_RESULT]: ["role"],
+  "RUN_FINISHED.outcome": ["pendingToolCallIds"],
+  "RUN_FINISHED.usage[]": [
+    "provider",
+    "reasoningTokens",
+    "cachedInputTokens",
+    "cacheWriteInputTokens",
+  ],
+  /** Inside a RunAgentInput (here: RUN_STARTED.input). */
+  RunAgentInput: ["forwardedProps"],
+  Tool: ["parameters"],
+  ResumeEntry: ["payload"],
+  /** On an image, audio, video or document content part. */
+  "input content": ["metadata"],
+} as const satisfies Record<string, ReadonlyArray<string>>;
+
+/** The table's event-type rows, for the one lookup each event costs. */
+const EVENT_TYPE_OPTIONAL_NULLS: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
+  Object.entries(OPTIONAL_NULLS).filter(([location]) =>
+    (Object.values(EventType) as string[]).includes(location),
+  ),
+);
+
+/** Announces one converted null; `what` names the field and where it sat. */
+type NullNotice = (what: string) => void;
+
+const noticeEveryNull: NullNotice = (what) => warnCompatibility(what, "an absent field");
+
+/**
+ * `value` without those of `fields` that are `null`, announcing each one.
+ * `label` names the location (none for the fields allowed on any event).
+ * Returns `value` itself when nothing was null and never mutates it.
+ */
+function omitOptionalNulls<T>(
+  value: T,
+  fields: ReadonlyArray<string>,
+  label: string | undefined,
+  notice: NullNotice,
+): T {
+  if (!isRecord(value)) return value;
+  let rest: Record<string, unknown> | undefined;
+  for (const field of fields) {
+    if (value[field] !== null) continue;
+    notice(label === undefined ? `${field}: null` : `${label}.${field}: null`);
+    rest ??= { ...value };
+    delete rest[field];
+  }
+  return (rest ?? value) as T;
 }
 
 function mapProtocolArray(
@@ -42,66 +106,50 @@ function mapProtocolArray(
     : value;
 }
 
-function normalizeLegacyMessageNulls(message: unknown): unknown {
+function normalizeLegacyMessageNulls(message: unknown, notice: NullNotice): unknown {
   return mapProtocolArray(message, "content", (part) => {
     if (!isRecord(part)) return part;
     switch (part.type) {
       case "image":
       case "audio":
       case "video":
       case "document":
-        return omitLegacyNull(part, "metadata", `${part.type} input content`);
+        return omitOptionalNulls(
+          part,
+          OPTIONAL_NULLS["input content"],
+          `${part.type} input content`,
+          notice,
+        );
       default:
         return part;
     }
   });
 }
 
-/**
- * The `TokenUsage` fields Microsoft Agent Framework .NET 1.23 (with
- * AGUI.Abstractions 1.0.0) writes as `null` when unset (PNI-573). Exactly
- * these: other usage nulls, `model` and the counters included, stay invalid.
- */
-const MAF_NULL_USAGE_FIELDS = [
-  "provider",
-  "reasoningTokens",
-  "cachedInputTokens",
-  "cacheWriteInputTokens",
-] as const;
-
-function hasNullField(value: unknown, fields: ReadonlyArray<string>): boolean {
-  if (!isRecord(value)) return false;
-  for (const field of fields) if (value[field] === null) return true;
-  return false;
-}
-
-/** A copy of `value` without the listed fields that are `null`. */
-function withoutNullFields(
-  value: Record<string, unknown>,
-  fields: ReadonlyArray<string>,
-): Record<string, unknown> {
-  const rest = { ...value };
-  for (const field of fields) if (rest[field] === null) delete rest[field];
-  return rest;
-}
-
 /**
  * Normalize only whole optional nulls accepted by pre-1.0 request pars
```

**File**: `sdks/typescript/packages/client/src/verify/__tests__/subagent-verify.test.ts` (modified, +6/-6)
```diff
@@ -1340,9 +1340,8 @@ describe("verifyEvents rejects null anywhere on the subagent surface", () => {
 
   const started = { type: EventType.RUN_STARTED, threadId: "t", runId: "r" } as RunStartedEvent;
 
-  // The one exception (PNI-573): an EVENT-level null tag is what Microsoft
-  // Agent Framework .NET writes on every event, so it reads as absent. It is
-  // removed rather than passed through, because a null tag that slipped
+  // The one exception (PNI-573): an EVENT-level null tag is one of the
+  // tolerated optional nulls, so it reads as absent. It is removed rather than passed through, because a null tag that slipped
   // through used to persist into message state and be re-serialized onto the
   // next run's input. Nested tags (below) and lifecycle optionals stay fatal.
   it("reads an event-level null attribution tag as absent and removes it", async () => {
@@ -1369,9 +1368,10 @@ describe("verifyEvents rejects null anywhere on the subagent surface", () => {
         role: "assistant",
       });
       expect(events[2]).toEqual({ type: EventType.TEXT_MESSAGE_END, messageId: "m" });
-      expect(warn).toHaveBeenCalledWith(
-        expect.stringContaining("TEXT_MESSAGE_START.subagentRunId: null"),
-      );
+      // Two events carry the null; the notice is given once per run.
+      expect(
+        warn.mock.calls.filter(([line]) => String(line).includes("subagentRunId: null")),
+      ).toHaveLength(1);
     } finally {
       warn.mockRestore();
       vi.unstubAllEnvs();
```

**File**: `sdks/typescript/packages/client/src/verify/verify.ts` (modified, +16/-10)
```diff
@@ -102,9 +102,13 @@ export const verifyEvents =
     // valid. Cleared per run, like every other map here.
     const closedSubagents = new Set<string>();
     let runStarted = false; // Track if a run has started
+    // The tolerated `subagentRunId: null` warns once per run, the same policy the
+    // compatibility boundary applies to every optional null it converts.
+    let nullSubagentRunIdNoticed = false;
 
     // Function to reset state for a new run
     const resetRunState = () => {
+      nullSubagentRunIdNoticed = false;
       activeMessages.clear();
       activeToolCalls.clear();
       activeReasoningSpans.clear();
@@ -270,17 +274,19 @@ export const verifyEvents =
           }
         }
 
-        // An event-level `subagentRunId: null` is read as absent (PNI-573):
-        // Microsoft Agent Framework .NET writes it on every event today. The
-        // compatibility boundary already drops it on the agent pipelines; this
-        // gives the same tolerance to anything that hands events straight to
-        // the verifier. The null is REMOVED, not just accepted, so it cannot
-        // persist into message state and be re-serialized onto the next run's
-        // input. Everything else on the subagent surface stays strict (PNI-199):
-        // the lifecycle optionals below, and nested tags on messages and
-        // interrupts.
+        // An event-level `subagentRunId: null` is read as absent: it is one of
+        // the optional nulls the compatibility boundary converts on the agent
+        // pipelines, and this gives the same tolerance to anything that hands
+        // events straight to the verifier. The null is REMOVED, not just
+        // accepted, so it cannot persist into message state and be
+        // re-serialized onto the next run's input. Everything else on the
+        // subagent surface stays strict (PNI-199): the lifecycle optionals
+        // below, and nested tags on messages and interrupts.
         if ((event as { subagentRunId?: unknown }).subagentRunId === null) {
-          warnCompatibility(`${eventType}.subagentRunId: null`, "an absent field");
+          if (!nullSubagentRunIdNoticed) {
+            nullSubagentRunIdNoticed = true;
+            warnCompatibility("subagentRunId: null", "an absent field");
+          }
           const { subagentRunId: _null, ...rest } = event as BaseEvent & {
             subagentRunId?: unknown;
           };
```

---

### Incident Patch 15: `52fd82c4` (2026-10-05)
**Commit Message**: docs: drop the framework name from the null-tolerance note

**File**: `docs/migrating-to-1-0.mdx` (modified, +1/-2)
```diff
@@ -60,8 +60,7 @@ to in-memory runs, reconnects, SSE, and protobuf, including messages and input
 echoes embedded in events. Subscribers receive the normalized event: for
 example, an old `RUN_FINISHED.result: null` becomes an absent result.
 
-The client also accepts the optional nulls that Microsoft Agent Framework .NET
-1.23 writes today with `AGUI.Abstractions` 1.0.0: `subagentRunId` on any event,
+The client also accepts these optional nulls: `subagentRunId` on any event,
 `RUN_STARTED.parentRunId` and `RUN_STARTED.input`, `TOOL_CALL_RESULT.role`,
 `RUN_FINISHED.outcome.pendingToolCallIds`, `provider`, `reasoningTokens`,
 `cachedInputTokens` and `cacheWriteInputTokens` in `RUN_FINISHED.usage[]`, and
```

#### Recent Merged Pull Requests:
- **PR #2962** (2026-10-05): release: integration-antigravity-py (@ag-ui-devops-bot[bot])
- **PR #2961** (2026-10-05): fix(langgraph): name the owning assistant message as a non-streamed tool call's parent (@mxmzb)
- **PR #2960** (2026-10-05): feat(antigravity): bound runaway turns with max_tool_calls_per_turn (@mme)
- **PR #2959** (2026-10-05): release: sdk-ts (@ag-ui-devops-bot[bot])
- **PR #2958** (2026-10-05): PNI-515 (MAF .NET: emit state events in the state demos on MAF 1.23) (@mme)
- **PR #2957** (2026-10-05): PNI-573 (TS client: tolerate more optional nulls in the compatibility boundary) (@mme)
- **PR #2954** (2026-10-05): chore(deps): update github actions (@renovate[bot])
- **PR #2945** (2026-10-05): fix(a2ui): recover unanswered calls before native continuation (@ranst91)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
