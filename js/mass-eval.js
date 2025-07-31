class MassEvaluator {
  constructor() {
    this.apiKey = "";
    this.selectedModel = "";
    this.isLoading = false;

    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    this.modelSelect = document.getElementById("model-select");
    this.systemPromptInput = document.getElementById("system-prompt");
    this.promptInput = document.getElementById("prompt-input");
    this.contentInput = document.getElementById("content-input");
    this.evaluateBtn = document.getElementById("evaluate-btn");
    this.responseDisplay = document.getElementById("response-display");
    this.saveSystemPromptBtn = document.getElementById("save-system-prompt");
    this.discardSystemPromptBtn = document.getElementById(
      "discard-system-prompt"
    );
  }

  bindEvents() {
    this.evaluateBtn.addEventListener("click", () => this.evaluateContent());
    this.modelSelect.addEventListener("change", () => this.saveStoredData());
    this.systemPromptInput.addEventListener("input", () =>
      this.onSystemPromptChange()
    );
    this.promptInput.addEventListener("input", () => this.saveStoredData());
    this.saveSystemPromptBtn.addEventListener("click", () =>
      this.saveSystemPrompt()
    );
    this.discardSystemPromptBtn.addEventListener("click", () =>
      this.discardSystemPrompt()
    );
  }

  async loadStoredData() {
    // Load model and prompt from localStorage
    const storedModel = localStorage.getItem("mass-eval-model");
    const storedPrompt = localStorage.getItem("mass-eval-prompt");

    if (storedModel) {
      this.modelSelect.value = storedModel;
      this.selectedModel = storedModel;
    }

    if (storedPrompt) {
      this.promptInput.value = storedPrompt;
    }

    // Load system prompt from file
    await this.loadSystemPrompt();
  }

  saveStoredData() {
    // Save model and prompt to localStorage
    localStorage.setItem("mass-eval-model", this.modelSelect.value);
    localStorage.setItem("mass-eval-prompt", this.promptInput.value);
  }

  async loadSystemPrompt() {
    try {
      const response = await fetch("/api/system-prompt");
      if (response.ok) {
        const data = await response.json();
        const systemPrompt = data.systemPrompt || "";
        this.systemPromptInput.value = systemPrompt;
        this.savedSystemPrompt = systemPrompt;
        this.updateSystemPromptButtons();
      } else {
        console.error(
          "Failed to load system prompt:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error loading system prompt:", error);
    }
  }

  onSystemPromptChange() {
    this.updateSystemPromptButtons();
  }

  updateSystemPromptButtons() {
    const hasChanges = this.systemPromptInput.value !== this.savedSystemPrompt;
    this.saveSystemPromptBtn.disabled = !hasChanges;
    this.discardSystemPromptBtn.disabled = !hasChanges;
  }

  async saveSystemPrompt() {
    try {
      const response = await fetch("/api/system-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: this.systemPromptInput.value,
        }),
      });

      if (response.ok) {
        this.savedSystemPrompt = this.systemPromptInput.value;
        this.updateSystemPromptButtons();
        this.showSuccess("System prompt saved successfully!");
      } else {
        console.error("Failed to save system prompt");
        this.showError("Failed to save system prompt");
      }
    } catch (error) {
      console.error("Error saving system prompt:", error);
      this.showError("Error saving system prompt");
    }
  }

  async discardSystemPrompt() {
    this.systemPromptInput.value = this.savedSystemPrompt;
    this.updateSystemPromptButtons();
  }

  async evaluateContent() {
    if (this.isLoading) return;

    const model = this.modelSelect.value;
    const prompt = this.promptInput.value.trim();
    const content = this.contentInput.value.trim();

    // Validation
    if (!model) {
      this.showError("Please select a model");
      return;
    }

    if (!prompt) {
      this.showError("Please enter a prompt");
      return;
    }

    if (!content) {
      this.showError("Please enter content to evaluate");
      return;
    }

    this.setLoading(true);

    try {
      const response = await this.callAPI(model, prompt, content);
      this.displayResponse(response);
    } catch (error) {
      console.error("Evaluation error:", error);
      this.showError(`Error: ${error.message}`);
    } finally {
      this.setLoading(false);
    }
  }

  async callAPI(model, prompt, content) {
    const systemPrompt = this.systemPromptInput.value.trim();
    const fullPrompt = `${prompt}\n\nContent to evaluate:\n${content}`;

    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        systemPrompt: systemPrompt,
        prompt: fullPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullResponse += chunk;

        // Update the display in real-time
        this.displayStreamingResponse(fullResponse);
      }
    } finally {
      reader.releaseLock();
    }

    return fullResponse;
  }

  displayStreamingResponse(response) {
    this.responseDisplay.innerHTML = `
      <div class="success">
        <strong>Evaluating...</strong>
      </div>
      <div class="response-content">
        ${this.escapeHtml(response)}
      </div>
    `;
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.evaluateBtn.disabled = loading;

    if (loading) {
      this.evaluateBtn.textContent = "Evaluating...";
      this.showLoading();
    } else {
      this.evaluateBtn.textContent = "Evaluate Content";
    }
  }

  showLoading() {
    this.responseDisplay.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <span>Evaluating content...</span>
      </div>
    `;
  }

  displayResponse(response) {
    this.responseDisplay.innerHTML = `
      <div class="success">
        <strong>Evaluation Complete!</strong>
      </div>
      <div class="response-content">
        ${this.escapeHtml(response)}
      </div>
    `;
  }

  showError(message) {
    this.responseDisplay.innerHTML = `
      <div class="error">
        <strong>Error:</strong> ${this.escapeHtml(message)}
      </div>
    `;
  }

  showSuccess(message) {
    this.responseDisplay.innerHTML = `
      <div class="success">
        <strong>Success:</strong> ${this.escapeHtml(message)}
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the evaluator when the page loads
document.addEventListener("DOMContentLoaded", async () => {
  const evaluator = new MassEvaluator();
  await evaluator.loadStoredData();
});
