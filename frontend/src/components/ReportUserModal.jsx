import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { REPORT_REASONS } from "@/lib/options";

/**
 * Report a profile or a specific chat message (Trust & Safety).
 * @param {object} props
 * @param {string} props.reportedUserId - User being reported (profile owner or message sender).
 * @param {string} [props.matchId] - Required for message reports; optional for profile reports from chat.
 * @param {string} [props.messageId] - When set, report targets this message.
 * @param {string} [props.messagePreview] - Shown in UI only.
 * @param {() => void} props.onClose
 */
export default function ReportUserModal({
  reportedUserId,
  matchId,
  messageId,
  messagePreview,
  onClose,
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const isMessage = Boolean(messageId);

  const submit = async () => {
    try {
      await api.post("/reports", {
        reported_user_id: reportedUserId,
        match_id: matchId || undefined,
        message_id: messageId || undefined,
        reason,
        detail: detail || undefined,
      });
      toast.success(isMessage ? "Message reported. We'll review it." : "Report sent. Our team will review.");
      onClose();
    } catch {
      toast.error("Report failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-snog-ink/85 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div className="glass relative w-full max-w-md rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl font-black">
          {isMessage ? "Report message" : "Report profile"}
        </h2>
        <p className="mt-1 text-xs text-white/60">
          {isMessage
            ? "We review flagged messages. Reports are private."
            : "Tell us what's wrong. Reports are private."}
        </p>
        {messagePreview && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/85">
            <div className="text-[10px] uppercase tracking-wider text-white/45">Reported content</div>
            <p className="mt-1 line-clamp-4">{messagePreview}</p>
          </div>
        )}
        <div className="mt-3">
          <div className="mb-1.5 text-xs uppercase tracking-wider text-white/60">Reason</div>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                data-testid={`report-reason-${r.replace(/\s+/g, "-").toLowerCase()}`}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  reason === r ? "border-snog-pink bg-snog-pink" : "border-white/15 text-white/70"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <textarea
          rows={3}
          maxLength={500}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Anything else we should know?"
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          data-testid={isMessage ? "report-message-submit" : "report-submit"}
          className="btn-primary mt-4 w-full"
        >
          Submit report
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full text-center text-xs text-white/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
