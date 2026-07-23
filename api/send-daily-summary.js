export default async function handler(req, res) {
  try {
    await import("../scripts/send-daily-summary.mjs");

    return res.status(200).json({
      success: true,
      message: "Daily summary sent successfully"
    });

  } catch (error) {
    console.error("Mail error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
