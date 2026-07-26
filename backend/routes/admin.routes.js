import { Router } from "express";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
import {
    getAllUsers,
    setUserActive,
    adminDeletePost,
    getAllReports,
    resolveReport,
    getAnalyticsOverview,
    getTrendingPosts,
    getTrendingPeople
} from "../controllers/admin.controller.js";

const router = Router();

// All admin routes require a valid token AND an admin role
router.use(verifyToken, isAdmin);

router.get("/admin/users", getAllUsers);
router.post("/admin/users/set_active", setUserActive);
router.post("/admin/posts/delete", adminDeletePost);
router.get("/admin/reports", getAllReports);
router.post("/admin/reports/resolve", resolveReport);
router.get("/admin/analytics/overview", getAnalyticsOverview);
router.get("/admin/trending/posts", getTrendingPosts);
router.get("/admin/trending/people", getTrendingPeople);

export default router;
