import { createFileRoute } from "@tanstack/react-router";
import FeedbackAdminPage from "@/pages/admin/Feedback";
export const Route = createFileRoute("/admin/feedback")({ component: FeedbackAdminPage });
