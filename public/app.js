const form = document.querySelector("#contact-form");
const statusMessage = document.querySelector("#status-message");
const submitButton = document.querySelector(".submit-button");
const buttonLabel = document.querySelector(".button-label");
const messageInput = document.querySelector('textarea[name="message"]');
const characterCount = document.querySelector("#character-count");

const setStatus = (message, type = "") => {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
};

const setLoading = (isLoading) => {
  submitButton.disabled = isLoading;
  submitButton.dataset.loading = String(isLoading);
  buttonLabel.textContent = isLoading ? "Sending..." : "Send message";
};

const updateCharacterCount = () => {
  characterCount.textContent = `${messageInput.value.length} / 3000`;
};

messageInput.addEventListener("input", updateCharacterCount);
updateCharacterCount();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const formData = new FormData(form);
  const payload = {
    project: String(formData.get("project") || "").trim(),
    reason: String(formData.get("reason") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    website: String(formData.get("website") || "").trim(),
  };

  if (!payload.project || !payload.reason || !payload.message) {
    setStatus("Project, reason, and message are required.", "error");
    return;
  }

  if (payload.message.length > 3000) {
    setStatus("Message must be 3000 characters or fewer.", "error");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Message could not be sent.");
    }

    form.reset();
    updateCharacterCount();
    setStatus("Message sent. I will reply manually if a reply address was provided.", "success");
  } catch (error) {
    setStatus(error.message || "Message could not be sent. Please try again.", "error");
  } finally {
    setLoading(false);
  }
});
