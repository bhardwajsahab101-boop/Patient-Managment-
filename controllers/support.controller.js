import Support from "../models/Support.js";

const SUPPORT_WHATSAPP_NUMBER = "918950817515";

export async function getSupportPage(req, res) {
  try {
    // Fetch user's past support messages
    const pastMessages = await Support.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.render("support", {
      title: "Support",
      supportNumber: SUPPORT_WHATSAPP_NUMBER,
      pastMessages,
      success: req.session?.supportSuccess || null,
    });

    // Clear success message after displaying
    if (req.session) {
      delete req.session.supportSuccess;
    }
  } catch (err) {
    console.error("Support page error:", err);
    res.status(500).render("error", {
      err: { message: "Unable to load support page" },
    });
  }
}

export async function postSupportMessage(req, res) {
  try {
    const { subject, message } = req.body;

    // Validation
    if (!subject || !subject.trim() || !message || !message.trim()) {
      return res.status(400).render("support", {
        title: "Support",
        supportNumber: SUPPORT_WHATSAPP_NUMBER,
        pastMessages: [],
        error: "Subject and message are required.",
        formData: { subject, message },
      });
    }

    if (subject.trim().length > 200) {
      return res.status(400).render("support", {
        title: "Support",
        supportNumber: SUPPORT_WHATSAPP_NUMBER,
        pastMessages: [],
        error: "Subject must be under 200 characters.",
        formData: { subject, message },
      });
    }

    if (message.trim().length > 2000) {
      return res.status(400).render("support", {
        title: "Support",
        supportNumber: SUPPORT_WHATSAPP_NUMBER,
        pastMessages: [],
        error: "Message must be under 2000 characters.",
        formData: { subject, message },
      });
    }

    // Save to DB
    await Support.create({
      userId: req.user._id,
      userName: req.user.name,
      userPhone: req.user.phone,
      subject: subject.trim(),
      message: message.trim(),
    });

    // Set success flash in session
    if (req.session) {
      req.session.supportSuccess =
        "Your message has been sent. We'll get back to you soon!";
    }

    res.redirect("/support");
  } catch (err) {
    console.error("Support submit error:", err);
    res.status(500).render("error", {
      err: { message: "Unable to send support message. Please try again." },
    });
  }
}
