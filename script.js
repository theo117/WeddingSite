const WEDDING_DATE = new Date("2026-03-19T15:00:00+02:00").getTime();
const COUPLE_WHATSAPP = "27700000000"; // Replace with your number in international format, no +.
const RSVP_API_URL = "http://localhost:3000/api/rsvp";

function updateCountdown() {
  const now = Date.now();
  const distance = WEDDING_DATE - now;

  const daysEl = document.getElementById("days");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
    return;
  }

  if (distance <= 0) {
    daysEl.textContent = "0";
    hoursEl.textContent = "0";
    minutesEl.textContent = "0";
    secondsEl.textContent = "0";
    return;
  }

  const dayMs = 1000 * 60 * 60 * 24;
  const hourMs = 1000 * 60 * 60;
  const minuteMs = 1000 * 60;

  const days = Math.floor(distance / dayMs);
  const hours = Math.floor((distance % dayMs) / hourMs);
  const minutes = Math.floor((distance % hourMs) / minuteMs);
  const seconds = Math.floor((distance % minuteMs) / 1000);

  daysEl.textContent = String(days);
  hoursEl.textContent = String(hours).padStart(2, "0");
  minutesEl.textContent = String(minutes).padStart(2, "0");
  secondsEl.textContent = String(seconds).padStart(2, "0");
}

function setupReveals() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!revealItems.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function setupRsvpForm() {
  const form = document.getElementById("rsvpForm");
  const status = document.getElementById("formStatus");
  if (!form || !status) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    if (!form.checkValidity()) {
      status.textContent = "Please complete all required fields.";
      status.classList.add("error");
      form.reportValidity();
      return;
    }

    const submitButton = form.querySelector("button[type='submit']");
    const formData = {
      name: document.getElementById("name")?.value.trim() || "",
      phone: document.getElementById("phone")?.value.trim() || "",
      attendance: document.getElementById("attendance")?.value || "",
      guests: document.getElementById("guests")?.value || "1",
      message: document.getElementById("message")?.value.trim() || ""
    };
    formData.phone = formData.phone.replace(/\s+/g, "");

    if (!/^\+[1-9]\d{9,14}$/.test(formData.phone)) {
      status.textContent = "Enter a valid phone in international format, e.g. +27731234567.";
      status.classList.add("error");
      return;
    }

    const attendanceLabel = formData.attendance === "yes" ? "Yes, attending" : "No, not attending";
    const fallbackLines = [
      "Wedding RSVP",
      `Name: ${formData.name}`,
      `Phone: ${formData.phone}`,
      `Attendance: ${attendanceLabel}`,
      `Guests: ${formData.guests}`
    ];
    if (formData.message) {
      fallbackLines.push(`Message: ${formData.message}`);
    }
    const fallbackWhatsApp = `https://wa.me/${COUPLE_WHATSAPP}?text=${encodeURIComponent(
      fallbackLines.join("\n")
    )}`;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    try {
      const response = await fetch(RSVP_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "Could not submit RSVP.");
      }

      if (result.whatsappSent) {
        status.textContent = "Thank you. RSVP saved and WhatsApp confirmation sent.";
      } else {
        const detail = result.whatsappError ? ` Details: ${result.whatsappError}` : "";
        status.textContent = `Thank you. RSVP saved, but WhatsApp was not sent.${detail}`;
      }
      status.classList.add("success");

      form.reset();
      const guestsInput = document.getElementById("guests");
      if (guestsInput) {
        guestsInput.value = "1";
      }
    } catch (error) {
      status.textContent =
        "Server is unavailable. WhatsApp was opened so you can still submit manually.";
      window.open(fallbackWhatsApp, "_blank", "noopener");
      status.classList.add("error");
      console.error(error);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Send RSVP";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateCountdown();
  setInterval(updateCountdown, 1000);
  setupReveals();
  setupRsvpForm();
});
