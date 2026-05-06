const form = document.querySelector("#contact-form");

if (form) {
  const statusMessage = document.querySelector("#status-message");
  const submitButton = document.querySelector(".submit-button");
  const buttonLabel = document.querySelector(".button-label");
  const characterCount = document.querySelector("#character-count");
  const reasonGuidance = document.querySelector("#reason-guidance");
  const projectInput = document.querySelector("#project");
  const reasonInput = document.querySelector("#reason");
  const emailInput = document.querySelector("#email");
  const messageInput = document.querySelector("#message");
  const fields = {
    project: {
      input: projectInput,
      error: document.querySelector("#project-error"),
    },
    reason: {
      input: reasonInput,
      error: document.querySelector("#reason-error"),
    },
    email: {
      input: emailInput,
      error: document.querySelector("#email-error"),
    },
    message: {
      input: messageInput,
      error: document.querySelector("#message-error"),
    },
  };

  const reasonGuidanceMap = {
    "Security issue": "Security reports are reviewed manually. Share impact, affected URLs, and steps to reproduce, but do not include passwords, tokens, or private keys.",
    "Abuse report": "Abuse reports are reviewed manually. Include relevant usernames, links, timestamps, and a short description of the impact.",
  };

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  const setStatus = (message, type = "") => {
    statusMessage.textContent = message;
    statusMessage.dataset.type = type;
  };

  const setLoading = (isLoading) => {
    submitButton.disabled = isLoading;
    submitButton.dataset.loading = String(isLoading);
    buttonLabel.textContent = isLoading ? "Sending..." : "Send message";
  };

  const setFieldError = (name, message) => {
    const field = fields[name];

    if (!field) {
      return;
    }

    field.error.textContent = message;
    field.input.setAttribute("aria-invalid", message ? "true" : "false");
  };

  const clearFieldError = (name) => {
    setFieldError(name, "");
  };

  const updateCharacterCount = () => {
    characterCount.textContent = `${messageInput.value.length} / 3000`;
  };

  const updateReasonGuidance = () => {
    const guidance = reasonGuidanceMap[reasonInput.value];

    if (!guidance) {
      reasonGuidance.hidden = true;
      reasonGuidance.textContent = "";
      return;
    }

    reasonGuidance.hidden = false;
    reasonGuidance.textContent = guidance;
  };

  const normalizePayload = () => {
    const formData = new FormData(form);

    return {
      project: String(formData.get("project") || "").trim(),
      reason: String(formData.get("reason") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim(),
    };
  };

  const validatePayload = (payload) => {
    const errors = {};

    if (!payload.project) {
      errors.project = "Choose the project that best matches your message.";
    }

    if (!payload.reason) {
      errors.reason = "Choose the reason for contacting Continental.";
    }

    if (payload.email && (payload.email.length > 254 || !emailPattern.test(payload.email))) {
      errors.email = "Enter a valid email address or leave the field blank.";
    }

    if (!payload.message) {
      errors.message = "Enter a message before sending.";
    } else if (payload.message.length > 3000) {
      errors.message = "Message must be 3000 characters or fewer.";
    }

    return errors;
  };

  const renderErrors = (errors) => {
    Object.keys(fields).forEach((name) => {
      setFieldError(name, errors[name] || "");
    });
  };

  const focusFirstInvalidField = (errors) => {
    const firstInvalidName = Object.keys(fields).find((name) => Boolean(errors[name]));

    if (firstInvalidName) {
      fields[firstInvalidName].input.focus();
    }
  };

  const applyReasonPrefill = (reason) => {
    if (!reason) {
      return;
    }

    const matchingOption = Array.from(reasonInput.options).find((option) => option.value === reason);

    if (!matchingOption) {
      return;
    }

    reasonInput.value = reason;
    clearFieldError("reason");
    updateReasonGuidance();
    messageInput.focus();
    setStatus(`Reason set to ${reason}.`, "success");
  };

  const prefillFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");

    if (reason) {
      applyReasonPrefill(reason);
    }
  };

  Object.entries(fields).forEach(([name, field]) => {
    const eventName = field.input.tagName === "SELECT" ? "change" : "input";

    field.input.addEventListener(eventName, () => {
      clearFieldError(name);

      if (name === "message") {
        updateCharacterCount();
      }

      if (name === "reason") {
        updateReasonGuidance();
      }
    });

    field.input.addEventListener("blur", () => {
      const payload = normalizePayload();
      const errors = validatePayload(payload);
      setFieldError(name, errors[name] || "");
    });
  });

  updateCharacterCount();
  updateReasonGuidance();
  prefillFromUrl();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const payload = normalizePayload();
    const errors = validatePayload(payload);

    renderErrors(errors);

    if (Object.keys(errors).length > 0) {
      setStatus("Fix the highlighted fields and try again.", "error");
      focusFirstInvalidField(errors);
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
      const requestId = result.requestId || response.headers.get("x-request-id") || "";

      if (!response.ok) {
        const error = new Error(result.error || "Message could not be sent.");
        error.requestId = requestId;
        throw error;
      }

      form.reset();
      renderErrors({});
      updateCharacterCount();
      updateReasonGuidance();

      setStatus(
        requestId
          ? `Message sent. A manual follow-up is possible only if you provided an email address. Reference ID: ${requestId}`
          : "Message sent. A manual follow-up is possible only if you provided an email address.",
        "success"
      );
    } catch (error) {
      const reference = error.requestId ? ` Reference ID: ${error.requestId}` : "";
      setStatus(`${error.message || "Message could not be sent. Please try again."}${reference}`, "error");
    } finally {
      setLoading(false);
    }
  });
}
