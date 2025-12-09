import React, { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  Clock,
  CheckCircle,
  Inbox,
  MoreVertical,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import type { Email, EmailStatus } from "../../types";
import axios from "../../api/axios";

interface KanbanBoardProps {
  mailboxId: string;
  onSelectEmail: (email: Email) => void;
}

interface Column {
  id: EmailStatus;
  title: string;
  icon: React.ReactNode;
  color: string;
}

const columns: Column[] = [
  {
    id: "inbox",
    title: "Inbox",
    icon: <Inbox className="w-5 h-5" />,
    color: "bg-blue-500",
  },
  {
    id: "todo",
    title: "To Do",
    icon: <Clock className="w-5 h-5" />,
    color: "bg-yellow-500",
  },
  {
    id: "done",
    title: "Done",
    icon: <CheckCircle className="w-5 h-5" />,
    color: "bg-green-500",
  },
  {
    id: "snoozed",
    title: "Snoozed",
    icon: <Clock className="w-5 h-5" />,
    color: "bg-purple-500",
  },
];

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  mailboxId,
  onSelectEmail,
}) => {
  const [emailsByStatus, setEmailsByStatus] = useState<
    Record<EmailStatus, Email[]>
  >({
    inbox: [],
    todo: [],
    done: [],
    snoozed: [],
  });
  const [loading, setLoading] = useState(true);
  const [draggingEmail, setDraggingEmail] = useState<Email | null>(null);
  const [snoozeEmailId, setSnoozeEmailId] = useState<string | null>(null);

  // Fetch emails grouped by status
  const fetchEmailsByStatus = useCallback(async () => {
    try {
      setLoading(true);
      const statusPromises = columns.map((col) =>
        axios.get(`/emails/by-status/${col.id}`)
      );

      const results = await Promise.all(statusPromises);
      const newEmailsByStatus: Record<EmailStatus, Email[]> = {
        inbox: [],
        todo: [],
        done: [],
        snoozed: [],
      };

      results.forEach((result, index) => {
        const status = columns[index].id;
        newEmailsByStatus[status] = result.data.data || [];
      });

      // Generate summaries for emails that don't have one
      for (const status of Object.keys(newEmailsByStatus) as EmailStatus[]) {
        const emailsNeedingSummary = newEmailsByStatus[status].filter(
          (e) => !e.summary
        );

        if (emailsNeedingSummary.length > 0) {
          try {
            const summaryResult = await axios.post("/emails/batch-summarize", {
              emailIds: emailsNeedingSummary.map((e) => e.id),
            });

            // Update emails with new summaries
            const summaryMap = new Map(
              summaryResult.data.data.map((item: any) => [
                item.id,
                item.summary,
              ])
            );

            newEmailsByStatus[status] = newEmailsByStatus[status].map((email) =>
              summaryMap.has(email.id)
                ? { ...email, summary: summaryMap.get(email.id) }
                : email
            );
          } catch (error) {
            console.error("Failed to generate summaries:", error);
          }
        }
      }

      setEmailsByStatus(newEmailsByStatus);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [mailboxId]);

  useEffect(() => {
    fetchEmailsByStatus();

    // Refresh every 60 seconds to check for expired snoozes
    const interval = setInterval(fetchEmailsByStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchEmailsByStatus]);

  // Handle drag start
  const handleDragStart = (email: Email) => {
    setDraggingEmail(email);
  };

  // Handle drag over (allow drop)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle drop
  const handleDrop = async (targetStatus: EmailStatus, e: React.DragEvent) => {
    e.preventDefault();

    if (!draggingEmail || draggingEmail.status === targetStatus) {
      setDraggingEmail(null);
      return;
    }

    try {
      // Update status on backend
      await axios.patch(`/emails/${draggingEmail.id}/status`, {
        status: targetStatus,
      });

      // Update local state
      const sourceStatus = draggingEmail.status;
      setEmailsByStatus((prev) => ({
        ...prev,
        [sourceStatus]: prev[sourceStatus].filter(
          (e) => e.id !== draggingEmail.id
        ),
        [targetStatus]: [
          ...prev[targetStatus],
          { ...draggingEmail, status: targetStatus, snoozeUntil: null },
        ],
      }));
    } catch (error) {
      console.error("Failed to update email status:", error);
    } finally {
      setDraggingEmail(null);
    }
  };

  // Handle snooze
  const handleSnooze = async (emailId: string, hours: number) => {
    try {
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + hours);

      await axios.post(`/emails/${emailId}/snooze`, {
        snoozeUntil: snoozeUntil.toISOString(),
      });

      // Refresh emails
      fetchEmailsByStatus();
      setSnoozeEmailId(null);
    } catch (error) {
      console.error("Failed to snooze email:", error);
    }
  };

  // Email card component
  const EmailCard: React.FC<{ email: Email }> = ({ email }) => (
    <div
      draggable
      onDragStart={() => handleDragStart(email)}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-move hover:shadow-md transition-shadow"
      onClick={() => onSelectEmail(email)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 truncate">
              {email.from.name || email.from.email}
            </span>
          </div>
          <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
            {email.subject || "(No Subject)"}
          </h3>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSnoozeEmailId(snoozeEmailId === email.id ? null : email.id);
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>

          {snoozeEmailId === email.id && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48">
              <div className="p-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 1);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 1 hour
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 4);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 4 hours
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 24);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 1 day
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 72);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 3 days
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {email.summary && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span className="text-blue-700 font-medium">AI Summary</span>
          </div>
          <p className="text-gray-700 line-clamp-3">{email.summary}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{formatDistanceToNow(new Date(email.timestamp))} ago</span>
        {email.gmailLink && (
          <a
            href={email.gmailLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-blue-500 hover:text-blue-700"
          >
            <ExternalLink className="w-3 h-3" />
            Gmail
          </a>
        )}
      </div>

      {email.snoozeUntil && email.status === "snoozed" && (
        <div className="mt-2 text-xs text-purple-600 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Until {new Date(email.snoozeUntil).toLocaleString()}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Kanban board...</p>
        </div>
      </div>
    );
  }

  // Check if all columns are empty
  const allEmailsCount = Object.values(emailsByStatus).reduce(
    (sum, emails) => sum + emails.length,
    0
  );
  const isEmpty = !loading && allEmailsCount === 0;

  const handleSyncFromGmail = async () => {
    try {
      setLoading(true);
      // Fetch inbox emails first to populate the board
      await axios.get(`/mailboxes/${mailboxId}/emails?limit=50`);
      // Refresh the board
      await fetchEmailsByStatus();
    } catch (error) {
      console.error("Failed to sync from Gmail:", error);
      alert("Failed to sync emails. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          {!loading && (
            <button
              onClick={fetchEmailsByStatus}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="flex items-center justify-center h-[calc(100%-80px)]">
          <div className="text-center max-w-md p-8">
            <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Emails Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Load your emails from Gmail to start organizing them in the Kanban
              board workflow.
            </p>
            <button
              onClick={handleSyncFromGmail}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-flex items-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              Load from Gmail
            </button>
          </div>
        </div>
      )}

      {!isEmpty && (
        <div className="flex gap-4 p-4 h-[calc(100%-80px)]">
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex flex-col flex-1 bg-gray-100 rounded-lg p-4"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(column.id, e)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className={`${column.color} text-white p-2 rounded-lg`}>
                  {column.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {column.title}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {emailsByStatus[column.id].length} emails
                  </p>
                </div>
              </div>

              {/* Email Cards */}
              <div className="flex-1 space-y-3 overflow-x-auto">
                {emailsByStatus[column.id].length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No emails in this column
                  </div>
                ) : (
                  emailsByStatus[column.id].map((email) => (
                    <EmailCard key={email.id} email={email} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
